import { Candle } from '../types';
import { calculateDonchianChannels } from '../indicators/donchian';

describe('Donchian Channels', () => {
  const createCandle = (high: number, low: number): Candle => ({
    time: new Date(),
    open: 10,
    high,
    low,
    close: 10,
    volume: 100,
  });

  it('should calculate channels correctly', () => {
    const candles: Candle[] = [
      createCandle(10, 5),  // 0
      createCandle(12, 6),  // 1
      createCandle(15, 8),  // 2
      createCandle(11, 7),  // 3
      createCandle(13, 9),  // 4
    ];

    // Period 3
    // i=0: [10], Max 10, Min 5.
    // i=1: [10, 12], Max 12, Min 5.
    // i=2: [10, 12, 15], Max 15, Min 5. Mid 10.
    // i=3: [12, 15, 11], Max 15, Min 6. Mid 10.5.
    // i=4: [15, 11, 13], Max 15, Min 7. Mid 11.

    const result = calculateDonchianChannels(candles, 3);

    expect(result.upper[2]).toBe(15);
    expect(result.lower[2]).toBe(5);
    
    expect(result.upper[3]).toBe(15);
    expect(result.lower[3]).toBe(6);

    expect(result.upper[4]).toBe(15);
    expect(result.lower[4]).toBe(7);
    expect(result.middle[4]).toBe(11);
  });
});
