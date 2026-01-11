import { CandleRepository } from '../db/repository';
import { Backtester } from '../logic/backtester';
import { Portfolio } from '../logic/portfolio';
import { RsiStrategy } from '../logic/strategies/rsiStrategy';
import { RiskConfig, Candle } from '../logic/types';
import { FixedPercentageSlippage } from '../logic/slippage';
import { MarketDataProvider } from '../services/marketDataProvider';
import pool from '../db';
import { RiskManager } from '../logic/risk/risk_manager';
import { ASSET_METADATA_MAP } from '../config/assets';

async function main() {

  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npm run backtest <SYMBOLS_CSV> <START_DATE> <END_DATE>');
    console.error('Example: npm run backtest "BTC-USD,ETH-USD" 2023-01-01 2023-12-31');
    process.exit(1);
  }

  const [symbolsArg, startStr, endStr] = args;
  const symbols = symbolsArg.split(',').map(s => s.trim());
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  const interval = '1d'; // Default to daily for now

  console.log(`🚀 Starting Backtest for Universe: ${symbols.join(', ')}`);
  console.log(`📅 Period: ${startDate.toDateString()} - ${endDate.toDateString()}`);

  try {
    // 1. Fetch Data
    const provider = new MarketDataProvider();
    console.log(`📥 Fetching aligned data...`);

    const universe = await provider.getAlignedCandles(symbols, interval, startDate, endDate);

    if (universe.size === 0 || universe.get(symbols[0])!.length === 0) {
      console.error(`❌ No data found for specified universe.`);
      process.exit(1);
    }

    // Check if we lost too much data due to alignment
    const candleCount = universe.get(symbols[0])!.length;
    console.log(`📊 Aligned Universe Data: ${candleCount} candles per symbol.`);
    if (candleCount < 50) {
      console.warn('⚠️  Warning: Very few candles remaining after alignment. Results may be unreliable.');
    }

    // 2. Setup Components
    const initialCapital = 10000;
    const portfolio = new Portfolio(initialCapital, { fixed: 10 }); // $10 commission per trade
    const strategy = new RsiStrategy({ period: 14, buyThreshold: 30, sellThreshold: 70 });

    const riskConfig: RiskConfig = {
      riskPerTradePct: 0.01, // 1%
      maxDrawdownPct: 0.1,   // 10%
      atrMultiplier: 2.5,
      atrPeriod: 14,
      trailingStop: true,
      adxThreshold: 25,     // Regime Detection
      dailyLossLimitPct: 0.02, // 2% Daily Loss Limit
      maxCorrelation: 0.7,   // Portfolio Guard
      maxSectorExposurePct: 0.2, // Max 20% per sector
      useBollingerTakeProfit: true
    };
    const riskManager = new RiskManager(riskConfig);

    const slippageModel = new FixedPercentageSlippage(0.001); // 0.1% slippage

    const backtester = new Backtester(strategy, portfolio, riskManager, slippageModel, ASSET_METADATA_MAP);

    // 3. Run Simulation
    const result = backtester.run(universe);

    // 4. Report
    console.log('\n=======================================');
    console.log(`🏁 Backtest Complete: ${strategy.name}`);
    console.log('=======================================');
    console.log(`Initial Capital:     ${result.initialCapital.toFixed(2)}`);
    console.log(`Final Capital:       ${result.finalCapital.toFixed(2)}`);
    console.log(`Total Return:        ${result.metrics.totalReturnPct.toFixed(2)}%`);
    console.log(`Max Drawdown:        ${result.metrics.maxDrawdownPct.toFixed(2)}%`);
    console.log(`Max Sector Exposure: ${((result.metrics.maxSectorExposurePct || 0) * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio:        ${result.metrics.sharpeRatio.toFixed(3)}`);
    console.log(`Win Rate:            ${result.metrics.winRatePct.toFixed(2)}%`);
    console.log(`Total Trades:        ${result.trades.length}`);

    // Sector Weights (Final)
    const finalState = portfolio.getState();
    if (finalState.positions.size > 0) {
      console.log('\n📊 Final Portfolio Breakdown:');
      const sectorValues = new Map<string, number>();
      let totalPositionValue = 0;

      for (const [sym, pos] of finalState.positions) {
        const sector = ASSET_METADATA_MAP.get(sym)?.sector || 'Unknown';
        const lastPrice = universe.get(sym)?.slice(-1)[0].close || pos.averagePrice;
        const value = pos.quantity * lastPrice;

        sectorValues.set(sector, (sectorValues.get(sector) || 0) + value);
        totalPositionValue += value;
      }

      const totalEquity = finalState.cash + totalPositionValue;

      // Sort sectors by weight
      const sortedSectors = Array.from(sectorValues.entries()).sort((a, b) => b[1] - a[1]);

      for (const [sector, value] of sortedSectors) {
        const weight = (value / totalEquity) * 100;
        console.log(`  ${sector.padEnd(20)}: ${weight.toFixed(2)}% ($${value.toFixed(2)})`);
      }
      console.log(`  ${'Cash'.padEnd(20)}: ${((finalState.cash / totalEquity) * 100).toFixed(2)}% ($${finalState.cash.toFixed(2)})`);
    } else {
      console.log('\n📊 Final Portfolio: 100% Cash');
    }

    if (result.trades.length > 0) {
      console.log('\n📜 Trade History (Last 3 per symbol):');

      const symbolsInUniverse = Array.from(universe.keys());
      for (const sym of symbolsInUniverse) {
        const symbolTrades = result.trades.filter(t => t.symbol === sym);
        if (symbolTrades.length > 0) {
          console.log(`  --- ${sym} (Total Trades: ${symbolTrades.length}) ---`);
          symbolTrades.slice(-3).forEach(t => {
            console.log(`  [${t.timestamp.toISOString().split('T')[0]}] ${t.action} ${t.quantity} @ $${t.price.toFixed(2)} (Fee: $${t.fee.toFixed(2)})`);
          });
        } else {
          console.log(`  --- ${sym}: No trades ---`);
        }
      }
    }

  } catch (err) {
    console.error('❌ Error running backtest:', err);
  } finally {
    await pool.end();
  }
}

main();
