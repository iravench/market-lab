import { Candle, Position, RiskConfig, SignalAction, Trade } from '../types';
import { calculateADX } from '../indicators/adx';
import { calculateCorrelation } from '../math';

export class RiskManager {
  public config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  /**
   * Calculates the position size based on the "Risk Unit" logic.
   * Formula: Units = (Equity * Risk%) / (Entry - Stop)
   */
  public calculatePositionSize(
    equity: number,
    entryPrice: number,
    stopLossPrice: number
  ): number {
    const riskAmount = equity * this.config.riskPerTradePct;
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);

    if (riskPerShare === 0) return 0;

    return Math.floor(riskAmount / riskPerShare);
  }

  /**
   * Calculates an ATR-based stop loss price.
   */
  public calculateATRStop(
    entryPrice: number,
    atr: number,
    action: SignalAction
  ): number {
    const distance = atr * this.config.atrMultiplier;
    return action === 'BUY'
      ? entryPrice - distance
      : entryPrice + distance;
  }

  /**
   * Updates a trailing stop (Chandelier Exit style).
   * The stop only moves in the direction of the trade.
   */
  public updateTrailingStop(
    currentStop: number,
    currentHigh: number, // or Low for shorts
    currentLow: number,
    atr: number,
    action: SignalAction
  ): number {
    if (!this.config.trailingStop) return currentStop;

    const distance = atr * this.config.atrMultiplier;

    if (action === 'BUY') {
      const newPotentialStop = currentHigh - distance;
      return Math.max(currentStop, newPotentialStop);
    } else {
      const newPotentialStop = currentLow + distance;
      return Math.min(currentStop, newPotentialStop);
    }
  }

  /**
   * Checks if the Maximum Drawdown limit has been breached.
   * @param currentEquity Current total portfolio value
   * @param highWaterMark Highest equity value seen so far
   * @returns true if drawdown limit is breached
   */
  public checkDrawdown(currentEquity: number, highWaterMark: number): boolean {
    if (highWaterMark <= 0) return false;

    const drawdown = (currentEquity - highWaterMark) / highWaterMark;
    // maxDrawdownPct is positive (e.g. 0.1 for 10%)
    // drawdown is negative (e.g. -0.15)
    // Breach if drawdown < -maxDrawdownPct
    return drawdown < -this.config.maxDrawdownPct;
  }

  /**
   * Checks if any risk-based exit conditions are met.
   */
  public checkExits(candle: Candle, position: Position): 'STOP_LOSS' | 'TAKE_PROFIT' | null {
    // Check Stop Loss
    if (position.stopLoss) {
      // For a Long position (quantity > 0)
      if (position.quantity > 0 && candle.low <= position.stopLoss) {
        return 'STOP_LOSS';
      }
      // For a Short position (not fully supported yet, but for completeness)
      if (position.quantity < 0 && candle.high >= position.stopLoss) {
        return 'STOP_LOSS';
      }
    }

    // Check Take Profit
    if (position.takeProfit) {
      if (position.quantity > 0 && candle.high >= position.takeProfit) {
        return 'TAKE_PROFIT';
      }
      if (position.quantity < 0 && candle.low <= position.takeProfit) {
        return 'TAKE_PROFIT';
      }
    }

    return null;
  }

  /**
   * Regime Detection: Checks if the market is trending based on ADX.
   * If ADX is below the threshold, the market is "choppy".
   */
  public isMarketTrending(candles: Candle[]): boolean {
    const threshold = this.config.adxThreshold ?? 25;
    const period = this.config.adxPeriod ?? 14;

    if (candles.length < period * 2) return true; // Not enough data, assume trending to avoid blocking signals prematurely

    const adxValues = calculateADX(candles, period);
    const currentAdx = adxValues[adxValues.length - 1];

    if (currentAdx === null) return true;

    return currentAdx >= threshold;
  }

  /**
   * Portfolio Guard: Checks if the daily loss limit has been breached.
   * @param trades List of all trades
   * @param startingEquity Equity at the start of the current day
   * @param today Date representing the current day
   */
  public checkDailyLoss(trades: Trade[], startingEquity: number, today: Date): boolean {
    if (!this.config.dailyLossLimitPct || startingEquity <= 0) return false;

    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate total realized PnL for today
    const dailyPnL = trades
      .filter(t => t.timestamp.toISOString().split('T')[0] === todayStr)
      .reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

    const dailyReturnPct = dailyPnL / startingEquity;

    // Breach if loss (negative return) is more than the limit
    return dailyReturnPct <= -this.config.dailyLossLimitPct;
  }

  /**
   * Portfolio Guard: Correlation Check.
   * Checks if the candidate asset is highly correlated with any existing position.
   * 
   * @param candidateReturns Array of percentage returns for the candidate asset
   * @param portfolioReturns Map of symbol -> array of percentage returns for existing positions
   * @returns true if correlation limit is breached (i.e. too correlated)
   */
  public checkCorrelation(
    candidateReturns: number[],
    portfolioReturns: Map<string, number[]>
  ): boolean {
    const limit = this.config.maxCorrelation || 0.7;

    for (const [symbol, existingReturns] of portfolioReturns) {
      const correlation = calculateCorrelation(candidateReturns, existingReturns);
      if (correlation > limit) {
        return true; // Breached
      }
    }

    return false;
  }
}
