import { wildersSmoothing } from './smoothing';

/**
 * Calculates the Relative Strength Index (RSI).
 * Uses Wilder's Smoothing technique.
 * 
 * @param values Array of closing prices
 * @param period Standard period is usually 14
 */
export function calculateRSI(values: number[], period: number = 14): (number | null)[] {
  if (values.length < period + 1) {
    return values.map(() => null);
  }

  // 1. Calculate Gains and Losses
  // Note: changes[i] corresponds to price at values[i+1]
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  // 2. Smooth Gains and Losses
  const avgGains = wildersSmoothing(gains, period);
  const avgLosses = wildersSmoothing(losses, period);

  // 3. Calculate RSI
  const rsiArray: (number | null)[] = [];

  // Align with original values array
  // The first price (index 0) has no change, so it's always null.
  rsiArray.push(null);

  for (let i = 0; i < avgGains.length; i++) {
    const gain = avgGains[i];
    const loss = avgLosses[i];

    if (gain === null || loss === null) {
      rsiArray.push(null);
    } else {
      if (loss === 0) {
        rsiArray.push(100);
      } else {
        const rs = gain / loss;
        const rsi = 100 - (100 / (1 + rs));
        rsiArray.push(rsi);
      }
    }
  }

  return rsiArray;
}
