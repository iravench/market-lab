import { Portfolio } from './portfolio';
import { Strategy, Candle, BacktestResult, EquitySnapshot, RiskConfig, Signal } from './types';
import { PerformanceAnalyzer } from './analysis';
import { RiskManager } from './risk/risk_manager';
import { calculateATR } from './indicators/atr';

export class Backtester {
    private portfolio: Portfolio;
    private strategy: Strategy;
    private symbol: string;
    private analyzer: PerformanceAnalyzer;
    private riskManager?: RiskManager;

    constructor(
        strategy: Strategy, 
        portfolio: Portfolio, 
        symbol: string,
        riskConfig?: RiskConfig
    ) {
        this.strategy = strategy;
        this.portfolio = portfolio;
        this.symbol = symbol;
        this.analyzer = new PerformanceAnalyzer();
        if (riskConfig) {
            this.riskManager = new RiskManager(riskConfig);
        }
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
        let atrSeries: (number | null)[] = [];

        // Pre-calculate ATR if Risk Manager is enabled
        if (this.riskManager) {
            // @ts-ignore - accessing private config for simplicity or we add a getter
            const period = this.riskManager.config.atrPeriod || 14;
            atrSeries = calculateATR(candles, period);
        }

        // Main Simulation Loop
        for (let i = 0; i < candles.length; i++) {
            const currentCandle = candles[i];
            
            // 0. Risk Management: Check for existing position exits (Stop Loss / Take Profit)
            if (this.riskManager) {
                const position = this.portfolio.getState().positions.get(this.symbol);
                if (position) {
                    const exitReason = this.riskManager.checkExits(currentCandle, position);
                    if (exitReason) {
                        this.portfolio.sell(this.symbol, {
                            action: 'SELL',
                            price: exitReason === 'STOP_LOSS' ? position.stopLoss! : position.takeProfit!,
                            timestamp: currentCandle.time,
                            reason: exitReason
                        });
                        this.recordSnapshot(currentCandle, equityCurve);
                        continue; // Exit triggered, skip strategy analysis for this candle
                    }
                    
                    // Update Trailing Stop
                    const atr = atrSeries[i];
                    if (atr !== null && position.stopLoss) {
                        const newStop = this.riskManager.updateTrailingStop(
                            position.stopLoss, 
                            currentCandle.high, 
                            currentCandle.low, 
                            atr, 
                            'BUY'
                        );
                        position.stopLoss = newStop; 
                    }
                }
            }

            // "Current" window: all candles up to the current index
            const visibleHistory = candles.slice(0, i + 1);

            // 1. Get Signal from Strategy
            const rawSignal = this.strategy.analyze(visibleHistory);
            
            // 2. Enhance Signal with Quantity / Risk Params
            const finalSignal: Signal = { ...rawSignal };

            if (finalSignal.action === 'BUY') {
                const equity = this.portfolio.getTotalValue(currentCandle.close, this.symbol);
                const atr = atrSeries[i];
                
                if (this.riskManager && atr && atr > 0) {
                    const stopLoss = this.riskManager.calculateATRStop(currentCandle.close, atr, 'BUY');
                    const quantity = this.riskManager.calculatePositionSize(equity, currentCandle.close, stopLoss);
                    
                    finalSignal.quantity = quantity;
                    finalSignal.stopLoss = stopLoss;
                } else {
                    // Legacy / All-In Mode: Let Portfolio clip Infinity to max affordable
                    finalSignal.quantity = Infinity; 
                }
            }

            // 3. Execute Signal in Portfolio
            this.portfolio.executeSignal(finalSignal, this.symbol, this.strategy.name);

            // 4. Record Equity Snapshot
            this.recordSnapshot(currentCandle, equityCurve);
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

    private recordSnapshot(candle: Candle, curve: EquitySnapshot[]) {
        curve.push({
            timestamp: candle.time,
            cash: this.portfolio.getState().cash,
            equity: this.portfolio.getTotalValue(candle.close, this.symbol)
        });
    }
}
