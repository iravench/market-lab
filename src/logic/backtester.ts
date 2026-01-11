import { Portfolio } from './portfolio';
import { Strategy, Candle, BacktestResult, EquitySnapshot, RiskConfig, Signal } from './types';
import { PerformanceAnalyzer } from './analysis';
import { RiskManager } from './risk/risk_manager';
import { calculateATR } from './indicators/atr';
import { SlippageModel, ZeroSlippage } from './slippage';
import { calculateReturns } from './math';

export class Backtester {
  private portfolio: Portfolio;
  private strategy: Strategy;
  private symbol: string;
  private analyzer: PerformanceAnalyzer;
  private riskManager?: RiskManager;
  private slippageModel: SlippageModel;

  constructor(
    strategy: Strategy,
    portfolio: Portfolio,
    symbol: string,
    riskConfig?: RiskConfig,
    slippageModel?: SlippageModel
  ) {
    this.strategy = strategy;
    this.portfolio = portfolio;
    this.symbol = symbol;
    this.analyzer = new PerformanceAnalyzer();
    if (riskConfig) {
      this.riskManager = new RiskManager(riskConfig);
    }
    this.slippageModel = slippageModel || new ZeroSlippage();
  }

  /**
   * Runs the simulation over the provided historical candles.
   * @param candles The primary symbol's history (must be aligned with auxiliaryData if provided)
   * @param auxiliaryData Optional map of other symbols' history (for correlation checks). 
   *                      MUST be aligned with `candles` (same length, same timestamps).
   */
  public run(candles: Candle[], auxiliaryData?: Map<string, Candle[]>): BacktestResult {
    if (candles.length === 0) {
      throw new Error('No candles provided for backtest');
    }

    const initialCapital = this.portfolio.getState().cash;
    const equityCurve: EquitySnapshot[] = [];
    let atrSeries: (number | null)[] = [];
    let highWaterMark = initialCapital;

    // Daily Loss Limit Tracking
    let lastDateStr = '';
    let dailyStartingEquity = initialCapital;

    // Pre-calculate ATR if Risk Manager is enabled
    if (this.riskManager) {
      const period = this.riskManager.config.atrPeriod || 14;
      atrSeries = calculateATR(candles, period);
    }

    // Pre-calculate returns for correlation check
    let primaryReturns: number[] = [];
    const auxiliaryReturns = new Map<string, number[]>();
    
    if (this.riskManager && auxiliaryData) {
      primaryReturns = calculateReturns(candles.map(c => c.close));
      for (const [sym, auxCandles] of auxiliaryData) {
        auxiliaryReturns.set(sym, calculateReturns(auxCandles.map(c => c.close)));
      }
    }

    // Main Simulation Loop
    for (let i = 0; i < candles.length; i++) {
      const currentCandle = candles[i];

      // Daily starting equity update
      const currentDateStr = currentCandle.time.toISOString().split('T')[0];
      if (currentDateStr !== lastDateStr) {
        dailyStartingEquity = this.portfolio.getTotalValue(currentCandle.open, this.symbol);
        lastDateStr = currentDateStr;
      }

      // 0. Check Portfolio Guard: Daily Loss Limit
      if (this.riskManager && this.riskManager.config.dailyLossLimitPct) {
        const trades = this.portfolio.getState().trades;
        if (this.riskManager.checkDailyLoss(trades, dailyStartingEquity, currentCandle.time)) {
          const position = this.portfolio.getState().positions.get(this.symbol);
          if (position) {
            // Liquidate position if daily loss limit hit
            const execPrice = this.slippageModel.calculateExecutionPrice(currentCandle.close, position.quantity, currentCandle, 'SELL');
            this.portfolio.sell(this.symbol, {
              action: 'SELL',
              price: execPrice,
              timestamp: currentCandle.time,
              reason: 'DAILY_LOSS_LIMIT'
            });
          }
          this.recordSnapshot(currentCandle, equityCurve);
          continue; // Skip further signals today
        }
      }

      // 0a. Check Max Drawdown
      if (this.riskManager) {
        const currentEquity = this.portfolio.getTotalValue(currentCandle.close, this.symbol);
        if (currentEquity > highWaterMark) {
          highWaterMark = currentEquity;
        }

        if (this.riskManager.checkDrawdown(currentEquity, highWaterMark)) {
          // HARD STOP: Maximum Drawdown Breached
          // We record the failure state and stop the simulation.
          this.recordSnapshot(currentCandle, equityCurve);

          // Technically we should liquidate positions to realize the loss, 
          // but for a Hard Stop analysis, knowing WHERE we died is enough.
          console.warn(`🛑 Max Drawdown Breached at ${currentCandle.time.toISOString()}. Equity: $${currentEquity.toFixed(2)}, HWM: $${highWaterMark.toFixed(2)}`);
          break;
        }
      }

      // 0b. Risk Management: Check for existing position exits (Stop Loss / Take Profit)
      if (this.riskManager) {
        const position = this.portfolio.getState().positions.get(this.symbol);
        if (position) {
          const exitReason = this.riskManager.checkExits(currentCandle, position);
          if (exitReason) {
            const basePrice = exitReason === 'STOP_LOSS' ? position.stopLoss! : position.takeProfit!;
            // Apply Slippage to Exit
            const execPrice = this.slippageModel.calculateExecutionPrice(basePrice, position.quantity, currentCandle, 'SELL');

            this.portfolio.sell(this.symbol, {
              action: 'SELL',
              price: execPrice,
              timestamp: currentCandle.time,
              reason: exitReason
            });
            this.recordSnapshot(currentCandle, equityCurve);
            continue;
          }

          // Update Trailing Stop
          const atr = atrSeries[i];
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

      // "Current" window: all candles up to the current index
      const visibleHistory = candles.slice(0, i + 1);

      // 1. Get Signal from Strategy
      const rawSignal = this.strategy.analyze(visibleHistory);

      // 2. Enhance Signal with Quantity / Risk Params / Slippage
      const finalSignal: Signal = { ...rawSignal };

      // Regime Detection (ADX Filter)
      if (this.riskManager && finalSignal.action === 'BUY') {
        if (!this.riskManager.isMarketTrending(visibleHistory)) {
          finalSignal.action = 'HOLD';
          finalSignal.reason = 'Market is choppy (Low ADX)';
        }
        
        // Correlation Check
        if (this.riskManager.config.maxCorrelation && auxiliaryData && auxiliaryData.size > 0) {
            const lookback = 30; 
            // Only check if we have enough history
            if (i >= lookback) {
                // Returns slice: [i - lookback + 1 ... i]
                const candidateSlice = primaryReturns.slice(i - lookback + 1, i + 1);
                
                const portfolioSlices = new Map<string, number[]>();
                for (const [sym, ret] of auxiliaryReturns) {
                    portfolioSlices.set(sym, ret.slice(i - lookback + 1, i + 1));
                }

                if (this.riskManager.checkCorrelation(candidateSlice, portfolioSlices)) {
                    finalSignal.action = 'HOLD';
                    finalSignal.reason = 'High Correlation';
                }
            }
        }
      }

      if (finalSignal.action !== 'HOLD') {
        // Apply Slippage to Entry/Exit Signal
        // We use a dummy quantity 0 if not yet known, or we need to estimate? 
        // Simple models don't use qty. Advanced ones might.
        // For BUY, we calculate qty AFTER price is finalized (safe).
        // So pass 0 or estimate. Let's pass 0 for now.
        finalSignal.price = this.slippageModel.calculateExecutionPrice(
          rawSignal.price,
          0,
          currentCandle,
          finalSignal.action
        );
      }

      if (finalSignal.action === 'BUY') {
        const equity = this.portfolio.getTotalValue(currentCandle.close, this.symbol);
        const atr = atrSeries[i];

        if (this.riskManager && atr && atr > 0) {
          const stopLoss = this.riskManager.calculateATRStop(currentCandle.close, atr, 'BUY');
          const quantity = this.riskManager.calculatePositionSize(equity, finalSignal.price, stopLoss);

          finalSignal.quantity = quantity;
          finalSignal.stopLoss = stopLoss;
        } else {
          // Legacy / All-In Mode
          finalSignal.quantity = Infinity;
        }
      }

      // 3. Execute Signal in Portfolio
      this.portfolio.executeSignal(finalSignal, this.symbol, this.strategy.name);

      // 4. Record Equity Snapshot
      this.recordSnapshot(currentCandle, equityCurve);
    }

    const trades = this.portfolio.getState().trades;
    const metrics = this.analyzer.calculateMetrics(initialCapital, equityCurve, trades);

    return {
      initialCapital,
      finalCapital: equityCurve[equityCurve.length - 1].equity,
      metrics,
      trades,
      equityCurve
    };
  }

  private recordSnapshot(candle: Candle, curve: EquitySnapshot[]) {
    curve.push({
      timestamp: candle.time,
      cash: this.portfolio.getState().cash,
      equity: this.portfolio.getTotalValue(candle.close, this.symbol)
    });
  }
}
