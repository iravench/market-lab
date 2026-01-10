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
