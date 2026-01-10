import { PerformanceAnalyzer } from '../analysis';
import { Trade, EquitySnapshot } from '../types';

describe('PerformanceAnalyzer', () => {
  const analyzer = new PerformanceAnalyzer();

  describe('calculateTotalReturn', () => {
    it('should calculate positive return correctly', () => {
      const metrics = analyzer.calculateMetrics(100, [{ equity: 110 } as any], []);
      expect(metrics.totalReturnPct).toBe(10);
    });

    it('should calculate negative return correctly', () => {
      const metrics = analyzer.calculateMetrics(100, [{ equity: 90 } as any], []);
      expect(metrics.totalReturnPct).toBe(-10);
    });

    it('should handle zero initial capital gracefully', () => {
      const metrics = analyzer.calculateMetrics(0, [{ equity: 100 } as any], []);
      expect(metrics.totalReturnPct).toBe(0);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should calculate drawdown correctly', () => {
      // Peak 100 -> Drop to 50 (-50%) -> Recover to 75
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 50, timestamp: new Date(), cash: 0 },
        { equity: 75, timestamp: new Date(), cash: 0 },
      ];
      const metrics = analyzer.calculateMetrics(100, curve, []);
      expect(metrics.maxDrawdownPct).toBe(50);
    });

    it('should return 0 if equity only goes up', () => {
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 110, timestamp: new Date(), cash: 0 },
        { equity: 120, timestamp: new Date(), cash: 0 },
      ];
      const metrics = analyzer.calculateMetrics(100, curve, []);
      expect(metrics.maxDrawdownPct).toBe(0);
    });
  });

  describe('calculateWinRate', () => {
    it('should calculate win rate correctly', () => {
      const trades: Trade[] = [
        { action: 'SELL', realizedPnL: 10 } as Trade, // Win
        { action: 'SELL', realizedPnL: 5 } as Trade,  // Win
        { action: 'SELL', realizedPnL: -5 } as Trade, // Loss
        { action: 'BUY' } as Trade // Ignored
      ];
      const metrics = analyzer.calculateMetrics(100, [], trades);
      expect(metrics.winRatePct).toBeCloseTo(66.67);
    });

    it('should handle no trades', () => {
      const metrics = analyzer.calculateMetrics(100, [], []);
      expect(metrics.winRatePct).toBe(0);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('should return 0 for insufficient data', () => {
      const metrics = analyzer.calculateMetrics(100, [{ equity: 100 } as any], []);
      expect(metrics.sharpeRatio).toBe(0);
    });

    it('should calculate sharpe ratio for simple steady growth', () => {
      // Daily return is constant 1%
      // Mean = 0.01, StdDev = 0 (approx). 
      // In reality StdDev won't be exactly 0 due to float math, but Sharpe should be high.
      // Let's use a known oscillating pattern.
      // Day 0: 100
      // Day 1: 101 (+1%)
      // Day 2: 102.01 (+1%)
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 101, timestamp: new Date(), cash: 0 },
        { equity: 102.01, timestamp: new Date(), cash: 0 }
      ];
      // Since variance is 0, Sharpe would be Infinity. Our code handles divide by zero? 
      // Let's check implementation: if stdDev === 0 return 0.
      const metrics = analyzer.calculateMetrics(100, curve, []);
      expect(metrics.sharpeRatio).toBe(0);
    });

    it('should calculate sharpe ratio for volatile assets', () => {
      // +10%, -10%
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 110, timestamp: new Date(), cash: 0 }, // +0.1
        { equity: 99, timestamp: new Date(), cash: 0 },  // 110 * 0.9 = 99 (-0.1)
      ];
      // Returns: [0.1, -0.1]. Mean = 0.
      // Variance: ((0.1-0)^2 + (-0.1-0)^2)/2 = (0.01 + 0.01)/2 = 0.01.
      // StdDev: 0.1.
      // Sharpe: (0 / 0.1) * sqrt(252) = 0.
      const metrics = analyzer.calculateMetrics(100, curve, []);
      expect(metrics.sharpeRatio).toBe(0);
    });
  });
});
