import { calculateEMA } from '../indicators/ema';

describe('EMA Indicator', () => {
    it('should return nulls if not enough data', () => {
        const prices = [10, 20];
        const ema = calculateEMA(prices, 3);
        expect(ema).toEqual([null, null]);
    });

    it('should handle period of 1 (EMA = Price)', () => {
        // If period is 1, k = 2/2 = 1.
        // EMA = Price * 1 + Prev * 0 = Price.
        const prices = [10, 20, 30];
        const ema = calculateEMA(prices, 1);
        expect(ema).toEqual([10, 20, 30]);
    });

    it('should calculate EMA correctly (Manual Calculation)', () => {
        // Prices: [2, 4, 6, 8]
        // Period: 3
        // k = 2 / (3 + 1) = 0.5
        
        // Index 0: null
        // Index 1: null
        // Index 2: SMA(2,4,6) = 12/3 = 4.
        // Index 3: Price 8.
        // EMA = (8 * 0.5) + (4 * 0.5) = 4 + 2 = 6.
        
        const prices = [2, 4, 6, 8];
        const ema = calculateEMA(prices, 3);
        
        expect(ema[0]).toBeNull();
        expect(ema[1]).toBeNull();
        expect(ema[2]).toBe(4);
        expect(ema[3]).toBe(6);
    });

    it('should react faster than SMA', () => {
        // A sharp price increase
        const prices = [10, 10, 10, 10, 20];
        // Period 3.
        
        // SMA at index 4: (10+10+20)/3 = 13.33
        // EMA at index 4:
        // k = 0.5
        // Index 2 (SMA): 10.
        // Index 3: Price 10. EMA = 10*0.5 + 10*0.5 = 10.
        // Index 4: Price 20. EMA = 20*0.5 + 10*0.5 = 15.
        
        // EMA (15) > SMA (13.33). Proving it reacts faster to the jump.
        const ema = calculateEMA(prices, 3);
        
        expect(ema[4]).toBe(15);
    });
});
