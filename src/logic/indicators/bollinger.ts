import { Candle, IndicatorResult } from '../types';
import { calculateSMA } from './sma';
import { calculateStandardDeviation } from '../math';

export interface BollingerBandsResult {
  middle: IndicatorResult[];
  upper: IndicatorResult[];
  lower: IndicatorResult[];
}

/**
 * Calculates Bollinger Bands.
 * 
 * @param candles Array of Candle data
 * @param period Typically 20
 * @param multiplier Typically 2
 */
export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  multiplier: number = 2
): BollingerBandsResult {
  const prices = candles.map(c => c.close);
  const middle = calculateSMA(prices, period);

  const upper: IndicatorResult[] = new Array(prices.length).fill(null);
  const lower: IndicatorResult[] = new Array(prices.length).fill(null);

  for (let i = 0; i < prices.length; i++) {
    const start = i - period + 1;
    if (start >= 0) {
      const window = prices.slice(start, i + 1);
      const stdDev = calculateStandardDeviation(window);
      const sma = middle[i] as number;

      upper[i] = sma + (multiplier * stdDev);
      lower[i] = sma - (multiplier * stdDev);
    }
  }

  return {
    middle,
    upper,
    lower
  };
}
