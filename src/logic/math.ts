/**
 * Calculates the arithmetic mean of a series.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculates the population standard deviation of a series.
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMean(values);
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Calculates the Pearson correlation coefficient between two series of numbers.
 * Returns a value between -1 and 1.
 * Returns 0 if arrays are empty or length mismatch.
 */
export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  if (seriesA.length === 0 || seriesB.length === 0 || seriesA.length !== seriesB.length) {
    return 0;
  }

  const n = seriesA.length;
  const meanA = calculateMean(seriesA);
  const meanB = calculateMean(seriesB);

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = seriesA[i] - meanA;
    const diffB = seriesB[i] - meanB;

    numerator += diffA * diffB;
    denominatorA += diffA * diffA;
    denominatorB += diffB * diffB;
  }

  const denominator = Math.sqrt(denominatorA) * Math.sqrt(denominatorB);

  if (denominator === 0) return 0; // Avoid division by zero if one series is constant

  return numerator / denominator;
}

/**
 * Calculates percentage returns from a series of prices.
 * returns[i] = (prices[i] - prices[i-1]) / prices[i-1]
 * returns[0] is always 0.
 */
export function calculateReturns(prices: number[]): number[] {
  const returns = new Array(prices.length).fill(0);
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns[i] = (prices[i] - prices[i - 1]) / prices[i - 1];
    }
  }
  return returns;
}

/**
 * Calculates the Kurtosis (Fourth Moment) of a distribution.
 * A measure of the "tailedness" of the probability distribution.
 * 
 * High Kurtosis (>3) = Fat Tails (Frequent extreme events).
 * Low Kurtosis (<3) = Thin Tails.
 * Normal Distribution = 3.
 * 
 * @param values Array of numbers (usually returns)
 */
export function calculateKurtosis(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const mean = calculateMean(values);
  
  // Calculate 2nd and 4th moments
  let numerator = 0;   // Sum((x-mean)^4)
  let denominator = 0; // Sum((x-mean)^2)

  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    const diffSq = diff * diff;
    
    numerator += diffSq * diffSq; // ^4
    denominator += diffSq;        // ^2
  }

  if (denominator === 0) return 0;

  // Kurtosis = (1/N * Sum(diff^4)) / ( (1/N * Sum(diff^2))^2 )
  //          = (1/N * Numerator) / (Variance^2)
  
  const m4 = numerator / n;
  const m2 = denominator / n; // Variance

  return m4 / (m2 * m2);
}

/**
 * Calculates the Kaufman Efficiency Ratio (KER).
 * A measure of trend efficiency (Noise-to-Signal ratio).
 * 
 * KER = |Directional Change| / Sum(|Individual Changes|)
 * Range: 0 (Pure Noise) to 1 (Perfect Efficiency).
 * 
 * @param prices Array of prices
 */
export function calculateKER(prices: number[]): number {
  if (prices.length < 2) return 0;

  const direction = Math.abs(prices[prices.length - 1] - prices[0]);
  let volatility = 0;

  for (let i = 1; i < prices.length; i++) {
    volatility += Math.abs(prices[i] - prices[i - 1]);
  }

  if (volatility === 0) return 0; // Should not happen unless prices are constant

  return direction / volatility;
}

/**
 * Calculates the Hurst Exponent (H) using Rescaled Range (R/S) Analysis.
 * Measures the long-term memory of a time series.
 * 
 * H = 0.5: Random Walk (Brownian Motion).
 * 0.5 < H < 1.0: Persistent (Trending behavior).
 * 0 < H < 0.5: Anti-persistent (Mean Reverting behavior).
 * 
 * @param data Array of numbers (usually prices)
 */
export function calculateHurstExponent(data: number[]): number {
  if (data.length < 10) return 0.5; // Not enough data

  // 1. Convert prices to log returns for stationarity
  // Actually, R/S is often done on returns or diffs, not raw prices (which are non-stationary).
  // Let's use simple diffs (returns)
  const returns: number[] = [];
  for(let i=1; i<data.length; i++) {
      returns.push(Math.log(data[i] / data[i-1]));
  }
  
  if (returns.length < 10) return 0.5;

  // 2. Define chunk sizes (powers of 2 or divisors)
  // We'll split the data into chunks of size N, N/2, N/4... until size < 8
  const minChunkSize = 8;
  const N = returns.length;
  
  const points: { x: number, y: number }[] = [];

  let chunkSize = N;
  
  while (chunkSize >= minChunkSize) {
    const numChunks = Math.floor(N / chunkSize);
    let avgRS = 0;

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const chunk = returns.slice(start, start + chunkSize);
      
      // R/S Calculation for this chunk
      const mean = calculateMean(chunk);
      
      // Calculate Mean-Adjusted Series & StdDev
      let sumSqDiff = 0;
      const adjusted: number[] = [];
      
      for(const val of chunk) {
          const diff = val - mean;
          adjusted.push(diff);
          sumSqDiff += diff * diff;
      }
      
      // StdDev (S) - using sample std dev (N-1) or pop (N)? 
      // R/S usually uses standard deviation formula.
      const stdDev = Math.sqrt(sumSqDiff / chunk.length);
      
      if (stdDev === 0) continue; // Skip flat chunks

      // Cumulative Deviate Series (Z)
      let currentZ = 0;
      let maxZ = -Infinity;
      let minZ = Infinity;
      
      for(const adj of adjusted) {
          currentZ += adj;
          if (currentZ > maxZ) maxZ = currentZ;
          if (currentZ < minZ) minZ = currentZ;
      }
      
      // Range (R)
      const range = maxZ - minZ;
      
      // RS
      avgRS += (range / stdDev);
    }
    
    if (numChunks > 0 && avgRS > 0) {
      avgRS /= numChunks;
      points.push({ x: Math.log(chunkSize), y: Math.log(avgRS) });
    }
    
    chunkSize = Math.floor(chunkSize / 2);
  }

  // 3. Linear Regression (Least Squares) on log-log plot
  // Slope = Hurst Exponent
  if (points.length < 2) return 0.5;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const count = points.length;

  for(const p of points) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
  }

  const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
  
  return slope;
}