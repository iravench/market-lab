import { Candle, IndicatorResult } from '../types';
import { calculateEMA } from './ema';

export interface MACDResult {
  macdLine: IndicatorResult[];
  signalLine: IndicatorResult[];
  histogram: IndicatorResult[];
}

/**
 * Calculates the Moving Average Convergence Divergence (MACD).
 * 
 * @param candles Array of Candle data
 * @param fastPeriod Typically 12
 * @param slowPeriod Typically 26
 * @param signalPeriod Typically 9
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const prices = candles.map(c => c.close);

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine: IndicatorResult[] = [];
  for (let i = 0; i < prices.length; i++) {
    const fast = fastEMA[i];
    const slow = slowEMA[i];

    if (fast === null || slow === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fast - slow);
    }
  }

  // Calculate Signal Line (EMA of MACD Line)
  // We must handle the leading nulls in macdLine
  const firstValidIndex = macdLine.findIndex(val => val !== null);

  let signalLine: IndicatorResult[] = new Array(prices.length).fill(null);
  let histogram: IndicatorResult[] = new Array(prices.length).fill(null);

  if (firstValidIndex !== -1) {
    const validMacdValues = macdLine.slice(firstValidIndex) as number[];
    const validSignalValues = calculateEMA(validMacdValues, signalPeriod);

    for (let i = 0; i < validSignalValues.length; i++) {
      const signalVal = validSignalValues[i];
      const macdVal = validMacdValues[i];
      const actualIndex = i + firstValidIndex;

      signalLine[actualIndex] = signalVal;

      if (signalVal !== null && macdVal !== null) {
        histogram[actualIndex] = macdVal - signalVal;
      }
    }
  }

  return {
    macdLine,
    signalLine,
    histogram
  };
}
