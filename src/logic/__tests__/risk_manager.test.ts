import { RiskManager } from '../risk/risk_manager';
import { Candle, RiskConfig, Position } from '../types';

describe('RiskManager', () => {
  const defaultConfig: RiskConfig = {
    riskPerTradePct: 0.01, // 1%
    maxDrawdownPct: 0.1,   // 10%
    atrMultiplier: 2.0,
    atrPeriod: 14,
    trailingStop: true
  };

  const riskManager = new RiskManager(defaultConfig);

  it('should detect max drawdown breach', () => {
    // Config: maxDrawdownPct = 0.1 (10%)
    const hwm = 10000;

    // Equity 9500 (5% drawdown) -> OK
    expect(riskManager.checkDrawdown(9500, hwm)).toBe(false);

    // Equity 9000 (10% drawdown) -> OK (boundary)
    // Implementation check: < -0.1. So -0.1 is NOT < -0.1.
    expect(riskManager.checkDrawdown(9000, hwm)).toBe(false);

    // Equity 8900 (11% drawdown) -> BREACH
    expect(riskManager.checkDrawdown(8900, hwm)).toBe(true);
  });

  it('should calculate position size correctly (Risk Unit)', () => {
    // Equity 10000, Risk 1% = 100.
    // Entry 100, Stop 95. Risk per share = 5.
    // Size = 100 / 5 = 20 shares.
    const size = riskManager.calculatePositionSize(10000, 100, 95);
    expect(size).toBe(20);
  });

  it('should calculate ATR-based stop loss', () => {
    // Entry 100, ATR 2, Multiplier 2 -> Distance 4.
    // Long: 100 - 4 = 96.
    const longStop = riskManager.calculateATRStop(100, 2, 'BUY');
    expect(longStop).toBe(96);

    // Short: 100 + 4 = 104.
    const shortStop = riskManager.calculateATRStop(100, 2, 'SELL');
    expect(shortStop).toBe(104);
  });

  it('should update trailing stop correctly (Ratchet Effect)', () => {
    // BUY position. Current stop 90.
    // Case 1: High 100, ATR 2 -> New potential stop = 100 - 4 = 96.
    // 96 > 90, so stop should move to 96.
    let stop = riskManager.updateTrailingStop(90, 100, 95, 2, 'BUY');
    expect(stop).toBe(96);

    // Case 2: Price drops. High 98, ATR 2 -> New potential = 98 - 4 = 94.
    // 94 < 96, so stop stays at 96.
    stop = riskManager.updateTrailingStop(96, 98, 92, 2, 'BUY');
    expect(stop).toBe(96);

    // SELL position. Current stop 110.
    // Case 3: Low 100, ATR 2 -> New potential stop = 100 + 4 = 104.
    // 104 < 110, so stop should move down to 104.
    stop = riskManager.updateTrailingStop(110, 105, 100, 2, 'SELL');
    expect(stop).toBe(104);

    // Case 4: Price rises. Low 102, ATR 2 -> New potential = 102 + 4 = 106.
    // 106 > 104, so stop stays at 104.
    stop = riskManager.updateTrailingStop(104, 108, 102, 2, 'SELL');
    expect(stop).toBe(104);
  });

  it('should handle zero risk per share (Entry = Stop)', () => {
    const size = riskManager.calculatePositionSize(10000, 100, 100);
    expect(size).toBe(0);
  });

  it('should detect stop loss hits', () => {
    // Long Position
    const longPos: Position = {
      symbol: 'AAPL',
      quantity: 10,
      averagePrice: 100,
      stopLoss: 95
    };
    const candleHitLong: Candle = {
      time: new Date(), open: 96, high: 97, low: 94, close: 95, volume: 100
    };
    expect(riskManager.checkExits(candleHitLong, longPos)).toBe('STOP_LOSS');

    // Short Position
    const shortPos: Position = {
      symbol: 'AAPL',
      quantity: -10,
      averagePrice: 100,
      stopLoss: 105
    };
    const candleHitShort: Candle = {
      time: new Date(), open: 100, high: 106, low: 99, close: 105, volume: 100
    };
    expect(riskManager.checkExits(candleHitShort, shortPos)).toBe('STOP_LOSS');
  });

  it('should detect take profit hits', () => {
    // Long Position
    const longPos: Position = {
      symbol: 'AAPL',
      quantity: 10,
      averagePrice: 100,
      takeProfit: 110
    };
    const candleHitLong: Candle = {
      time: new Date(), open: 105, high: 112, low: 104, close: 108, volume: 100
    };
    expect(riskManager.checkExits(candleHitLong, longPos)).toBe('TAKE_PROFIT');

    // Short Position
    const shortPos: Position = {
      symbol: 'AAPL',
      quantity: -10,
      averagePrice: 100,
      takeProfit: 90
    };
    const candleHitShort: Candle = {
      time: new Date(), open: 95, high: 98, low: 88, close: 92, volume: 100
    };
    expect(riskManager.checkExits(candleHitShort, shortPos)).toBe('TAKE_PROFIT');
  });

  it('should detect trending vs choppy markets (Regime Detection)', () => {
    const configWithAdx: RiskConfig = {
      ...defaultConfig,
      adxThreshold: 25,
      adxPeriod: 14
    };
    const rm = new RiskManager(configWithAdx);

    // Create 40 trending candles
    const trendingCandles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      trendingCandles.push({
        time: new Date(2024, 0, i + 1),
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000
      });
    }
    // High ADX (Trending)
    expect(rm.isMarketTrending(trendingCandles)).toBe(true);

    // Create 40 choppy candles
    const choppyCandles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      choppyCandles.push({
        time: new Date(2024, 0, i + 1),
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000
      });
    }
    // Low ADX (Choppy)
    expect(rm.isMarketTrending(choppyCandles)).toBe(false);
  });

  it('should detect daily loss limit breach (Portfolio Guard)', () => {
    const configWithDLL: RiskConfig = {
      ...defaultConfig,
      dailyLossLimitPct: 0.02 // 2%
    };
    const rm = new RiskManager(configWithDLL);
    const equity = 10000;
    const today = new Date('2024-01-10T00:00:00Z');

    // 1. One losing trade today (-150 = 1.5%) -> OK
    const tradesOk = [
      {
        timestamp: new Date('2024-01-10T10:00:00Z'),
        action: 'SELL' as const,
        price: 90,
        quantity: 10,
        fee: 5,
        totalValue: 900,
        realizedPnL: -150
      }
    ];
    expect(rm.checkDailyLoss(tradesOk, equity, today)).toBe(false);

    // 2. Multiple losing trades today (-250 = 2.5%) -> BREACH
    const tradesBreach = [
      ...tradesOk,
      {
        timestamp: new Date('2024-01-10T14:00:00Z'),
        action: 'SELL' as const,
        price: 85,
        quantity: 5,
        fee: 5,
        totalValue: 425,
        realizedPnL: -100
      }
    ];
    expect(rm.checkDailyLoss(tradesBreach, equity, today)).toBe(true);

    // 3. Heavy loss but yesterday -> OK
    const tradesYesterday = [
      {
        timestamp: new Date('2024-01-09T10:00:00Z'),
        action: 'SELL' as const,
        price: 80,
        quantity: 100,
        fee: 5,
        totalValue: 8000,
        realizedPnL: -1000
      }
    ];
    expect(rm.checkDailyLoss(tradesYesterday, equity, today)).toBe(false);
  });

  it('should detect correlation breach', () => {
    const configWithCorr: RiskConfig = {
      ...defaultConfig,
      maxCorrelation: 0.8
    };
    const rm = new RiskManager(configWithCorr);

    // Candidate: [1%, 2%, 3%, 4%, 5%]
    const candidateReturns = [0.01, 0.02, 0.03, 0.04, 0.05];

    // Existing Position A: Highly correlated (almost identical)
    // [1.1%, 2.1%, 3.1%, 4.1%, 5.1%] -> Corr 1.0
    const portfolioReturns = new Map<string, number[]>();
    portfolioReturns.set('AAPL', [0.011, 0.021, 0.031, 0.041, 0.051]);

    expect(rm.checkCorrelation(candidateReturns, portfolioReturns)).toBe(true); // Breach > 0.8

    // Existing Position B: Uncorrelated
    const portfolioUncorrelated = new Map<string, number[]>();
    portfolioUncorrelated.set('GLD', [0.05, 0.04, 0.03, 0.02, 0.01]); // Negative correlation

    expect(rm.checkCorrelation(candidateReturns, portfolioUncorrelated)).toBe(false); // No Breach
  });

  it('should calculate Bollinger Band Take Profit', () => {
    // Create 20 candles with prices moving up
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      candles.push({
        time: new Date(2023, 0, i + 1),
        open: 10 + i, high: 12 + i, low: 8 + i, close: 10 + i, volume: 1000
      });
    }
    // Prices: 10, 11, ..., 29.
    // Mean (SMA20) = (10+29)/2 = 19.5
    // StdDev of [10...29] is approx 5.766
    // Upper Band = 19.5 + 2 * 5.766 = 31.03
    // Lower Band = 19.5 - 2 * 5.766 = 7.97

    // For BUY, we expect Upper Band
    const tpBuy = riskManager.calculateBollingerTakeProfit(candles, 'BUY');
    expect(tpBuy).toBeCloseTo(31.03, 1);

    // For SELL, we expect Lower Band
    const tpSell = riskManager.calculateBollingerTakeProfit(candles, 'SELL');
    expect(tpSell).toBeCloseTo(7.97, 1);

    // Not enough data (< 20 candles)
    const fewCandles = candles.slice(0, 19);
    expect(riskManager.calculateBollingerTakeProfit(fewCandles, 'BUY')).toBeNull();
  });
});
