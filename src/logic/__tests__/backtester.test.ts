import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { Strategy, Candle, Signal } from '../types';

// A simple strategy that buys once and never sells
class BuyAndHoldStrategy implements Strategy {
    public readonly name = 'Buy and Hold';
    private hasBought = false;

    analyze(candles: Candle[]): Signal {
        const lastCandle = candles[candles.length - 1];
        if (!this.hasBought) {
            this.hasBought = true;
            return { action: 'BUY', price: lastCandle.close, timestamp: lastCandle.time };
        }
        return { action: 'HOLD', price: lastCandle.close, timestamp: lastCandle.time };
    }
}

function createCandles(prices: number[]): Candle[] {
    return prices.map((price, i) => ({
        time: new Date(2023, 0, i + 1),
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1000
    }));
}

describe('Backtester', () => {
    it('should run a simulation and return results', () => {
        const initialCash = 10000;
        const portfolio = new Portfolio(initialCash);
        const strategy = new BuyAndHoldStrategy();
        const backtester = new Backtester(strategy, portfolio, 'TEST');

        // Price goes 100 -> 110 -> 120
        const candles = createCandles([100, 110, 120]);
        const result = backtester.run(candles);

        expect(result.initialCapital).toBe(initialCash);
        // Buy 100 shares at 100. Price ends at 120. Final value = 120 * 100 = 12000.
        expect(result.finalCapital).toBe(12000);
        expect(result.metrics.totalReturnPct).toBe(20);
        expect(result.trades.length).toBe(1);
        expect(result.equityCurve.length).toBe(3);
    });

    it('should strictly prevent look-ahead bias', () => {
        const portfolio = new Portfolio(10000);
        const strategySpy = {
            name: 'Spy',
            analyze: jest.fn().mockReturnValue({ action: 'HOLD', price: 100, timestamp: new Date() })
        };
        const backtester = new Backtester(strategySpy, portfolio, 'TEST');
        
        const candles = createCandles([100, 110, 120]);
        backtester.run(candles);

        // Call 1: Should only see index 0
        expect(strategySpy.analyze.mock.calls[0][0]).toHaveLength(1);
        expect(strategySpy.analyze.mock.calls[0][0][0]).toBe(candles[0]);

        // Call 2: Should see index 0, 1
        expect(strategySpy.analyze.mock.calls[1][0]).toHaveLength(2);
        expect(strategySpy.analyze.mock.calls[1][0][1]).toBe(candles[1]);

        // Call 3: Should see index 0, 1, 2
        expect(strategySpy.analyze.mock.calls[2][0]).toHaveLength(3);
        expect(strategySpy.analyze.mock.calls[2][0][2]).toBe(candles[2]);
    });
});
