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
