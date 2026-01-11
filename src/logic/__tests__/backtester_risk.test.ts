import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { Strategy, Candle, Signal, RiskConfig } from '../types';
import { RiskManager } from '../risk/risk_manager';

class MockStrategy implements Strategy {
  public name = 'Mock Strategy';
  public nextAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

  analyze(candles: Candle[]): Signal {
    const last = candles[candles.length - 1];
    return { action: this.nextAction, price: last.close, timestamp: last.time };
  }
}

function createCandles(data: { h: number, l: number, c: number }[]): Candle[] {
  return data.map((d, i) => ({
    time: new Date(2023, 0, i + 1),
    open: d.c,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: 1000
  }));
}

describe('Backtester with Risk Management', () => {
  const riskConfig: RiskConfig = {
    riskPerTradePct: 0.01, // 1% ($100 risk on $10000)
    maxDrawdownPct: 0.1,
    atrMultiplier: 2.0,
    atrPeriod: 3,
    trailingStop: true
  };

  it('should apply risk-based sizing and ATR stops', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 115, l: 105, c: 110 }, // 1
      { h: 120, l: 110, c: 115 }, // 2
    ]);

    // Trigger BUY only on candle 2 (Index 2)
    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 115, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(candles);
    const trade = result.trades[0];

    expect(trade.quantity).toBe(5);
    expect(portfolio.getState().positions.get('AAPL')?.stopLoss).toBe(95);
  });

  it('should exit on Stop Loss', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 110, l: 100, c: 105 }, // 1
      { h: 110, l: 100, c: 105 }, // 2 BUY here (Price 105, ATR 10, Stop 85)
      { h: 110, l: 80, c: 90 }, // 3 STOP HIT (Low 80 < Stop 85)
    ]);

    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(candles);

    expect(result.trades.length).toBe(2); // BUY and SELL
    expect(result.trades[1].action).toBe('SELL');
    expect(result.trades[1].price).toBe(85); // Sold at stop price
  });

  it('should update Trailing Stop', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 110, l: 100, c: 105 }, // 1
      { h: 110, l: 100, c: 105 }, // 2 BUY (Price 105, Stop 85)
      { h: 120, l: 115, c: 118 }, // 3 Price up. High 120, ATR 10 -> New stop 120 - 20 = 100.
    ]);

    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(candles);

    const pos = portfolio.getState().positions.get('AAPL');
    expect(pos?.stopLoss).toBeCloseTo(96.66, 1);
  });

  it('should filter trades in choppy markets (Low ADX)', () => {
    // Config with high ADX threshold
    const regimeConfig: RiskConfig = { ...riskConfig, adxThreshold: 50 };
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager(regimeConfig));

    // ADX requires 2 * period - 1 to start. Period 14 -> 27 candles.
    // Let's create 40 candles.
    const choppyCandles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      choppyCandles.push({
        time: new Date(2023, 0, i + 1),
        open: 100, high: 101, low: 99, close: 100, volume: 1000
      });
    }

    // Trigger BUY on last candle
    strategy.analyze = (c) => {
      if (c.length === 40) return { action: 'BUY', price: 100, timestamp: c[39].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(choppyCandles);

    // Should result in 0 trades because ADX is low
    expect(result.trades.length).toBe(0);
  });

  it('should trigger Daily Loss Limit', () => {
    // Config: 2% Daily Loss Limit ($200 on $10000)
    // Relax Max Drawdown to 50% so we don't hit the hard stop first
    const dllConfig: RiskConfig = { ...riskConfig, dailyLossLimitPct: 0.02, maxDrawdownPct: 0.5 };
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager(dllConfig));

    // Day 1: 3 candles.
    // 1. Buy.
    // 2. Sell at huge loss.
    // 3. Try to Buy again (Should be blocked).
    const baseDate = new Date('2023-01-01T00:00:00Z');
    const candles: Candle[] = [
      { time: new Date(baseDate.getTime() + 0 * 3600000), open: 100, high: 100, low: 100, close: 100, volume: 1000 },
      { time: new Date(baseDate.getTime() + 1 * 3600000), open: 100, high: 100, low: 100, close: 100, volume: 1000 }, // Buy
      { time: new Date(baseDate.getTime() + 2 * 3600000), open: 100, high: 100, low: 70, close: 70, volume: 1000 },  // Sell
      { time: new Date(baseDate.getTime() + 3 * 3600000), open: 70, high: 70, low: 70, close: 70, volume: 1000 },     // Try Buy
    ];

    // Force sizing to ensure we hit the loss limit
    // If we risk 1% ($100), and stop is 2xATR (ATR ~0 due to flat candles?), let's manipulate execution.
    // Actually, let's just use the mock strategy to force trades.

    let tradeCount = 0;
    strategy.analyze = (c) => {
      const idx = c.length - 1;
      // Candle 1: BUY
      if (idx === 1) return { action: 'BUY', price: 100, timestamp: c[idx].time };
      // Candle 2: SELL (Realize Loss)
      if (idx === 2) return { action: 'SELL', price: 70, timestamp: c[idx].time };
      // Candle 3: BUY (Should be blocked)
      if (idx === 3) return { action: 'BUY', price: 70, timestamp: c[idx].time };
      return { action: 'HOLD', price: c[idx].close, timestamp: c[idx].time };
    };

    const result = backtester.run(candles);

    // We expect:
    // Trade 1: Buy @ 100
    // Trade 2: Sell @ 70 (Loss of 30 per share. If qty > 7, loss > $200)
    // Trade 3: Blocked.
    
    // Check realized loss
    const trades = result.trades;
    expect(trades.length).toBe(2); // Buy + Sell. No second buy.
    expect(trades[1].action).toBe('SELL');
    expect(trades[1].realizedPnL).toBeLessThan(-200); // Confirm we actually lost enough
  });

  it('should filter trades based on correlation', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager({ ...riskConfig, maxCorrelation: 0.7, adxThreshold: 0 }));

    // 40 candles of primary (AAPL) with some variance
    const primaryPrices = new Array(40).fill(0).map((_, i) => 100 + i);
    const primaryCandles = createCandles(primaryPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    
    // Auxiliary data (MSFT) that is perfectly correlated
    const auxCandles = createCandles(primaryPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    const auxiliaryData = new Map<string, Candle[]>();
    auxiliaryData.set('MSFT', auxCandles);

    // Trigger BUY on last candle
    strategy.analyze = (c) => {
      if (c.length === 40) return { action: 'BUY', price: 139, timestamp: c[39].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(primaryCandles, auxiliaryData);

    // Should be filtered because correlation is 1
    expect(result.trades.length).toBe(0);

    // Now test uncorrelated (random-ish or inverse)
    const uncorrelatedPrices = new Array(40).fill(0).map((_, i) => 100 - (i % 5));
    const uncorrelatedAux = createCandles(uncorrelatedPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    const auxUncorrelated = new Map<string, Candle[]>();
    auxUncorrelated.set('GLD', uncorrelatedAux);

    const resultUncorrelated = backtester.run(primaryCandles, auxUncorrelated);
    expect(resultUncorrelated.trades.length).toBe(1);
    expect(resultUncorrelated.trades[0].action).toBe('BUY');
  });

  it('should apply Bollinger Band Take Profit if enabled', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, 'AAPL', new RiskManager({ ...riskConfig, useBollingerTakeProfit: true }));

    // Create candles with low variance
    const prices = new Array(20).fill(100);
    const candles = createCandles(prices.map(p => ({ h: p + 1, l: p - 1, c: p })));

    // Trigger BUY on last candle
    strategy.analyze = (c) => {
      if (c.length === 20) return { action: 'BUY', price: 100, timestamp: c[19].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    // Mock RiskManager calculation (we can't easily mock private member, so rely on real calculation)
    // Mean = 100. StdDev ~ 0.816 (for range 99-101?). 
    // Wait, createCandles uses Close for SMA. Close is constant 100.
    // StdDev of constant 100 is 0.
    // So Upper Band = 100 + 2*0 = 100.
    // Stop Loss is ATR based.

    // Let's make prices move up so bands are distinct.
    // 10, 11, ... 29.
    const risingPrices = new Array(20).fill(0).map((_, i) => 10 + i);
    const risingCandles = createCandles(risingPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));

    strategy.analyze = (c) => {
      if (c.length === 20) return { action: 'BUY', price: 29, timestamp: c[19].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(risingCandles);
    const trade = result.trades[0];

    // Check portfolio state for the position
    const position = portfolio.getState().positions.get('AAPL');
    expect(position).toBeDefined();
    
    // We expect TP to be set.
    // Real calculation: Mean of 10..29 is 19.5.
    // StdDev is 5.766.
    // Upper Band = 19.5 + 2 * 5.766 = 31.03.
    expect(position!.takeProfit).toBeCloseTo(31.03, 1);
  });
});
