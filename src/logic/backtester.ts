import { Portfolio } from './portfolio';
import { Strategy, Candle, BacktestResult, EquitySnapshot, Signal, AssetMetadata } from './types';
import { PerformanceAnalyzer } from './analysis';
import { RiskManager } from './risk/risk_manager';
import { calculateATR } from './indicators/atr';
import { SlippageModel, ZeroSlippage } from './slippage';
import { calculateReturns } from './math';

export class Backtester {
  private portfolio: Portfolio;
  private strategy: Strategy;
  private analyzer: PerformanceAnalyzer;
  private riskManager?: RiskManager;
  private slippageModel: SlippageModel;
  private metadataMap: Map<string, AssetMetadata>;

  constructor(
    strategy: Strategy,
    portfolio: Portfolio,
    riskManager?: RiskManager,
    slippageModel?: SlippageModel,
    metadataMap?: Map<string, AssetMetadata>
  ) {
    this.strategy = strategy;
    this.portfolio = portfolio;
    this.analyzer = new PerformanceAnalyzer();
    this.riskManager = riskManager;
    this.slippageModel = slippageModel || new ZeroSlippage();
    this.metadataMap = metadataMap || new Map();
  }

  /**
   * Runs the simulation over the provided universe of assets.
   * @param universe Map of Symbol -> Candles. All candle arrays MUST be aligned (same length, same timestamps).
   */
  public run(universe: Map<string, Candle[]>): BacktestResult {
    const symbols = Array.from(universe.keys());
    if (symbols.length === 0) {
      throw new Error('No data provided for backtest');
    }

    const length = universe.get(symbols[0])!.length;
    // Verify alignment (basic check)
    for (const sym of symbols) {
      if (universe.get(sym)!.length !== length) {
        throw new Error(`Data misalignment: ${sym} has ${universe.get(sym)!.length} candles, expected ${length}`);
      }
    }

    const initialCapital = this.portfolio.getState().cash;
    const equityCurve: EquitySnapshot[] = [];
    let highWaterMark = initialCapital;
    let maxSectorExposureSeen = 0;

    // Pre-calculate ATR and Returns for all symbols (if Risk Manager enabled)
    const atrCache = new Map<string, (number | null)[]>();
    const returnsCache = new Map<string, number[]>();

    if (this.riskManager) {
      const period = this.riskManager.config.atrPeriod || 14;
      for (const sym of symbols) {
        const candles = universe.get(sym)!;
        atrCache.set(sym, calculateATR(candles, period));
        returnsCache.set(sym, calculateReturns(candles.map(c => c.close)));
      }
    }

    // Daily Loss Limit Tracking
    let lastDateStr = '';
    let dailyStartingEquity = initialCapital;

    // Main Simulation Loop (Time-driven)
    for (let i = 0; i < length; i++) {
      // We assume all symbols have the same timestamp at index i
      const timestamp = universe.get(symbols[0])![i].time;

      // 1. Portfolio Level Checks (Start of Step)
      const currentTotalEquity = this.calculateTotalEquity(universe, i);
      
      // Daily Reset
      const currentDateStr = timestamp.toISOString().split('T')[0];
      if (currentDateStr !== lastDateStr) {
        dailyStartingEquity = this.calculateTotalEquity(universe, i, true); // Use Open price for start of day equity? Or previous close? 
        // Typically start of day equity is previous close. But let's use Open for "Opening Equity".
        lastDateStr = currentDateStr;
      }

      // Check Hard Stop (Max Drawdown)
      if (this.riskManager) {
        if (currentTotalEquity > highWaterMark) {
          highWaterMark = currentTotalEquity;
        }
        if (this.riskManager.checkDrawdown(currentTotalEquity, highWaterMark)) {
           console.warn(`🛑 Max Drawdown Breached at ${timestamp.toISOString()}. Equity: $${currentTotalEquity.toFixed(2)}, HWM: $${highWaterMark.toFixed(2)}`);
           this.recordSnapshot(timestamp, currentTotalEquity, equityCurve);
           break; // Stop Simulation
        }
      }

      // Check Daily Loss Limit
      let skipTradingToday = false;
      if (this.riskManager && this.riskManager.config.dailyLossLimitPct) {
        const trades = this.portfolio.getState().trades;
        if (this.riskManager.checkDailyLoss(trades, dailyStartingEquity, timestamp)) {
          skipTradingToday = true;
          // Liquidate all positions? Or just stop new entries?
          // Usually "Kill Switch" implies flattening. 
          // For now, let's just Block New Entries. (Liquidating everything might be too aggressive for this simple logic, 
          // but strictly speaking, a Daily Loss Limit often requires flattening).
          // Let's stick to "Stop New Entries" for now to avoid complexity in this loop.
        }
      }

      // 2. Symbol Loop (Process each asset)
      for (const sym of symbols) {
        const candles = universe.get(sym)!;
        const currentCandle = candles[i];
        
        // --- Risk Management: Check Exits for Existing Positions ---
        if (this.riskManager) {
          const position = this.portfolio.getState().positions.get(sym);
          if (position) {
            const exitReason = this.riskManager.checkExits(currentCandle, position);
            if (exitReason) {
              const basePrice = exitReason === 'STOP_LOSS' ? position.stopLoss! : position.takeProfit!;
              const execPrice = this.slippageModel.calculateExecutionPrice(basePrice, position.quantity, currentCandle, 'SELL');
              
              const exitSignal: Signal = {
                action: 'SELL',
                price: execPrice,
                timestamp: currentCandle.time,
                reason: exitReason
              };

              // Liquidity Guard (Risk Exit)
              if (this.riskManager.config.volumeLimitPct) {
                const maxQty = Math.floor(currentCandle.volume * this.riskManager.config.volumeLimitPct);
                exitSignal.quantity = maxQty; // Portfolio.sell will clamp this to position size
              }

              this.portfolio.sell(sym, exitSignal);
              continue; // Position processed (closed or partially closed)
            }

            // Update Trailing Stop
            const atr = atrCache.get(sym)![i];
            if (atr !== null && position.stopLoss) {
              const newStop = this.riskManager.updateTrailingStop(
                position.stopLoss,
                currentCandle.high,
                currentCandle.low,
                atr,
                'BUY'
              );
              position.stopLoss = newStop;
            }
          }
        }

        if (skipTradingToday) continue;

        // --- Strategy Execution ---
        const visibleHistory = candles.slice(0, i + 1);
        const rawSignal = this.strategy.analyze(visibleHistory);
        const finalSignal: Signal = { ...rawSignal };

        // Filters
        if (this.riskManager && finalSignal.action === 'BUY') {
          // 1. Regime (ADX)
          if (!this.riskManager.isMarketTrending(visibleHistory)) {
             finalSignal.action = 'HOLD';
             finalSignal.reason = 'Market is choppy';
          }

          // 2. Correlation (Portfolio Guard)
          if (finalSignal.action === 'BUY' && this.riskManager.config.maxCorrelation) {
             const lookback = 30;
             if (i >= lookback) {
               const candidateSlice = returnsCache.get(sym)!.slice(i - lookback + 1, i + 1);
               const otherHoldings = Array.from(this.portfolio.getState().positions.keys()).filter(k => k !== sym);
               
               if (otherHoldings.length > 0) {
                 const portfolioSlices = new Map<string, number[]>();
                 for (const h of otherHoldings) {
                   portfolioSlices.set(h, returnsCache.get(h)!.slice(i - lookback + 1, i + 1));
                 }
                 
                 if (this.riskManager.checkCorrelation(candidateSlice, portfolioSlices)) {
                    finalSignal.action = 'HOLD';
                    finalSignal.reason = 'High Correlation';
                 }
               }
             }
          }
        }

        // Apply Slippage & Sizing
        if (finalSignal.action !== 'HOLD') {
            finalSignal.price = this.slippageModel.calculateExecutionPrice(
              rawSignal.price, 0, currentCandle, finalSignal.action
            );
        }

        if (finalSignal.action === 'BUY') {
          const equity = this.calculateTotalEquity(universe, i); // Use current equity for sizing
          const atr = atrCache.get(sym)?.[i];

          if (this.riskManager && atr && atr > 0) {
            const stopLoss = this.riskManager.calculateATRStop(currentCandle.close, atr, 'BUY');
            const quantity = this.riskManager.calculatePositionSize(equity, finalSignal.price, stopLoss);
            
            finalSignal.quantity = quantity;
            finalSignal.stopLoss = stopLoss;

             if (this.riskManager.config.useBollingerTakeProfit) {
                const dynamicTP = this.riskManager.calculateBollingerTakeProfit(visibleHistory, 'BUY');
                if (dynamicTP) finalSignal.takeProfit = dynamicTP;
             }

             // --- Sector Exposure Check ---
             const tradeValue = finalSignal.price * (finalSignal.quantity || 0);
             const currentPositionValues = this.getCurrentPositionValues(universe, i);
             
             if (this.riskManager.checkSectorExposure(
               sym, 
               tradeValue, 
               equity, 
               currentPositionValues, 
               this.metadataMap
             )) {
               finalSignal.action = 'HOLD';
               finalSignal.reason = 'Sector Exposure Limit Breached';
             }

          } else {
             finalSignal.quantity = Infinity; // Legacy All-In
          }
        }

        // Liquidity Guard (Strategy Entry/Exit)
        if (this.riskManager && this.riskManager.config.volumeLimitPct && finalSignal.action !== 'HOLD') {
          const maxQty = Math.floor(currentCandle.volume * this.riskManager.config.volumeLimitPct);
          const proposedQty = finalSignal.quantity ?? Infinity;

          // Clamp
          finalSignal.quantity = Math.min(proposedQty, maxQty);

          if (finalSignal.quantity === 0) {
            finalSignal.action = 'HOLD';
            finalSignal.reason = 'Liquidity Guard (Zero Volume)';
          } else if (finalSignal.quantity < proposedQty && proposedQty !== Infinity) {
             const note = `Liquidity Guard (Partial Fill: ${finalSignal.quantity})`;
             finalSignal.reason = finalSignal.reason ? `${finalSignal.reason} | ${note}` : note;
          }
        }

        // Execute
        this.portfolio.executeSignal(finalSignal, sym, this.strategy.name);
      } // End Symbol Loop

      // 3. Post-Step Tracking
      const stepTotalEquity = this.calculateTotalEquity(universe, i);
      const sectorExposures = this.calculateSectorExposures(universe, i, stepTotalEquity);
      for (const exposurePct of sectorExposures.values()) {
        if (exposurePct > maxSectorExposureSeen) {
          maxSectorExposureSeen = exposurePct;
        }
      }

      // Record Snapshot (End of Step)
      this.recordSnapshot(timestamp, stepTotalEquity, equityCurve);

    } // End Time Loop

    const trades = this.portfolio.getState().trades;
    const metrics = this.analyzer.calculateMetrics(initialCapital, equityCurve, trades);
    metrics.maxSectorExposurePct = maxSectorExposureSeen;

    return {
      initialCapital,
      finalCapital: equityCurve[equityCurve.length - 1].equity,
      metrics,
      trades,
      equityCurve
    };
  }

  private calculateSectorExposures(universe: Map<string, Candle[]>, index: number, totalEquity: number): Map<string, number> {
    const state = this.portfolio.getState();
    const sectorValues = new Map<string, number>();

    for (const [symbol, position] of state.positions) {
      const sector = this.metadataMap.get(symbol)?.sector || 'Unknown';
      const candles = universe.get(symbol);
      const price = candles && candles[index] ? candles[index].close : position.averagePrice;
      const value = position.quantity * price;
      
      sectorValues.set(sector, (sectorValues.get(sector) || 0) + value);
    }

    const exposures = new Map<string, number>();
    if (totalEquity <= 0) return exposures;

    for (const [sector, value] of sectorValues) {
      exposures.set(sector, value / totalEquity);
    }

    return exposures;
  }

  private calculateTotalEquity(universe: Map<string, Candle[]>, index: number, useOpen = false): number {
    const state = this.portfolio.getState();
    let equity = state.cash;
    
    for (const [symbol, position] of state.positions) {
      const candles = universe.get(symbol);
      if (candles && candles[index]) {
        const price = useOpen ? candles[index].open : candles[index].close;
        equity += position.quantity * price;
      } else {
        // Fallback if data missing (shouldn't happen with aligned data)
        equity += position.quantity * position.averagePrice; 
      }
    }
    return equity;
  }

  private recordSnapshot(timestamp: Date, equity: number, curve: EquitySnapshot[]) {
    curve.push({
      timestamp,
      cash: this.portfolio.getState().cash,
      equity
    });
  }

  private getCurrentPositionValues(universe: Map<string, Candle[]>, index: number): Map<string, number> {
    const state = this.portfolio.getState();
    const values = new Map<string, number>();

    for (const [symbol, position] of state.positions) {
      const candles = universe.get(symbol);
      const price = candles && candles[index] ? candles[index].close : position.averagePrice;
      values.set(symbol, position.quantity * price);
    }
    return values;
  }
}
