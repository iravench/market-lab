import { EquitySnapshot, Trade, BacktestMetrics } from './types';

export class PerformanceAnalyzer {
    
    public calculateMetrics(
        initialCapital: number, 
        equityCurve: EquitySnapshot[], 
        trades: Trade[]
    ): BacktestMetrics {
        const finalCapital = equityCurve.length > 0 
            ? equityCurve[equityCurve.length - 1].equity 
            : initialCapital;

        return {
            totalReturnPct: this.calculateTotalReturn(initialCapital, finalCapital),
            maxDrawdownPct: this.calculateMaxDrawdown(equityCurve),
            sharpeRatio: this.calculateSharpeRatio(equityCurve),
            winRatePct: this.calculateWinRate(trades),
            tradeCount: trades.length
        };
    }

    private calculateTotalReturn(initial: number, final: number): number {
        if (initial === 0) return 0;
        return ((final - initial) / initial) * 100;
    }

    private calculateMaxDrawdown(equityCurve: EquitySnapshot[]): number {
        let maxDrawdown = 0;
        let peak = -Infinity;

        for (const snapshot of equityCurve) {
            if (snapshot.equity > peak) {
                peak = snapshot.equity;
            }

            const drawdown = (snapshot.equity - peak) / peak;
            // drawdown is negative (or 0). We want the magnitude (e.g. -0.20 -> 20%)
            if (drawdown < maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return Math.abs(maxDrawdown * 100);
    }

    private calculateSharpeRatio(equityCurve: EquitySnapshot[]): number {
        if (equityCurve.length < 2) return 0;

        // 1. Calculate Daily Returns
        const returns: number[] = [];
        for (let i = 1; i < equityCurve.length; i++) {
            const prev = equityCurve[i - 1].equity;
            const curr = equityCurve[i].equity;
            if (prev === 0) continue;
            returns.push((curr - prev) / prev);
        }

        if (returns.length === 0) return 0;

        // 2. Mean and StdDev
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev < 1e-9) return 0;

        // 3. Annualize (Assuming daily data)
        // Sharpe = (Mean - RiskFree) / StdDev * sqrt(252)
        // We assume RiskFree = 0 for simplicity
        return (mean / stdDev) * Math.sqrt(252);
    }

    private calculateWinRate(trades: Trade[]): number {
        const sellTrades = trades.filter(t => t.action === 'SELL' && t.realizedPnL !== undefined);
        
        if (sellTrades.length === 0) return 0;

        const winningTrades = sellTrades.filter(t => (t.realizedPnL as number) > 0);
        
        return (winningTrades.length / sellTrades.length) * 100;
    }
}
