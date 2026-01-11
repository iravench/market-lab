import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { Strategy, Candle, Signal } from '../types';
import fs from 'fs';
import path from 'path';

// A simple strategy that buys once and never sells
class BuyAndHoldStrategy implements Strategy {
  public readonly name = 'Buy and Hold';
  private hasBought = false;

  analyze(candles: Candle[]): Signal {
    const lastCandle = candles[candles.length - 1];
    if (!this.hasBought) {
      this.hasBought = true;
      return { action: 'BUY', price: lastCandle.close, timestamp: lastCandle.time };
    }
    return { action: 'HOLD', price: lastCandle.close, timestamp: lastCandle.time };
  }
}

// Simple RSI Strategy for testing fixtures
class TestRsiStrategy implements Strategy {
  public readonly name = 'Test RSI';
  analyze(candles: Candle[]): Signal {
    const last = candles[candles.length - 1];
    // Dummy logic: Buy on red candle, sell on green candle to generate activity
    if (last.close < last.open) {
      return { action: 'BUY', price: last.close, timestamp: last.time };
    } else if (last.close > last.open) {
      return { action: 'SELL', price: last.close, timestamp: last.time };
    }
    return { action: 'HOLD', price: last.close, timestamp: last.time };
  }
}

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

describe('Backtester', () => {
  it('should run a simulation and return results', () => {
    const initialCash = 10000;
    const portfolio = new Portfolio(initialCash);
    const strategy = new BuyAndHoldStrategy();
    const backtester = new Backtester(strategy, portfolio);

    // Price goes 100 -> 110 -> 120
    const candles = createCandles([100, 110, 120]);
    const universe = new Map<string, Candle[]>();
    universe.set('TEST', candles);

    const result = backtester.run(universe);

    expect(result.initialCapital).toBe(initialCash);
    // Buy 100 shares at 100. Price ends at 120. Final value = 120 * 100 = 12000.
    expect(result.finalCapital).toBe(12000);
    expect(result.metrics.totalReturnPct).toBe(20);
    expect(result.trades.length).toBe(1);
    expect(result.equityCurve.length).toBe(3);
  });

  it('should strictly prevent look-ahead bias', () => {
    const portfolio = new Portfolio(10000);
    const strategySpy = {
      name: 'Spy',
      analyze: jest.fn().mockReturnValue({ action: 'HOLD', price: 100, timestamp: new Date() })
    };
    const backtester = new Backtester(strategySpy, portfolio);

    const candles = createCandles([100, 110, 120]);
    const universe = new Map<string, Candle[]>();
    universe.set('TEST', candles);

    backtester.run(universe);

    // Call 1: Should only see index 0
    expect(strategySpy.analyze.mock.calls[0][0]).toHaveLength(1);
    expect(strategySpy.analyze.mock.calls[0][0][0]).toBe(candles[0]);

    // Call 2: Should see index 0, 1
    expect(strategySpy.analyze.mock.calls[1][0]).toHaveLength(2);
    expect(strategySpy.analyze.mock.calls[1][0][1]).toBe(candles[1]);

    // Call 3: Should see index 0, 1, 2
    expect(strategySpy.analyze.mock.calls[2][0]).toHaveLength(3);
    expect(strategySpy.analyze.mock.calls[2][0][2]).toBe(candles[2]);
  });

  it('should run successfully with real fixture data', () => {
    const fixturePath = path.join(__dirname, 'fixtures/cba_2023.json');
    if (!fs.existsSync(fixturePath)) {
      console.warn('Skipping fixture test: fixture not found.');
      return;
    }
    const rawData = fs.readFileSync(fixturePath, 'utf-8');
    const candles: Candle[] = JSON.parse(rawData).map((c: any) => ({
      ...c,
      time: new Date(c.time)
    }));

    const initialCash = 10000;
    const portfolio = new Portfolio(initialCash);
    const strategy = new TestRsiStrategy();
    const backtester = new Backtester(strategy, portfolio);

    const universe = new Map<string, Candle[]>();
    universe.set('CBA.AX', candles);

    const result = backtester.run(universe);

    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.equityCurve.length).toEqual(candles.length);
    // Real market data has noise, so we shouldn't crash
  });
});
