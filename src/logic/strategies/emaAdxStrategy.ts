import { Candle, Signal, Strategy } from '../types';
import { calculateEMA } from '../indicators/ema';
import { calculateADX } from '../indicators/adx';

export interface EmaAdxStrategyConfig {
  fastPeriod: number;
  slowPeriod: number;
  adxPeriod: number;
  adxThreshold: number;
}

/**
 * Trend-Following Strategy using EMA Crossover and ADX Filter.
 * logic:
 * - BUY when fast EMA crosses above slow EMA AND ADX is above threshold (trending).
 * - SELL when fast EMA crosses below slow EMA.
 */
export class EmaAdxStrategy implements Strategy {
  public readonly name = 'EMA-ADX Trend Follower';
  private config: EmaAdxStrategyConfig;

  constructor(config: Partial<EmaAdxStrategyConfig> = {}) {
    this.config = {
      fastPeriod: 9,
      slowPeriod: 21,
      adxPeriod: 14,
      adxThreshold: 25,
      ...config
    };
  }

  analyze(candles: Candle[]): Signal {
    const lastCandle = candles[candles.length - 1];
    if (!lastCandle || candles.length < this.config.slowPeriod + this.config.adxPeriod) {
      return { action: 'HOLD', price: lastCandle?.close || 0, timestamp: lastCandle?.time || new Date(), reason: 'Insufficient data' };
    }

    const closes = candles.map(c => c.close);
    
    // 1. Calculate Indicators
    const fastEma = calculateEMA(closes, this.config.fastPeriod);
    const slowEma = calculateEMA(closes, this.config.slowPeriod);
    const adxResults = calculateADX(candles, this.config.adxPeriod);

    const currentFast = fastEma[fastEma.length - 1];
    const prevFast = fastEma[fastEma.length - 2];
    const currentSlow = slowEma[slowEma.length - 1];
    const prevSlow = slowEma[slowEma.length - 2];
    const currentAdx = adxResults[adxResults.length - 1];

    if (currentFast === null || currentSlow === null || currentAdx === null || prevFast === null || prevSlow === null) {
      return { action: 'HOLD', price: lastCandle.close, timestamp: lastCandle.time, reason: 'Indicator warmup' };
    }

    // 2. Logic
    const isTrending = currentAdx > this.config.adxThreshold;
    const bullishCross = prevFast <= prevSlow && currentFast > currentSlow;
    const bearishCross = prevFast >= prevSlow && currentFast < currentSlow;

    if (bullishCross && isTrending) {
      return {
        action: 'BUY',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `EMA Cross (${this.config.fastPeriod}/${this.config.slowPeriod}) + Strong Trend (ADX: ${currentAdx.toFixed(2)})`
      };
    }

    if (bearishCross) {
      return {
        action: 'SELL',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `EMA Bearish Cross (${this.config.fastPeriod}/${this.config.slowPeriod})`
      };
    }

    return {
      action: 'HOLD',
      price: lastCandle.close,
      timestamp: lastCandle.time,
      reason: 'No crossover'
    };
  }
}
