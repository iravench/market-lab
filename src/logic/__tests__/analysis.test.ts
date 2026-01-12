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

  describe('calculateSortinoRatio', () => {
    it('should calculate Sortino ratio correctly', () => {
      // Curve: 100 -> 110 (+10%) -> 100 (-9.09%) -> 110 (+10%)
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 110, timestamp: new Date(), cash: 0 },
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 110, timestamp: new Date(), cash: 0 },
      ];
      const metrics = analyzer.calculateMetrics(100, curve, []);
      // Mean Return: ~0.0363
      // Downside Dev: ~0.0428
      // Sortino: ~13.47
      expect(metrics.sortinoRatio).toBeCloseTo(13.47, 1);
    });

    it('should return 0 for only positive returns', () => {
      const curve: EquitySnapshot[] = [
        { equity: 100, timestamp: new Date(), cash: 0 },
        { equity: 110, timestamp: new Date(), cash: 0 },
        { equity: 121, timestamp: new Date(), cash: 0 },
      ];
      // Negative returns: [0, 0]. StdDev = 0.
      const metrics = analyzer.calculateMetrics(100, curve, []);
      expect(metrics.sortinoRatio).toBe(0);
    });
  });

  describe('calculateCalmarRatio', () => {
    it('should calculate Calmar ratio correctly', () => {
      // Initial 100, Final 110 after 126 days (approx half year)
      // Annualized return should be roughly 21% ((1.1^2) - 1)
      const curve: EquitySnapshot[] = Array.from({ length: 126 }, (_, i) => ({
        equity: 100 + (i * 10 / 125),
        timestamp: new Date(),
        cash: 0
      }));
      // Max drawdown 10% (manual override to force a specific drawdown)
      // At i=60, equity is normally ~104.8. We set to 90.
      // Drawdown: (90 - 104.8) / 104.8 = ~-14.1%
      curve[60].equity = 90;

      const metrics = analyzer.calculateMetrics(100, curve, []);
      // Annualized Ret: ~21%
      // Max Drawdown: ~14.12%
      // Calmar: 21 / 14.12 = ~1.48
      expect(metrics.calmarRatio).toBeCloseTo(1.48, 1);
    });
  });

  describe('calculateExpectancy', () => {
    it('should calculate average PnL per trade', () => {
      const trades: Trade[] = [
        { action: 'SELL', realizedPnL: 100 } as Trade,
        { action: 'SELL', realizedPnL: -50 } as Trade,
      ];
      const metrics = analyzer.calculateMetrics(100, [], trades);
      expect(metrics.expectancy).toBe(25);
    });
  });

  describe('calculateSQN', () => {
    it('should calculate System Quality Number correctly', () => {
      // 10 trades, all winning 100
      const trades: Trade[] = Array.from({ length: 10 }, () => ({
        action: 'SELL',
        realizedPnL: 100
      } as Trade));
      const metrics = analyzer.calculateMetrics(100, [], trades);
      // StdDev of [100, 100, ...] is 0. SQN should be 0 (handled by our code)
      expect(metrics.sqn).toBe(0);

      // Mixed trades
      const mixedTrades: Trade[] = [
        { action: 'SELL', realizedPnL: 200 } as Trade,
        { action: 'SELL', realizedPnL: -100 } as Trade,
        { action: 'SELL', realizedPnL: 200 } as Trade,
        { action: 'SELL', realizedPnL: -100 } as Trade,
      ];
      // Mean: 50
      // StdDev: 150
      // SQN: sqrt(4) * (50 / 150) = 2 * 0.333 = 0.666
      const mixedMetrics = analyzer.calculateMetrics(100, [], mixedTrades);
      expect(mixedMetrics.sqn).toBeCloseTo(0.666, 2);
    });
  });
});
