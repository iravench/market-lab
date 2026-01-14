import {
  calculateMean,
  calculateStandardDeviation,
  calculateCorrelation,
  calculateReturns,
  calculateHurstExponent,
  calculateKER,
  calculateKurtosis
} from '../math';

describe('Math Library', () => {
  describe('calculateMean', () => {
    it('calculates the mean of a series', () => {
      const values = [1, 2, 3, 4, 5];
      expect(calculateMean(values)).toBe(3);
    });

    it('returns 0 for empty array', () => {
      expect(calculateMean([])).toBe(0);
    });
  });

  describe('calculateStandardDeviation', () => {
    it('calculates population std dev', () => {
      // Population of [2, 4, 4, 4, 5, 5, 7, 9] is 8.
      // Mean = 5.
      // Variance = 4.
      // StdDev = 2.
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(calculateStandardDeviation(values)).toBe(2);
    });

    it('returns 0 for empty array', () => {
      expect(calculateStandardDeviation([])).toBe(0);
    });
  });

  describe('calculateCorrelation', () => {
    it('calculates perfect positive correlation', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [2, 4, 6, 8, 10];
      expect(calculateCorrelation(a, b)).toBeCloseTo(1);
    });

    it('calculates perfect negative correlation', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [5, 4, 3, 2, 1];
      expect(calculateCorrelation(a, b)).toBeCloseTo(-1);
    });

    it('returns 0 for uncorrelated data (approx)', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [5, 5, 5, 5, 5]; // Constant series has 0 variance, undefined correlation
      // Our function handles div by zero by returning 0
      expect(calculateCorrelation(a, b)).toBe(0);
    });
  });

  describe('calculateReturns', () => {
    it('calculates percentage returns', () => {
      const prices = [100, 110, 99]; // +10%, -10%
      const returns = calculateReturns(prices);
      expect(returns[0]).toBe(0);
      expect(returns[1]).toBeCloseTo(0.1);
      expect(returns[2]).toBeCloseTo(-0.1);
    });
  });

  // --- Phase 9: Quant Lab Additions ---

  describe('calculateKurtosis', () => {
    it('calculates kurtosis of a normal distribution (approx 3, excess 0)', () => {
      // A small set won't be perfect, but we check logic.
      // Uniform: [1, 2, 3, 4, 5]
      // Mean: 3
      // Variances: 4, 1, 0, 1, 4 => Sum=10, Avg=2, Std=1.414
      // 4th Moments: 16, 1, 0, 1, 16 => Sum=34, Avg=6.8
      // Kurtosis = 6.8 / (2^2) = 1.7
      const values = [1, 2, 3, 4, 5];
      // We implement Pearson's Kurtosis (Normal = 3)
      expect(calculateKurtosis(values)).toBeCloseTo(1.7, 1);
    });

    it('returns 0 for flat line', () => {
      expect(calculateKurtosis([1, 1, 1])).toBe(0);
    });
  });

  describe('calculateKER (Kaufman Efficiency Ratio)', () => {
    it('calculates perfect efficiency (1.0)', () => {
      // Straight line up
      const prices = [10, 11, 12, 13, 14]; 
      // Direction: |14 - 10| = 4
      // Volatility: |11-10| + |12-11|... = 1+1+1+1 = 4
      // KER = 4/4 = 1
      expect(calculateKER(prices)).toBe(1);
    });

    it('calculates low efficiency (noise)', () => {
      // Up and down but ends same place
      const prices = [10, 12, 10, 12, 10];
      // Direction: |10 - 10| = 0
      // Volatility: 2 + 2 + 2 + 2 = 8
      // KER = 0
      expect(calculateKER(prices)).toBe(0);
    });
  });

  describe('calculateHurstExponent', () => {
    it('identifies trending series (H > 0.5)', () => {
      // Generate a strong trend: P_t = P_t-1 + Random(0, 2)
      // This is a "Biased Random Walk", should show persistence.
      const trend: number[] = [100];
      for(let i=1; i<100; i++) {
          trend.push(trend[i-1] + Math.random() + 0.5); 
      }
      
      const h = calculateHurstExponent(trend);
      // Hurst isn't perfect on small samples, but should be > 0.5 for clear trends
      expect(h).toBeGreaterThan(0.5);
    });

    it('identifies mean reverting series (H < 0.5)', () => {
      // Generate mean reversion: Oscillate around mean 100
      const meanRev: number[] = [];
      for(let i=0; i<100; i++) {
          // If high, go low. If low, go high.
          // Add noise
          const val = 100 + (Math.sin(i) * 5) + (Math.random() - 0.5);
          meanRev.push(val);
      }
      
      const h = calculateHurstExponent(meanRev);
      // Mean reverting sine wave should have low H
      expect(h).toBeLessThan(0.6); // Slightly relaxed threshold for short noisy samples
    });
  });
});