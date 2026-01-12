import { Candle } from '../types';
import { calculateOBV, calculateVWAP, calculateMFI } from '../indicators/volume';

describe('Volume Indicators', () => {
  const createCandle = (
    time: string,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number
  ): Candle => ({
    time: new Date(time),
    open,
    high,
    low,
    close,
    volume,
  });

  describe('OBV (On-Balance Volume)', () => {
    it('should calculate OBV correctly', () => {
      const candles: Candle[] = [
        createCandle('2023-01-01', 10, 10, 10, 100, 1000), // Base
        createCandle('2023-01-02', 10, 10, 10, 105, 500),  // Up (+500) -> 1500
        createCandle('2023-01-03', 10, 10, 10, 95, 200),   // Down (-200) -> 1300
        createCandle('2023-01-04', 10, 10, 10, 95, 100),   // Flat (0) -> 1300
        createCandle('2023-01-05', 10, 10, 10, 100, 300),  // Up (+300) -> 1600
      ];

      const result = calculateOBV(candles);

      expect(result).toHaveLength(5);
      expect(result).toEqual([1000, 1500, 1300, 1300, 1600]);
    });

    it('should handle empty input', () => {
      expect(calculateOBV([])).toEqual([]);
    });
  });

  describe('VWAP (Volume Weighted Average Price)', () => {
    // Standard VWAP is "Session VWAP" (resets daily), but for backtesting daily candles, 
    // we usually mean "Rolling VWAP" or just the cumulative average over the provided window
    // unless specified otherwise.
    // For this implementation, let's assume it calculates the VWAP over the provided candles window.
    
    it('should calculate rolling VWAP correctly', () => {
      const candles: Candle[] = [
        // TP = (12+8+10)/3 = 10. Vol 100. PV = 1000. SumV=100. VWAP=10
        createCandle('2023-01-01', 10, 12, 8, 10, 100), 
        // TP = (14+10+12)/3 = 12. Vol 100. PV = 1200. SumPV=2200. SumV=200. VWAP=11
        createCandle('2023-01-02', 12, 14, 10, 12, 100),
      ];

      const result = calculateVWAP(candles);
      
      expect(result[0]).toBeCloseTo(10, 2);
      expect(result[1]).toBeCloseTo(11, 2);
    });
  });

  describe('MFI (Money Flow Index)', () => {
    it('should calculate MFI correctly', () => {
      // Need a period to calculate MFI. Let's use period 2.
      // TP = (H+L+C)/3
      
      const candles: Candle[] = [
        // 0: TP=10. Vol=100. MF=1000. (Base)
        createCandle('2023-01-01', 10, 12, 8, 10, 100),
        
        // 1: TP=12 (>10). Vol=100. MF=1200. PosMF=1200. NegMF=0.
        // MFI (len 2): Needs 2 prev changes? MFI usually starts having values after period+1 or period.
        // Let's trace logic:
        // Window [0, 1]: Changes from 0->1.
        // Change 1: TP 10->12 (Pos 1200). 
        // Ratio = 1200 / 0 = Infinity? MFI -> 100.
        createCandle('2023-01-02', 12, 14, 10, 12, 100),

        // 2: TP=8 (<12). Vol=100. MF=800. NegMF=800.
        // Window [1, 2]:
        // Change 1 (Idx 1): Pos 1200.
        // Change 2 (Idx 2): Neg 800.
        // Period 2 Sums: Pos=1200, Neg=800. Ratio=1.5.
        // MFI = 100 - (100 / (1 + 1.5)) = 100 - (100/2.5) = 100 - 40 = 60.
        createCandle('2023-01-03', 8, 10, 6, 8, 100),
      ];

      const result = calculateMFI(candles, 2);

      // Expect nulls for initialization
      // MFI needs N previous price changes? Or just N periods of data?
      // Standard MFI: Sum(PosMF, N) / Sum(NegMF, N).
      // At index 0: No change. null.
      // At index 1: 1 change (Pos). null if we need 2 changes? Or is period 2 including current?
      // Usually like RSI: first `period` values are null/unstable.
      
      expect(result[2]).toBeCloseTo(60, 1);
    });
  });
});
