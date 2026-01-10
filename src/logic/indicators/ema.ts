import { exponentialMovingAverage } from './smoothing';

/**
 * Calculates the Exponential Moving Average (EMA).
 * Reacts faster to recent price changes than SMA.
 * 
 * @param values Array of prices
 * @param period Window size
 */
export function calculateEMA(values: number[], period: number): (number | null)[] {
  return exponentialMovingAverage(values, period);
}
