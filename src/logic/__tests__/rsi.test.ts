import { calculateRSI } from '../indicators/rsi';

describe('RSI Indicator', () => {
    it('should return nulls if not enough data', () => {
        const prices = [10, 11, 12];
        const rsi = calculateRSI(prices, 14);
        expect(rsi).toEqual([null, null, null]);
    });

    it('should calculate RSI correctly (Manual Validation)', () => {
        // A simple scenario with Period = 2 to make math easy
        // Day 0: 100
        // Day 1: 110 (+10) 
        // Day 2: 120 (+10) -> Initial Avg Gain = (10+10)/2 = 10, Avg Loss = 0. RS = Inf, RSI = 100.
        // Day 3: 110 (-10) -> Gain=0, Loss=10. 
        //    New AvgGain = (10 * 1 + 0) / 2 = 5
        //    New AvgLoss = (0 * 1 + 10) / 2 = 5
        //    RS = 5/5 = 1. RSI = 100 - (100/2) = 50.
        
        const prices = [100, 110, 120, 110];
        const rsi = calculateRSI(prices, 2);

        // Expect: [null, null, 100, 50]
        expect(rsi[0]).toBeNull();
        expect(rsi[1]).toBeNull();
        expect(rsi[2]).toBeCloseTo(100);
        expect(rsi[3]).toBeCloseTo(50);
    });

    it('should match standard dataset behavior', () => {
        // Standard "Up Up Down Up" pattern
        const prices = [10, 12, 14, 13, 15]; 
        // Changes: +2, +2, -1, +2
        // Period 3.
        // Initial (first 3 changes): (+2, +2, -1) -> Gains: 2,2,0 -> AvgGain=1.33. Losses: 0,0,1 -> AvgLoss=0.33.
        // RS = 1.33/0.33 = 4. RSI = 100 - 100/5 = 80.
        // This RSI belongs to the price '13' (index 3).
        
        // Next price '15' (Change +2).
        // PrevAvgGain 1.33. NewGain 2. NewAvgGain = (1.33*2 + 2)/3 = 1.55.
        // PrevAvgLoss 0.33. NewLoss 0. NewAvgLoss = (0.33*2 + 0)/3 = 0.22.
        // RS = 1.55/0.22 = 7.04. RSI = 100 - 100/8.04 = 87.5.

        const rsi = calculateRSI(prices, 3);
        
        expect(rsi[3]).toBeCloseTo(80, 1);
        expect(rsi[4]).toBeCloseTo(87.5, 1); 
    });
});
