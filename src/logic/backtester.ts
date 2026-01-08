import { Portfolio } from './portfolio';
import { Strategy, Candle, BacktestResult, EquitySnapshot } from './types';
import { PerformanceAnalyzer } from './analysis';

export class Backtester {
    private portfolio: Portfolio;
    private strategy: Strategy;
    private symbol: string;
    private analyzer: PerformanceAnalyzer;

    constructor(strategy: Strategy, portfolio: Portfolio, symbol: string) {
        this.strategy = strategy;
        this.portfolio = portfolio;
        this.symbol = symbol;
        this.analyzer = new PerformanceAnalyzer();
    }

    /**
     * Runs the simulation over the provided historical candles.
     */
    public run(candles: Candle[]): BacktestResult {
        if (candles.length === 0) {
            throw new Error('No candles provided for backtest');
        }

        const initialCapital = this.portfolio.getState().cash;
        const equityCurve: EquitySnapshot[] = [];

        // Main Simulation Loop
        for (let i = 0; i < candles.length; i++) {
            // "Current" window: all candles up to the current index
            // This prevents look-ahead bias as the strategy only sees past + current candle
            const visibleHistory = candles.slice(0, i + 1);
            const currentCandle = candles[i];

            // 1. Get Signal from Strategy
            const signal = this.strategy.analyze(visibleHistory);

            // 2. Execute Signal in Portfolio
            this.portfolio.executeSignal(signal, this.symbol);

            // 3. Record Equity Snapshot
            equityCurve.push({
                timestamp: currentCandle.time,
                cash: this.portfolio.getState().cash,
                equity: this.portfolio.getTotalValue(currentCandle.close, this.symbol)
            });
        }

        const trades = this.portfolio.getState().trades;
        const metrics = this.analyzer.calculateMetrics(initialCapital, equityCurve, trades);

        return {
            initialCapital,
            finalCapital: equityCurve[equityCurve.length - 1].equity,
            metrics,
            trades,
            equityCurve
        };
    }
}
