import { Backtester } from '../backtester';
import { Portfolio } from '../portfolio';
import { Strategy, Candle, Signal, RiskConfig } from '../types';
import { RiskManager } from '../risk/risk_manager';

class MockStrategy implements Strategy {
  name = 'MockStrategy';
  analyze(candles: Candle[]): Signal {
    // Always Buy
    const last = candles[candles.length - 1];
    return {
      action: 'BUY',
      price: last.close,
      timestamp: last.time,
    };
  }
}

class MockSellStrategy implements Strategy {
  name = 'MockSellStrategy';
  analyze(candles: Candle[]): Signal {
    const last = candles[candles.length - 1];
    return {
      action: 'SELL',
      price: last.close,
      timestamp: last.time,
    };
  }
}

describe('Liquidity Guards', () => {
  const candles: Candle[] = [
    { time: new Date('2023-01-01'), open: 100, high: 105, low: 95, close: 100, volume: 1000 }, // Setup candle
    { time: new Date('2023-01-02'), open: 100, high: 105, low: 95, close: 100, volume: 100 },  // Low Volume
    { time: new Date('2023-01-03'), open: 100, high: 105, low: 95, close: 100, volume: 0 },    // Zero Volume
  ];

  it('should restrict BUY quantity based on volume limit', () => {
    const riskConfig: RiskConfig = {
      riskPerTradePct: 1.0, // Risk 100% of equity (aggressive, to force large size)
      maxDrawdownPct: 0.5,
      atrMultiplier: 2,
      atrPeriod: 1, // Short period for mock
      trailingStop: false,
      volumeLimitPct: 0.1 // 10% Limit
    };

    const portfolio = new Portfolio(100000); // Plenty of cash
    const strategy = new MockStrategy();
    const riskManager = new RiskManager(riskConfig);
    const backtester = new Backtester(strategy, portfolio, riskManager);

    // Mock ATR calculation inside Backtester relies on data.
    // We need to ensure ATR is calculable or mock it? 
    // The Backtester calculates ATR internally if RiskManager is present.
    // With 3 candles, ATR(1) works.

    const universe = new Map<string, Candle[]>();
    universe.set('TEST', candles);

    const result = backtester.run(universe);
    const trades = result.trades;

    // Candle 1 (Index 0): Volume 1000. Limit 100.
    // Candle 2 (Index 1): Volume 100. Limit 10.
    // Candle 3 (Index 2): Volume 0. Limit 0.

    // Let's check trades.
    // Day 1: Buy. 
    // Day 2: Buy.
    // Day 3: Buy (Zero Volume).

    // We expect trades on Day 1 and 2.
    // Day 1 Trade Quantity should be 100 (10% of 1000).
    const trade1 = trades.find(t => t.timestamp.getTime() === candles[0].time.getTime());
    expect(trade1).toBeDefined();
    expect(trade1?.quantity).toBe(100);

    // Day 2 Trade Quantity should be 10 (10% of 100).
    const trade2 = trades.find(t => t.timestamp.getTime() === candles[1].time.getTime());
    expect(trade2).toBeDefined();
    expect(trade2?.quantity).toBe(10);

    // Day 3 Trade (Zero Volume) should not exist.
    const trade3 = trades.find(t => t.timestamp.getTime() === candles[2].time.getTime());
    expect(trade3).toBeUndefined();
  });

  it('should restrict SELL quantity (Partial Exit) based on volume limit', () => {
    const riskConfig: RiskConfig = {
      riskPerTradePct: 0.01,
      maxDrawdownPct: 0.5,
      atrMultiplier: 2,
      atrPeriod: 14,
      trailingStop: false,
      volumeLimitPct: 0.1 // 10% Limit
    };

    const portfolio = new Portfolio(100000);
    // Manually add a position
    portfolio.buy('TEST', { action: 'BUY', price: 100, quantity: 100, timestamp: new Date('2022-12-31') });
    
    expect(portfolio.getState().positions.get('TEST')?.quantity).toBe(100);

    const strategy = new MockSellStrategy();
    const riskManager = new RiskManager(riskConfig);
    const backtester = new Backtester(strategy, portfolio, riskManager);

    const testCandles = [
        { time: new Date('2023-01-01'), open: 100, high: 105, low: 95, close: 100, volume: 500 } // Limit 50
    ];
    const universe = new Map<string, Candle[]>();
    universe.set('TEST', testCandles);

    backtester.run(universe);

    const endPos = portfolio.getState().positions.get('TEST');
    // We had 100.
    // Volume 500 -> Max Sell 50.
    // Remaining should be 50.
    expect(endPos).toBeDefined();
    expect(endPos?.quantity).toBe(50);
    
    // Check trade
    const trades = portfolio.getState().trades;
    const sellTrade = trades.find(t => t.action === 'SELL');
    expect(sellTrade?.quantity).toBe(50);
  });

  it('should restrict Risk Exit (Stop Loss) quantity based on volume limit', () => {
    const riskConfig: RiskConfig = {
      riskPerTradePct: 0.01,
      maxDrawdownPct: 0.5,
      atrMultiplier: 2,
      atrPeriod: 14,
      trailingStop: false,
      volumeLimitPct: 0.1 // 10% Limit
    };

    const portfolio = new Portfolio(100000);
    // Position: 100 shares, Stop Loss 99
    portfolio.buy('TEST', { 
        action: 'BUY', 
        price: 100, 
        quantity: 100, 
        timestamp: new Date('2022-12-31'),
        stopLoss: 99 
    });

    // Strategy that Holds (so we rely on Risk Manager to sell)
    class MockHoldStrategy implements Strategy {
        name = 'Hold';
        analyze() { return { action: 'HOLD' as const, price: 0, timestamp: new Date() }; }
    }

    const riskManager = new RiskManager(riskConfig);
    const backtester = new Backtester(new MockHoldStrategy(), portfolio, riskManager);

    const testCandles = [
        // Gap down to 98. Stop Loss triggered.
        // Volume 200 -> Max Sell 20.
        { time: new Date('2023-01-01'), open: 98, high: 98, low: 90, close: 95, volume: 200 } 
    ];
    const universe = new Map<string, Candle[]>();
    universe.set('TEST', testCandles);

    backtester.run(universe);

    const endPos = portfolio.getState().positions.get('TEST');
    // We had 100.
    // Stop Triggered. Max Sell 20.
    // Remaining should be 80.
    expect(endPos).toBeDefined();
    expect(endPos?.quantity).toBe(80);

    const trades = portfolio.getState().trades;
    // Since we used MockHoldStrategy, the only reason to sell is the Stop Loss.
    const sellTrade = trades.find(t => t.action === 'SELL');
    expect(sellTrade).toBeDefined();
    expect(sellTrade?.quantity).toBe(20);
  });
});
