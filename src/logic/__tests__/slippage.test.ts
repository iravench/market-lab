import { FixedPercentageSlippage, VolatilitySlippage, ZeroSlippage } from '../slippage';
import { Candle } from '../types';

describe('Slippage Models', () => {
    const dummyCandle: Candle = {
        time: new Date(),
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000
    };

    it('ZeroSlippage should not alter price', () => {
        const model = new ZeroSlippage();
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'BUY')).toBe(100);
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'SELL')).toBe(100);
    });

    it('FixedPercentageSlippage should add/sub percent', () => {
        const model = new FixedPercentageSlippage(0.01); // 1%
        // Buy: 100 + 1% = 101
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'BUY')).toBe(101);
        // Sell: 100 - 1% = 99
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'SELL')).toBe(99);
    });

    it('VolatilitySlippage should use candle range', () => {
        const model = new VolatilitySlippage(0.1); // 10% of Range
        // Range = 110 - 90 = 20.
        // Slippage = 20 * 0.1 = 2.
        
        // Buy: 100 + 2 = 102
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'BUY')).toBe(102);
        // Sell: 100 - 2 = 98
        expect(model.calculateExecutionPrice(100, 10, dummyCandle, 'SELL')).toBe(98);
    });
});
