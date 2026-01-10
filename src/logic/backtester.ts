import { Portfolio } from './portfolio';
import { Strategy, Candle, BacktestResult, EquitySnapshot, RiskConfig, Signal } from './types';
import { PerformanceAnalyzer } from './analysis';
import { RiskManager } from './risk/risk_manager';
import { calculateATR } from './indicators/atr';
import { SlippageModel, ZeroSlippage } from './slippage';

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
   */
  public run(candles: Candle[]): BacktestResult {
    if (candles.length === 0) {
      throw new Error('No candles provided for backtest');
    }

    const initialCapital = this.portfolio.getState().cash;
    const equityCurve: EquitySnapshot[] = [];
    let atrSeries: (number | null)[] = [];
    let highWaterMark = initialCapital;

    // Pre-calculate ATR if Risk Manager is enabled
    if (this.riskManager) {
      const period = this.riskManager.config.atrPeriod || 14;
      atrSeries = calculateATR(candles, period);
    }

    // Main Simulation Loop
    for (let i = 0; i < candles.length; i++) {
      const currentCandle = candles[i];

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
