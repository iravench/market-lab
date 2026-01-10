import { calculateBollingerBands } from '../indicators/bollinger';
import { Candle } from '../types';

describe('Bollinger Bands Indicator', () => {
  const createCandle = (c: number): Candle => ({
    time: new Date(),
    open: 0,
    high: 0,
    low: 0,
    close: c,
    volume: 0
  });

  it('should return nulls if not enough data', () => {
    const candles = [createCandle(10), createCandle(12)];
    const result = calculateBollingerBands(candles, 3, 2);

    // With 2 candles and period 3, index 0 and 1 should be null
    expect(result.middle[0]).toBeNull();
    expect(result.middle[1]).toBeNull();
    expect(result.middle.length).toBe(2);
  });

  it('should calculate Middle, Upper, and Lower bands correctly', () => {
    // Period 3, Multiplier 2
    // Prices: [10, 20, 30, 40]
    const prices = [10, 20, 30, 40];
    const candles = prices.map(p => createCandle(p));

    const result = calculateBollingerBands(candles, 3, 2);

    // Index 2: SMA(10,20,30) = 20.
    //   Values: [10, 20, 30]
    //   Mean = 20.
    //   Variance = ((10-20)^2 + (20-20)^2 + (30-20)^2) / 3 = (100 + 0 + 100) / 3 = 66.666...
    //   StdDev = sqrt(66.666...) = 8.164965...
    //   Upper = 20 + 2 * 8.164965 = 36.3299...
    //   Lower = 20 - 2 * 8.164965 = 3.6700...

    expect(result.middle[2]).toBeCloseTo(20, 1);
    expect(result.upper[2]).toBeCloseTo(36.33, 1);
    expect(result.lower[2]).toBeCloseTo(3.67, 1);

    // Index 3: SMA(20,30,40) = 30.
    //   Values: [20, 30, 40]
    //   Mean = 30.
    //   Variance = (100 + 0 + 100) / 3 = 66.666...
    //   StdDev = 8.164965...
    //   Upper = 30 + 16.3299... = 46.33
    //   Lower = 30 - 16.3299... = 13.67
    expect(result.middle[3]).toBeCloseTo(30, 1);
    expect(result.upper[3]).toBeCloseTo(46.33, 1);
    expect(result.lower[3]).toBeCloseTo(13.67, 1);
  });
});
