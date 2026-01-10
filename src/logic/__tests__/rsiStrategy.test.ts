import { RsiStrategy } from '../strategies/rsiStrategy';
import { Candle } from '../types';

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

describe('RSI Strategy', () => {
  it('should return HOLD when there is insufficient data', () => {
    const strategy = new RsiStrategy({ period: 14 });
    const prices = [100, 101, 102]; // Only 3 data points
    const candles = createCandles(prices);

    const signal = strategy.analyze(candles);

    expect(signal.action).toBe('HOLD');
    expect(signal.reason).toContain('Insufficient data');
  });

  it('should return SELL when RSI is above threshold', () => {
    // Construct a scenario where RSI spikes
    // A period of 2 for easy calculation
    const strategy = new RsiStrategy({ period: 2, sellThreshold: 90 });

    // Rapid price increase: 100 -> 110 -> 120
    // Changes: +10, +10. AvgGain=10, AvgLoss=0. RSI=100.
    const prices = [100, 110, 120];
    const candles = createCandles(prices);

    const signal = strategy.analyze(candles);

    expect(signal.action).toBe('SELL');
    expect(signal.reason).toContain('RSI (100.00) > 90');
  });

  it('should return BUY when RSI is below threshold', () => {
    // Construct a scenario where RSI crashes
    const strategy = new RsiStrategy({ period: 2, buyThreshold: 10 });

    // Rapid price drop: 100 -> 90 -> 80
    // Changes: -10, -10. AvgGain=0, AvgLoss=10. RSI=0.
    const prices = [100, 90, 80];
    const candles = createCandles(prices);

    const signal = strategy.analyze(candles);

    expect(signal.action).toBe('BUY');
    expect(signal.reason).toContain('RSI (0.00) < 10');
  });

  it('should return HOLD when RSI is neutral', () => {
    const strategy = new RsiStrategy({ period: 2, buyThreshold: 30, sellThreshold: 70 });

    // Mixed bag: 100 -> 105 (+5) -> 100 (-5). 
    // AvgGain=2.5, AvgLoss=2.5. RS=1. RSI=50.
    const prices = [100, 105, 100];
    const candles = createCandles(prices);

    const signal = strategy.analyze(candles);

    expect(signal.action).toBe('HOLD');
    expect(signal.reason).toContain('is neutral');
  });
});
