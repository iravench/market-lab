import { Candle, Signal, Strategy } from '../types';
import { calculateDonchianChannels } from '../indicators/donchian';
import { calculateSMA } from '../indicators/sma';

export interface VolatilityBreakoutConfig {
  donchianPeriod: number;
  volumeSmaPeriod: number;
  volumeMultiplier: number;
}

/**
 * Volatility Breakout Strategy
 * Logic:
 * - BUY when Price breaks above the previous N-day High.
 * - FILTER: Volume must be > 1.5x (default) the average volume.
 * - SELL when Price breaks below the previous N-day Low (Trailing Stop).
 * 
 * This strategy aims to capture explosive moves initiated by institutional conviction.
 */
export class VolatilityBreakoutStrategy implements Strategy {
  public readonly name = 'Volatility Breakout';
  private config: VolatilityBreakoutConfig;

  constructor(config: Partial<VolatilityBreakoutConfig> = {}) {
    this.config = {
      donchianPeriod: 20,
      volumeSmaPeriod: 20,
      volumeMultiplier: 1.5,
      ...config
    };
  }

  analyze(candles: Candle[]): Signal {
    const lastCandle = candles[candles.length - 1];
    // We need at least 1 previous candle to check for breakout of *previous* high
    if (!lastCandle || candles.length < Math.max(this.config.donchianPeriod, this.config.volumeSmaPeriod) + 1) {
      return {
        action: 'HOLD',
        price: lastCandle?.close || 0,
        timestamp: lastCandle?.time || new Date(),
        reason: 'Insufficient data'
      };
    }

    // Indicators
    const donchian = calculateDonchianChannels(candles, this.config.donchianPeriod);
    const volumes = candles.map(c => c.volume);
    const volumeSma = calculateSMA(volumes, this.config.volumeSmaPeriod);

    // Indices
    const idx = candles.length - 1;
    const prevIdx = idx - 1;

    const currentUpper = donchian.upper[idx];
    const currentLower = donchian.lower[idx];
    
    // IMPORTANT: Breakout is defined as breaking the *previous* period's channel.
    // If we use currentUpper, it includes current High, so Close can never be > currentUpper (unless gap?).
    // Donchian High[t] = Max(High t...t-n). So High[t] is always <= Upper[t].
    // Breakout logic: Close[t] > Upper[t-1].
    
    const prevUpper = donchian.upper[prevIdx];
    const prevLower = donchian.lower[prevIdx];
    const prevVolSma = volumeSma[prevIdx];

    if (prevUpper === null || prevLower === null || prevVolSma === null) {
      return { action: 'HOLD', price: lastCandle.close, timestamp: lastCandle.time, reason: 'Warmup' };
    }

    // Check Logic
    
    // BUY: Breakout + Volume Filter
    if (lastCandle.close > prevUpper) {
      // Check Volume
      // Volume of the *breakout candle* (current) should be high? Or previous?
      // Usually current candle (the one breaking out) needs conviction.
      if (lastCandle.volume > prevVolSma * this.config.volumeMultiplier) {
        return {
          action: 'BUY',
          price: lastCandle.close,
          timestamp: lastCandle.time,
          reason: `Breakout (Close ${lastCandle.close} > PrevHigh ${prevUpper}) + Vol (${lastCandle.volume} > ${this.config.volumeMultiplier}x Avg)`
        };
      } else {
        // Breakout but low volume - trap?
        // We might want to log this but action is HOLD.
        // reason: "Low volume breakout"
      }
    }

    // SELL: Breakdown (Exit)
    // No volume filter typically needed for exits (panic doesn't need volume confirmation, or we just want out).
    if (lastCandle.close < prevLower) {
      return {
        action: 'SELL',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `Breakdown (Close ${lastCandle.close} < PrevLow ${prevLower})`
      };
    }

    return {
      action: 'HOLD',
      price: lastCandle.close,
      timestamp: lastCandle.time,
      reason: 'Inside channel'
    };
  }
}
