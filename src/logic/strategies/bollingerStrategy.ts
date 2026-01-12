import { Candle, Signal, Strategy } from '../types';
import { calculateBollingerBands } from '../indicators/bollinger';
import { calculateMFI } from '../indicators/volume';

export interface BollingerMeanReversionConfig {
  bbPeriod: number;
  bbMultiplier: number;
  mfiPeriod: number;
  mfiBuyThreshold: number; // Oversold (e.g., 20)
  mfiSellThreshold: number; // Overbought (e.g., 80)
}

/**
 * Bollinger Mean Reversion Strategy (Volume Enhanced)
 * Logic:
 * - BUY when Price < Lower Band AND MFI < 20 (Price is cheap + Volume confirms oversold exhaustion).
 * - SELL when Price > Upper Band OR MFI > 80 (Price is expensive).
 */
export class BollingerMeanReversionStrategy implements Strategy {
  public readonly name = 'Bollinger Mean Reversion (Vol)';
  private config: BollingerMeanReversionConfig;

  constructor(config: Partial<BollingerMeanReversionConfig> = {}) {
    this.config = {
      bbPeriod: 20,
      bbMultiplier: 2,
      mfiPeriod: 14,
      mfiBuyThreshold: 20,
      mfiSellThreshold: 80,
      ...config
    };
  }

  analyze(candles: Candle[]): Signal {
    const lastCandle = candles[candles.length - 1];
    if (!lastCandle || candles.length < Math.max(this.config.bbPeriod, this.config.mfiPeriod)) {
      return {
        action: 'HOLD',
        price: lastCandle?.close || 0,
        timestamp: lastCandle?.time || new Date(),
        reason: 'Insufficient data'
      };
    }

    // Indicators
    const bb = calculateBollingerBands(candles, this.config.bbPeriod, this.config.bbMultiplier);
    const mfi = calculateMFI(candles, this.config.mfiPeriod);

    const currentLower = bb.lower[bb.lower.length - 1];
    const currentUpper = bb.upper[bb.upper.length - 1];
    const currentMfi = mfi[mfi.length - 1];

    if (currentLower === null || currentUpper === null || currentMfi === null) {
      return { action: 'HOLD', price: lastCandle.close, timestamp: lastCandle.time, reason: 'Warmup' };
    }

    // Logic
    
    // BUY
    if (lastCandle.close < currentLower && currentMfi < this.config.mfiBuyThreshold) {
      return {
        action: 'BUY',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `Price < LowerBB (${currentLower.toFixed(2)}) + MFI Oversold (${currentMfi.toFixed(1)})`
      };
    }

    // SELL
    // Exit if price hits upper band (Profit Target) OR MFI becomes overbought (Warning).
    // Note: Some MR strategies only sell on Upper Band. But MFI > 80 is a strong warning.
    
    if (lastCandle.close > currentUpper) {
      return {
        action: 'SELL',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `Price > UpperBB (${currentUpper.toFixed(2)})`
      };
    }

    if (currentMfi > this.config.mfiSellThreshold) {
      return {
        action: 'SELL',
        price: lastCandle.close,
        timestamp: lastCandle.time,
        reason: `MFI Overbought (${currentMfi.toFixed(1)})`
      };
    }

    return {
      action: 'HOLD',
      price: lastCandle.close,
      timestamp: lastCandle.time,
      reason: 'In range'
    };
  }
}
