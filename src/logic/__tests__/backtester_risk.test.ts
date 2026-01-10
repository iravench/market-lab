import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { Strategy, Candle, Signal, RiskConfig } from '../types';

class MockStrategy implements Strategy {
    public name = 'Mock Strategy';
    public nextAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    analyze(candles: Candle[]): Signal {
        const last = candles[candles.length - 1];
        return { action: this.nextAction, price: last.close, timestamp: last.time };
    }
}

function createCandles(data: {h: number, l: number, c: number}[]): Candle[] {
    return data.map((d, i) => ({
        time: new Date(2023, 0, i + 1),
        open: d.c,
        high: d.h,
        low: d.l,
        close: d.c,
        volume: 1000
    }));
}

describe('Backtester with Risk Management', () => {
    const riskConfig: RiskConfig = {
        riskPerTradePct: 0.01, // 1% ($100 risk on $10000)
        maxDrawdownPct: 0.1,
        atrMultiplier: 2.0,
        atrPeriod: 3,
        trailingStop: true
    };

    it('should apply risk-based sizing and ATR stops', () => {
        const portfolio = new Portfolio(10000);
        const strategy = new MockStrategy();
        const backtester = new Backtester(strategy, portfolio, 'AAPL', riskConfig);

        const candles = createCandles([
            { h: 110, l: 100, c: 105 }, // 0
            { h: 115, l: 105, c: 110 }, // 1
            { h: 120, l: 110, c: 115 }, // 2
        ]);

        // Trigger BUY only on candle 2 (Index 2)
        strategy.analyze = (c) => {
            if (c.length === 3) return { action: 'BUY', price: 115, timestamp: c[2].time };
            return { action: 'HOLD', price: c[c.length-1].close, timestamp: c[c.length-1].time };
        };
        
        const result = backtester.run(candles);
        const trade = result.trades[0];
        
        expect(trade.quantity).toBe(5);
        expect(portfolio.getState().positions.get('AAPL')?.stopLoss).toBe(95);
    });

    it('should exit on Stop Loss', () => {
        const portfolio = new Portfolio(10000);
        const strategy = new MockStrategy();
        const backtester = new Backtester(strategy, portfolio, 'AAPL', riskConfig);

        const candles = createCandles([
            { h: 110, l: 100, c: 105 }, // 0
            { h: 110, l: 100, c: 105 }, // 1
            { h: 110, l: 100, c: 105 }, // 2 BUY here (Price 105, ATR 10, Stop 85)
            { h: 110, l: 80,  c: 90  }, // 3 STOP HIT (Low 80 < Stop 85)
        ]);

        strategy.analyze = (c) => {
            if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
            return { action: 'HOLD', price: c[c.length-1].close, timestamp: c[c.length-1].time };
        };

        const result = backtester.run(candles);
        
        expect(result.trades.length).toBe(2); // BUY and SELL
        expect(result.trades[1].action).toBe('SELL');
        expect(result.trades[1].price).toBe(85); // Sold at stop price
    });

    it('should update Trailing Stop', () => {
        const portfolio = new Portfolio(10000);
        const strategy = new MockStrategy();
        const backtester = new Backtester(strategy, portfolio, 'AAPL', riskConfig);

        const candles = createCandles([
            { h: 110, l: 100, c: 105 }, // 0
            { h: 110, l: 100, c: 105 }, // 1
            { h: 110, l: 100, c: 105 }, // 2 BUY (Price 105, Stop 85)
            { h: 120, l: 115, c: 118 }, // 3 Price up. High 120, ATR 10 -> New stop 120 - 20 = 100.
        ]);

        strategy.analyze = (c) => {
            if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
            return { action: 'HOLD', price: c[c.length-1].close, timestamp: c[c.length-1].time };
        };

        const result = backtester.run(candles);
        
        const pos = portfolio.getState().positions.get('AAPL');
        expect(pos?.stopLoss).toBeCloseTo(96.66, 1);
    });
});