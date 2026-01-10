import { calculateSMA } from '../indicators/sma';

describe('SMA Indicator', () => {
  it('should return null if there are fewer points than the period', () => {
    const prices = [10, 20];
    const result = calculateSMA(prices, 3);
    expect(result).toEqual([null, null]);
  });

  it('should correctly calculate SMA for a given period', () => {
    const prices = [10, 20, 30, 40, 50];
    const result = calculateSMA(prices, 3);

    // Index 0: null (need 3)
    // Index 1: null (need 3)
    // Index 2: (10+20+30)/3 = 20
    // Index 3: (20+30+40)/3 = 30
    // Index 4: (30+40+50)/3 = 40
    expect(result).toEqual([null, null, 20, 30, 40]);
  });

  it('should handle period of 1', () => {
    const prices = [10, 20, 30];
    const result = calculateSMA(prices, 1);
    expect(result).toEqual([10, 20, 30]);
  });
});
