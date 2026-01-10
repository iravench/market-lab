import { calculateADX } from '../indicators/adx';
import { Candle } from '../types';

describe('ADX Indicator', () => {
    const createCandle = (h: number, l: number, c: number): Candle => ({
        time: new Date(),
        open: 0,
        high: h,
        low: l,
        close: c,
        volume: 0
    });

    it('should return nulls if not enough data', () => {
        const candles = [
            createCandle(10, 5, 8),
            createCandle(12, 6, 9)
        ];
        // For period 14, need ~27 candles for first ADX
        const adx = calculateADX(candles, 14);
        expect(adx).toEqual([null, null]);
    });

    it('should calculate ADX correctly with small period', () => {
        // Period: 3.
        // Needs 2*3 - 1 = 5 candles minimum to get first ADX.
        // Index 0: Base
        // Index 1: TR=10, +DM=5, -DM=0
        // Index 2: TR=10, +DM=5, -DM=0. 
        //   Smoothed (SMA over 3): TR=30/3=10, +DM=10/3=3.333, -DM=0.
        //   DX = |(33.33-0)/(33.33+0)| * 100 = 100.
        // Index 3: TR=10, +DM=5, -DM=0.
        //   Smoothed (Wilder): TR=10, +DM=3.888..., -DM=0.
        //   DX = 100.
        // Index 4: TR=10, +DM=5, -DM=0.
        //   Smoothed (Wilder): TR=10, +DM=4.259..., -DM=0.
        //   DX = 100.
        //   ADX (Index 4) = SMA(DX at 2,3,4) = 100.

        const candles = [
            createCandle(100, 90, 95),   // 0
            createCandle(105, 100, 102),  // 1
            createCandle(110, 105, 108),  // 2 -> First DX available here (Index 2)
            createCandle(115, 110, 112),  // 3
            createCandle(120, 115, 118),  // 4 -> First ADX available here (Index 4)
        ];

        const adx = calculateADX(candles, 3);
        
        expect(adx[0]).toBeNull();
        expect(adx[1]).toBeNull();
        expect(adx[2]).toBeNull();
        expect(adx[3]).toBeNull();
        expect(adx[4]).toBeCloseTo(100, 2);
    });

    it('should detect trendless market (low ADX)', () => {
        // Alternating candles with no directional movement
        const candles = [
            createCandle(10, 5, 8), // 0
            createCandle(10, 5, 8), // 1: +DM=0, -DM=0
            createCandle(10, 5, 8), // 2: +DM=0, -DM=0
            createCandle(10, 5, 8), // 3
            createCandle(10, 5, 8), // 4
        ];
        
        // If DM is 0, DX is 0, ADX is 0.
        const adx = calculateADX(candles, 3);
        expect(adx[4]).toBe(0);
    });
});