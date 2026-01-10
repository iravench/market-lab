import { calculateATR } from '../indicators/atr';
import { Candle } from '../types';

describe('ATR Indicator', () => {
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
    const atr = calculateATR(candles, 3);
    expect(atr).toEqual([null, null]);
  });

  it('should calculate True Range (TR) correctly', () => {
    // Candle 1: High 10, Low 5, Close 8. TR is H-L = 5 (no prev close)
    // Candle 2: High 12, Low 11, Close 11.5. 
    //   TR = max(12-11=1, |12-8|=4, |11-8|=3) = 4.
    const candles = [
      createCandle(10, 5, 8),
      createCandle(12, 11, 11.5)
    ];
    // Period 1 means ATR = TR
    const atr = calculateATR(candles, 1);
    expect(atr[0]).toBe(5);
    expect(atr[1]).toBe(4);
  });

  it('should calculate ATR correctly (Manual Calculation)', () => {
    // Period: 3
    const candles = [
      createCandle(10, 5, 8),   // TR1: 10-5 = 5
      createCandle(12, 11, 11), // TR2: max(12-11=1, |12-8|=4, |11-8|=3) = 4
      createCandle(15, 13, 14), // TR3: max(15-13=2, |15-11|=4, |13-11|=2) = 4
      createCandle(16, 14, 15), // TR4: max(16-14=2, |16-14|=2, |14-14|=0) = 2
    ];

    const atr = calculateATR(candles, 3);

    // Index 0: null
    // Index 1: null
    // Index 2 (First ATR = SMA of TRs): (5 + 4 + 4) / 3 = 13 / 3 = 4.333...
    // Index 3 (Wilder's Smoothing): ((4.333... * 2) + 2) / 3 = (8.666... + 2) / 3 = 10.666... / 3 = 3.555...

    expect(atr[0]).toBeNull();
    expect(atr[1]).toBeNull();
    expect(atr[2]).toBeCloseTo(4.3333, 4);
    expect(atr[3]).toBeCloseTo(3.5556, 4);
  });
});
