import { PersistentPortfolio } from '../logic/persistentPortfolio';
import { STRATEGY_REGISTRY } from '../logic/strategies/registry';
import pool from '../db';
import yahooFinance from 'yahoo-finance2';
import { Candle, Signal, RiskConfig } from '../logic/types';
import { RiskManager } from '../logic/risk/risk_manager';
import { calculateATR } from '../logic/indicators/atr';
import { FixedPercentageSlippage } from '../logic/slippage';
import { MarketDataProvider } from '../services/marketDataProvider';
import { ASSET_METADATA_MAP } from '../config/assets';
import { BacktestRepository } from '../db/backtestRepository';

async function main() {
  const args = process.argv.slice(2);
  // Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE> [STRATEGY_NAME]
  if (args.length < 3) {
    console.error('Usage: npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE: DRY|LIVE> [STRATEGY_NAME]');
    process.exit(1);
  }

  const [portfolioId, symbol, mode, strategyNameArg] = args;
  const isLive = mode.toUpperCase() === 'LIVE';

  const strategyName = strategyNameArg || 'RsiStrategy';
  const StrategyClass = STRATEGY_REGISTRY[strategyName];

  if (!StrategyClass) {
    console.error(`❌ Unknown Strategy: "${strategyName}"`);
    console.error('Available Strategies:', Object.keys(STRATEGY_REGISTRY).join(', '));
    process.exit(1);
  }

  console.log(`🤖 Starting Bot for ${symbol}`);
  console.log(`🧠 Strategy: ${strategyName}`);
  console.log(`📂 Portfolio: ${portfolioId}`);
  console.log(`⚠️  Mode: ${mode.toUpperCase()}`);

  // Components
  const slippageModel = new FixedPercentageSlippage(0.001); // 0.1% slippage
  const marketDataProvider = new MarketDataProvider();
  const backtestRepo = new BacktestRepository();

  // Risk Configuration
  const riskConfig: RiskConfig = {
    riskPerTradePct: 0.01, // 1%
    maxDrawdownPct: 0.1,
    atrMultiplier: 2.5,
    atrPeriod: 14,
    trailingStop: true,
    adxThreshold: 25,
    dailyLossLimitPct: 0.02,
    maxCorrelation: 0.7,
    maxSectorExposurePct: 0.2, // Max 20% per sector
    volumeLimitPct: 0.1, // Liquidity Guard
    useBollingerTakeProfit: true
  };
  const riskManager = new RiskManager(riskConfig);

  try {
    // 1. Fetch Data (History + Latest)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 200);

    console.log('📥 Fetching latest market data...');
    const yf = new yahooFinance({ suppressNotices: ['ripHistorical'] });
    const response = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!response || !response.quotes || response.quotes.length === 0) {
      throw new Error('No data returned from API');
    }

    const candles: Candle[] = response.quotes
      .filter(q => q.open !== null && q.close !== null)
      .map(q => ({
        time: q.date,
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume || 0
      }));

    const latestCandle = candles[candles.length - 1];
    console.log(`📊 Analyzed ${candles.length} candles. Latest: $${latestCandle.close.toFixed(2)}`);

    // 2. Regime Guard (Asset Intelligence)
    const currentYear = new Date().getFullYear();
    const profile = await backtestRepo.getLatestProfile(symbol, currentYear);
    
    if (profile) {
      console.log(`🛡️  Regime Check: ${symbol} is profiled as '${profile.regime}' for ${currentYear}.`);
      const compatibility = riskManager.checkRegimeCompatibility(strategyName, profile.regime);
      if (!compatibility.compatible) {
        console.error(`⛔ TRADE BLOCKED: ${compatibility.reason}`);
        process.exit(0); // Exit gracefully as this is an intended safety block
      }
      console.log(`✅ Regime Compatible: Strategy ${strategyName} is allowed.`);
    } else {
      console.warn(`⚠️  No Asset Profile found for ${symbol} in ${currentYear}. Proceeding with Caution...`);
    }

    // 3. Load Portfolio
    const portfolio = new PersistentPortfolio(portfolioId, 0, { fixed: 10 });
    await portfolio.load();

    const state = portfolio.getState();
    console.log(`💰 Cash: $${state.cash.toFixed(2)}`);

    // 2a. Check Max Drawdown (Hard Stop)
    const currentEquity = portfolio.getTotalValue(latestCandle.close, symbol);
    console.log(`📈 Equity: $${currentEquity.toFixed(2)} (HWM: $${portfolio.highWaterMark.toFixed(2)})`);

    if (currentEquity > portfolio.highWaterMark) {
      console.log(`🎉 New High Water Mark! Updating DB...`);
      if (isLive) {
        await portfolio.persistHighWaterMark(currentEquity);
      } else {
        portfolio.highWaterMark = currentEquity;
      }
    }

    if (riskManager.checkDrawdown(currentEquity, portfolio.highWaterMark)) {
      console.error(`🛑 HARD STOP: Maximum Drawdown (${(riskConfig.maxDrawdownPct * 100).toFixed(1)}%) Breached.`);
      console.error(`   Current Equity: $${currentEquity.toFixed(2)}, HWM: $${portfolio.highWaterMark.toFixed(2)}`);
      console.error(`   Trading Halted.`);
      process.exit(1);
    }

    const pos = state.positions.get(symbol);
    let finalSignal: Signal | null = null;
    let skipStrategy = false;

    // 2b. Check Daily Loss Limit (Portfolio Guard)
    const todaysTrades = await portfolio.loadDailyTrades(new Date());
    const todayPnL = todaysTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const startOfDayEquity = currentEquity - todayPnL;

    if (riskManager.checkDailyLoss(todaysTrades, startOfDayEquity, new Date())) {
      console.error(`🛑 HARD STOP: Daily Loss Limit (${(riskConfig.dailyLossLimitPct! * 100).toFixed(1)}%) Breached.`);
      console.error(`   Today's PnL: $${todayPnL.toFixed(2)}`);
      skipStrategy = true;

      if (pos) {
        console.warn(`⚠️  Liquidating remaining position due to Daily Loss Limit...`);
        const execPrice = slippageModel.calculateExecutionPrice(latestCandle.close, pos.quantity, latestCandle, 'SELL');
        finalSignal = {
          action: 'SELL',
          price: execPrice,
          timestamp: latestCandle.time,
          reason: 'Daily Loss Limit Breach'
        };
      }
    }

    // 3. Risk Check: Check Exits for existing positions
    if (!finalSignal && pos) {
      console.log(`📦 Holding: ${pos.quantity} shares @ $${pos.averagePrice.toFixed(2)}`);
      console.log(`   Stops: SL: ${pos.stopLoss?.toFixed(2) || 'None'}, TP: ${pos.takeProfit?.toFixed(2) || 'None'}`);

      const exitReason = riskManager.checkExits(latestCandle, pos);
      if (exitReason) {
        console.log(`🚨 RISK EXIT TRIGGERED: ${exitReason}`);
        const basePrice = exitReason === 'STOP_LOSS' ? (pos.stopLoss || latestCandle.close) : (pos.takeProfit || latestCandle.close);
        const execPrice = slippageModel.calculateExecutionPrice(basePrice, pos.quantity, latestCandle, 'SELL');

        finalSignal = {
          action: 'SELL',
          price: execPrice,
          timestamp: latestCandle.time,
          reason: `Risk Management: ${exitReason}`
        };
      } else if (riskConfig.trailingStop && pos.stopLoss) {
        // Update Trailing Stop
        const atrSeries = calculateATR(candles, riskConfig.atrPeriod);
        const latestAtr = atrSeries[atrSeries.length - 1];
        if (latestAtr) {
          const newStop = riskManager.updateTrailingStop(pos.stopLoss, latestCandle.high, latestCandle.low, latestAtr, 'BUY');
          if (newStop > pos.stopLoss) {
            console.log(`📈 Trailing Stop ratcheted up: $${pos.stopLoss.toFixed(2)} -> $${newStop.toFixed(2)}`);
            if (isLive) {
              await portfolio.updateRiskParams(symbol, newStop, pos.takeProfit);
            }
          }
        }
      }
    } else if (!pos && !finalSignal) {
      console.log(`📦 Holding: None`);
    }

    // 4. Run Strategy Logic (if no risk exit triggered and not in skip mode)
    if (!finalSignal && !skipStrategy) {
      const strategy = new StrategyClass({}); // Use defaults for now
      const strategySignal = strategy.analyze(candles);

      console.log(`\n💡 Strategy Signal: ${strategySignal.action} @ $${strategySignal.price.toFixed(2)}`);
      if (strategySignal.reason) console.log(`   Reason: ${strategySignal.reason}`);

      if (strategySignal.action === 'BUY') {
        // Regime Detection (ADX Filter)
        if (!riskManager.isMarketTrending(candles)) {
          console.log(`🛡️  Trade Filtered: Market is choppy (Low ADX).`);
        } else {
          // --- CORRELATION CHECK ---
          let correlationBreach = false;
          const existingSymbols = Array.from(state.positions.keys()).filter(s => s !== symbol);

          if (existingSymbols.length > 0 && riskConfig.maxCorrelation) {
            console.log(`🔎 Checking correlation with portfolio: ${existingSymbols.join(', ')}`);

            // Use MarketDataProvider to get aligned returns for all symbols
            const allSymbols = [symbol, ...existingSymbols];
            const alignedReturns = await marketDataProvider.getAlignedReturns(allSymbols, '1d', startDate, endDate);

            const targetRets = alignedReturns.get(symbol);

            if (!targetRets || targetRets.length < 30) {
              console.warn(`⚠️  Insufficient aligned data for correlation check (needed 30, got ${targetRets?.length || 0}).`);
            } else {
              // Check correlation with each existing position
              for (const posSymbol of existingSymbols) {
                const posRets = alignedReturns.get(posSymbol);
                if (!posRets) continue;

                const singleMap = new Map<string, number[]>();
                singleMap.set(posSymbol, posRets);

                if (riskManager.checkCorrelation(targetRets, singleMap)) {
                  console.log(`❌ High Correlation detected with ${posSymbol}.`);
                  correlationBreach = true;
                  break;
                }
              }
            }
          }

          if (correlationBreach) {
            console.log(`🛡️  Trade Filtered: Correlation limit exceeded.`);
          } else {
            // --- SECTOR EXPOSURE CHECK ---
            // 1. Fetch aligned data for prices (we need more than returns)
            const allSymbols = [symbol, ...existingSymbols];
            const alignedUniverse = await marketDataProvider.getAlignedCandles(allSymbols, '1d', startDate, endDate);

            // 2. Calculate Market Values for existing positions
            const positionValues = new Map<string, number>();
            for (const posSym of existingSymbols) {
              const pos = state.positions.get(posSym);
              if (!pos) continue;

              const candles = alignedUniverse.get(posSym);
              const lastPrice = candles ? candles[candles.length - 1].close : pos.averagePrice;
              positionValues.set(posSym, pos.quantity * lastPrice);
            }

            // 3. Preliminary trade value
            const preliminaryPrice = strategySignal.price;
            const atrSeries = calculateATR(candles, riskConfig.atrPeriod);
            const latestAtr = atrSeries[atrSeries.length - 1];
            const equity = portfolio.getTotalValue(latestCandle.close, symbol);

            let sectorBreach = false;
            if (latestAtr) {
              const stopLoss = riskManager.calculateATRStop(latestCandle.close, latestAtr, 'BUY');
              const quantity = riskManager.calculatePositionSize(equity, preliminaryPrice, stopLoss);
              const tradeValue = preliminaryPrice * quantity;

              if (riskManager.checkSectorExposure(symbol, tradeValue, equity, positionValues, ASSET_METADATA_MAP)) {
                console.log(`🛡️  Trade Filtered: Sector Exposure limit exceeded.`);
                sectorBreach = true;
              }
            }

            if (sectorBreach) {
              // Skip
            } else {
              // Apply Slippage to Entry
              const execPrice = slippageModel.calculateExecutionPrice(strategySignal.price, 0, latestCandle, 'BUY');

              // Enhance BUY signal with Risk Unit sizing
              if (latestAtr) {
                const stopLoss = riskManager.calculateATRStop(latestCandle.close, latestAtr, 'BUY');
                const quantity = riskManager.calculatePositionSize(equity, execPrice, stopLoss);

                if (quantity > 0) {
                  finalSignal = {
                    ...strategySignal,
                    price: execPrice,
                    quantity,
                    stopLoss
                  };

                  // Dynamic Take Profit (Bollinger Bands)
                  if (riskConfig.useBollingerTakeProfit) {
                    const dynamicTP = riskManager.calculateBollingerTakeProfit(candles, 'BUY');
                    if (dynamicTP) {
                      finalSignal.takeProfit = dynamicTP;
                      console.log(`🎯 Dynamic Take Profit set to Upper Band: $${dynamicTP.toFixed(2)}`);
                    }
                  }

                  console.log(`🛡️  Risk Sizing: Requested ${quantity} shares @ $${execPrice.toFixed(2)}, Stop Loss: $${stopLoss.toFixed(2)}`);
                } else {
                  console.log('🛡️  Risk Sizing: Position size is 0. Skipping BUY.');
                }
              } else {
                console.warn('⚠️  Could not calculate ATR for sizing. Skipping BUY.');
              }
            }
          }
        }
      } else if (strategySignal.action === 'SELL' && pos) {
        const execPrice = slippageModel.calculateExecutionPrice(strategySignal.price, pos.quantity, latestCandle, 'SELL');
        finalSignal = { ...strategySignal, price: execPrice };
      }
    }

    // 5. Execute Final Signal
    if (finalSignal && finalSignal.action !== 'HOLD') {
      if (isLive) {
        console.log(`🚀 Executing LIVE ${finalSignal.action} trade @ $${finalSignal.price.toFixed(2)}...`);
        await portfolio.executeSignal(finalSignal, symbol, strategyName);
        console.log('✅ Trade executed successfully.');

        const newState = portfolio.getState();
        console.log(`💰 New Cash: $${newState.cash.toFixed(2)}`);
      } else {
        console.log(`🛑 DRY RUN: ${finalSignal.action} Signal generated @ $${finalSignal.price.toFixed(2)}.`);
        if (finalSignal.quantity) {
          console.log(`   Simulated Quantity: ${finalSignal.quantity}`);
        }
      }
    } else if (!finalSignal) {
      console.log('💤 No action required.');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
