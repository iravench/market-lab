import { EquitySnapshot, Trade, BacktestMetrics } from './types';
import { calculateMean, calculateStandardDeviation } from './math';

export class PerformanceAnalyzer {

  public calculateMetrics(
    initialCapital: number,
    equityCurve: EquitySnapshot[],
    trades: Trade[]
  ): BacktestMetrics {
    const finalCapital = equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : initialCapital;

    const totalReturnPct = this.calculateTotalReturn(initialCapital, finalCapital);
    const maxDrawdownPct = this.calculateMaxDrawdown(equityCurve);
    const days = equityCurve.length;
    const annualizedReturnPct = this.calculateAnnualizedReturn(initialCapital, finalCapital, days);

    return {
      totalReturnPct,
      maxDrawdownPct,
      sharpeRatio: this.calculateSharpeRatio(equityCurve),
      sortinoRatio: this.calculateSortinoRatio(equityCurve),
      calmarRatio: this.calculateCalmarRatio(annualizedReturnPct, maxDrawdownPct),
      expectancy: this.calculateExpectancy(trades),
      sqn: this.calculateSQN(trades),
      winRatePct: this.calculateWinRate(trades),
      tradeCount: trades.length
    };
  }

  private calculateTotalReturn(initial: number, final: number): number {
    if (initial === 0) return 0;
    return ((final - initial) / initial) * 100;
  }

  private calculateAnnualizedReturn(initial: number, final: number, days: number): number {
    if (initial === 0 || days === 0) return 0;
    const totalReturn = final / initial;
    // Assume 252 trading days in a year
    const years = days / 252;
    return (Math.pow(totalReturn, 1 / years) - 1) * 100;
  }

  private calculateMaxDrawdown(equityCurve: EquitySnapshot[]): number {
    let maxDrawdown = 0;
    let peak = -Infinity;

    for (const snapshot of equityCurve) {
      if (snapshot.equity > peak) {
        peak = snapshot.equity;
      }

      const drawdown = (snapshot.equity - peak) / peak;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return Math.abs(maxDrawdown * 100);
  }

  private calculateSharpeRatio(equityCurve: EquitySnapshot[]): number {
    if (equityCurve.length < 2) return 0;

    const returns: number[] = this.calculateDailyReturns(equityCurve);
    if (returns.length === 0) return 0;

    const mean = calculateMean(returns);
    const stdDev = calculateStandardDeviation(returns);

    if (stdDev < 1e-9) return 0;

    return (mean / stdDev) * Math.sqrt(252);
  }

  private calculateSortinoRatio(equityCurve: EquitySnapshot[]): number {
    if (equityCurve.length < 2) return 0;

    const returns: number[] = this.calculateDailyReturns(equityCurve);
    if (returns.length === 0) return 0;

    const mean = calculateMean(returns);
    const negativeReturns = returns.map(r => Math.min(0, r));
    const downsideDev = calculateStandardDeviation(negativeReturns);

    if (downsideDev < 1e-9) return 0;

    return (mean / downsideDev) * Math.sqrt(252);
  }

  private calculateCalmarRatio(annualizedReturnPct: number, maxDrawdownPct: number): number {
    if (maxDrawdownPct === 0) return 0;
    return annualizedReturnPct / maxDrawdownPct;
  }

  private calculateExpectancy(trades: Trade[]): number {
    const closedTrades = trades.filter(t => t.action === 'SELL' && t.realizedPnL !== undefined);
    if (closedTrades.length === 0) return 0;

    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    return totalPnL / closedTrades.length;
  }

  private calculateSQN(trades: Trade[]): number {
    const closedTrades = trades.filter(t => t.action === 'SELL' && t.realizedPnL !== undefined);
    if (closedTrades.length < 2) return 0;

    const pnls = closedTrades.map(t => t.realizedPnL || 0);
    const mean = calculateMean(pnls);
    const stdDev = calculateStandardDeviation(pnls);

    if (stdDev < 1e-9) return 0;

    return Math.sqrt(closedTrades.length) * (mean / stdDev);
  }

  private calculateDailyReturns(equityCurve: EquitySnapshot[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev === 0) continue;
      returns.push((curr - prev) / prev);
    }
    return returns;
  }

  private calculateWinRate(trades: Trade[]): number {
    const sellTrades = trades.filter(t => t.action === 'SELL' && t.realizedPnL !== undefined);

    if (sellTrades.length === 0) return 0;

    const winningTrades = sellTrades.filter(t => (t.realizedPnL as number) > 0);

    return (winningTrades.length / sellTrades.length) * 100;
  }
}
