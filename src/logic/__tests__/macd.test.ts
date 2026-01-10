import { calculateMACD } from '../indicators/macd';
import { Candle } from '../types';

describe('MACD Indicator', () => {
    const createCandle = (c: number): Candle => ({
        time: new Date(),
        open: 0,
        high: 0,
        low: 0,
        close: c,
        volume: 0
    });

    it('should return nulls if not enough data', () => {
        // Needs 26 periods for Slow EMA
        const candles = Array(20).fill(0).map((_, i) => createCandle(10 + i));
        const result = calculateMACD(candles, 12, 26, 9);
        
        // With only 20 candles, all values should be null for a 26-period slow EMA
        expect(result.macdLine[19]).toBeNull();
    });

    it('should calculate MACD Line, Signal Line, and Histogram', () => {
        // Use shorter periods for manual verification: Fast=3, Slow=5, Signal=3
        // Prices: [10, 12, 14, 16, 18, 20, 22, 24]
        const prices = [10, 12, 14, 16, 18, 20, 22, 24]; 
        const candles = prices.map(p => createCandle(p));

        const result = calculateMACD(candles, 3, 5, 3);
        
        // Slow EMA(5): SMA(10,12,14,16,18) = 14 at Index 4.
        // Fast EMA(3): SMA(10,12,14) = 12 at Index 2.
        // Fast EMA(3) at index 3: 16*0.5 + 12*0.5 = 14.
        // Fast EMA(3) at index 4: 18*0.5 + 14*0.5 = 16.
        // MACD Line at index 4: 16 - 14 = 2.
        
        expect(result.macdLine[3]).toBeNull();
        expect(result.macdLine[4]).toBeCloseTo(2, 1);
        
        // Index 5: Price 20. 
        // Slow EMA = 20 * (2/6) + 14 * (4/6) = 6.666 + 9.333 = 16.
        // Fast EMA = 20 * (2/4) + 16 * (2/4) = 10 + 8 = 18.
        // MACD Line = 18 - 16 = 2.
        expect(result.macdLine[5]).toBeCloseTo(2, 1);

        // Index 6: Price 22.
        // Slow EMA = 22 * (2/6) + 16 * (4/6) = 7.333 + 10.666 = 18.
        // Fast EMA = 22 * (2/4) + 18 * (2/4) = 11 + 9 = 20.
        // MACD Line = 20 - 18 = 2.
        expect(result.macdLine[6]).toBeCloseTo(2, 1);
        
        // Signal Line (EMA 3 of MACD Line [..., 2, 2, 2])
        // Valid MACD starts at index 4. Signal(3) needs 3 values.
        // Signal at index 4+2=6.
        // SMA of MACD at indices 4,5,6: (2+2+2)/3 = 2.
        expect(result.signalLine[5]).toBeNull();
        expect(result.signalLine[6]).toBeCloseTo(2, 1);
        
        // Histogram = MACD - Signal
        expect(result.histogram[6]).toBeCloseTo(0, 1);
    });
});
