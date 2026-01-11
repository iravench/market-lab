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
    const backtester = new Backtester(strategy, portfolio, new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 115, l: 105, c: 110 }, // 1
      { h: 120, l: 110, c: 115 }, // 2
    ]);
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', candles);

    // Trigger BUY only on candle 2 (Index 2)
    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 115, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(universe);
    const trade = result.trades[0];

    expect(trade.quantity).toBe(5);
    expect(portfolio.getState().positions.get('AAPL')?.stopLoss).toBe(95);
  });

  it('should exit on Stop Loss', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 110, l: 100, c: 105 }, // 1
      { h: 110, l: 100, c: 105 }, // 2 BUY here (Price 105, ATR 10, Stop 85)
      { h: 110, l: 80, c: 90 }, // 3 STOP HIT (Low 80 < Stop 85)
    ]);
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', candles);

    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(universe);

    expect(result.trades.length).toBe(2); // BUY and SELL
    expect(result.trades[1].action).toBe('SELL');
    expect(result.trades[1].price).toBe(85); // Sold at stop price
  });

  it('should update Trailing Stop', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, new RiskManager(riskConfig));

    const candles = createCandles([
      { h: 110, l: 100, c: 105 }, // 0
      { h: 110, l: 100, c: 105 }, // 1
      { h: 110, l: 100, c: 105 }, // 2 BUY (Price 105, Stop 85)
      { h: 120, l: 115, c: 118 }, // 3 Price up. High 120, ATR 10 -> New stop 120 - 20 = 100.
    ]);
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', candles);

    strategy.analyze = (c) => {
      if (c.length === 3) return { action: 'BUY', price: 105, timestamp: c[2].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(universe);

    const pos = portfolio.getState().positions.get('AAPL');
    expect(pos?.stopLoss).toBeCloseTo(96.66, 1);
  });

  it('should filter trades in choppy markets (Low ADX)', () => {
    // Config with high ADX threshold
    const regimeConfig: RiskConfig = { ...riskConfig, adxThreshold: 50 };
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, new RiskManager(regimeConfig));

    // ADX requires 2 * period - 1 to start. Period 14 -> 27 candles.
    // Let's create 40 candles.
    const choppyCandles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      choppyCandles.push({
        time: new Date(2023, 0, i + 1),
        open: 100, high: 101, low: 99, close: 100, volume: 1000
      });
    }
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', choppyCandles);

    // Trigger BUY on last candle
    strategy.analyze = (c) => {
      if (c.length === 40) return { action: 'BUY', price: 100, timestamp: c[39].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(universe);

    // Should result in 0 trades because ADX is low
    expect(result.trades.length).toBe(0);
  });

  it('should trigger Daily Loss Limit', () => {
    // Config: 2% Daily Loss Limit ($200 on $10000)
    // Relax Max Drawdown to 50% so we don't hit the hard stop first
    const dllConfig: RiskConfig = { ...riskConfig, dailyLossLimitPct: 0.02, maxDrawdownPct: 0.5 };
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, new RiskManager(dllConfig));

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
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', candles);

    // Force sizing to ensure we hit the loss limit
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

    const result = backtester.run(universe);

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
    const backtester = new Backtester(strategy, portfolio, new RiskManager({ ...riskConfig, maxCorrelation: 0.7, adxThreshold: 0 }));

    // 40 candles of primary (AAPL) with some variance
    const primaryPrices = new Array(40).fill(0).map((_, i) => 100 + i);
    const candlesA = createCandles(primaryPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    // Identical data for B (Correlated)
    const candlesB = createCandles(primaryPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    
    const universe = new Map<string, Candle[]>();
    universe.set('A', candlesA);
    universe.set('B', candlesB);

    // Strategy: Buy A at 35, Buy B at 36.
    strategy.analyze = (c) => {
       const idx = c.length - 1;
       // Mock strategy is stateless, so it returns BUY for both.
       // We rely on Backtester to call it sequentially for A then B?
       // No, Backtester loops symbols. 
       // We need to differentiate symbols? 
       // In the loop `for (const sym of symbols)`, we execute strategy.
       // Our MockStrategy doesn't know the symbol.
       // However, we can trick it by timestamp if we want, but timestamps are same.
       
       // Just return BUY always after 35.
       if (idx >= 35) return { action: 'BUY', price: 100, timestamp: c[idx].time };
       return { action: 'HOLD', price: 0, timestamp: new Date() };
    };

    const result = backtester.run(universe);

    // Timeline:
    // t=0..34: HOLD
    // t=35:
    //   Process A: BUY -> Executed. (Portfolio has A)
    //   Process B: BUY -> Check Correlation vs (A). High! -> Blocked.
    // t=36:
    //   Process A: BUY -> Already have position -> Position update (or ignore if strategy keeps buying?)
    //   Process B: BUY -> Blocked.

    // Result should have trades for A, but NOT for B.
    // How to check? Portfolio positions.
    const positions = portfolio.getState().positions;
    expect(positions.has('A')).toBe(true);
    expect(positions.has('B')).toBe(false); // B should be blocked
  });

  it('should apply Bollinger Band Take Profit if enabled', () => {
    const portfolio = new Portfolio(10000);
    const strategy = new MockStrategy();
    const backtester = new Backtester(strategy, portfolio, new RiskManager({ ...riskConfig, useBollingerTakeProfit: true }));

    // Create candles with low variance
    const risingPrices = new Array(20).fill(0).map((_, i) => 10 + i);
    const risingCandles = createCandles(risingPrices.map(p => ({ h: p + 1, l: p - 1, c: p })));
    const universe = new Map<string, Candle[]>();
    universe.set('AAPL', risingCandles);

    strategy.analyze = (c) => {
      if (c.length === 20) return { action: 'BUY', price: 29, timestamp: c[19].time };
      return { action: 'HOLD', price: c[c.length - 1].close, timestamp: c[c.length - 1].time };
    };

    const result = backtester.run(universe);
    
    // Check portfolio state for the position
    const position = portfolio.getState().positions.get('AAPL');
    expect(position).toBeDefined();
    
    // We expect TP to be set.
    expect(position!.takeProfit).toBeCloseTo(31.03, 1);
  });
});