/**
 * A generic recursive moving average function that covers both EMA and Wilder's Smoothing.
 * 
 * Formula:
 * MA_t = (Data_t * k) + (MA_t-1 * (1 - k))
 * 
 * The first value is typically a Simple Moving Average (SMA) of the first 'period' elements.
 * 
 * @param data Array of numbers to smooth
 * @param period Smoothing window
 * @param k Smoothing factor (e.g., 2/(period+1) for EMA, or 1/period for Wilder's)
 */
export function calculateRecursiveMA(data: number[], period: number, k: number): (number | null)[] {
  const result: (number | null)[] = [];

  if (data.length < period) {
    return data.map(() => null);
  }

  let prev: number = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // Initial seed: SMA
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += data[j];
      }
      prev = sum / period;
      result.push(prev);
    } else {
      // Recursive smoothing: (Price * k) + (Prev * (1 - k))
      const val = (data[i] * k) + (prev * (1 - k));
      result.push(val);
      prev = val;
    }
  }

  return result;
}

/**
 * Applies Wilder's Smoothing (Modified Moving Average).
 * $k = 1 / period$
 */
export function wildersSmoothing(data: number[], period: number): (number | null)[] {
  return calculateRecursiveMA(data, period, 1 / period);
}

/**
 * Standard Exponential Moving Average.
 * $k = 2 / (period + 1)$
 */
export function exponentialMovingAverage(data: number[], period: number): (number | null)[] {
  return calculateRecursiveMA(data, period, 2 / (period + 1));
}
