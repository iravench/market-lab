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
});
