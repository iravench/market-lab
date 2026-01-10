# Proposal: Multi-Asset Architecture & Data Alignment

**Status:** Draft
**Date:** 2026-01-11
**Context:** Phase 5 (Risk Management - Correlation Checks)

## 1. The Problem
The current architecture of `Backtester` and the `trade.ts` bot is **Symbol-Centric**. It loads data for a single symbol, runs a strategy, and executes trades.

However, advanced Risk Management features—specifically **Correlation Checks**—require **Portfolio-Centric** data awareness. To determine if a new trade in `TSLA` is safe, the system must calculate its correlation with existing positions in `AAPL`, `NVDA`, and `MSFT`.

This requires:
1.  **Multi-Asset Fetching:** Loading historical price history for *all* active positions + the candidate symbol.
2.  **Time Alignment:** Ensuring the return series for all assets are aligned by timestamp (handling different trading holidays, missing candles, etc.).

## 2. Proposed Solution: The `MarketDataProvider`

We need to introduce a centralized service to handle multi-asset data, abstracting the complexity of fetching and alignment.

### 2.1 Interface
```typescript
interface MarketDataProvider {
  /**
   * Fetches aligned closing prices for multiple symbols over a specific period.
   * Returns a map of Symbol -> PriceArray, where all arrays are of equal length
   * and correspond to the same timestamps.
   */
  getAlignedHistory(symbols: string[], startDate: Date, endDate: Date): Promise<Map<string, number[]>>;
}
```

### 2.2 Data Alignment Logic
The provider must handle gaps. If `Symbol A` trades on a day where `Symbol B` does not:
*   **Option A (Strict):** Drop the day (Intersection). Best for correlation math.
*   **Option B (Fill):** Forward-fill the last known price.
*   **Option C (Zero):** Treat as 0 return (Incorrect for correlation).

**Recommendation:** Intersection (Inner Join) on timestamps for Correlation calculations.

## 3. Integration Plan

### Phase 6: Portfolio Intelligence

1.  **Implement `MarketDataProvider`**:
    *   Methods to efficiently query the database for multiple symbols.
    *   Logic to perform "Inner Join" on timestamps in memory.

2.  **Refactor `RiskManager` Integration**:
    *   In `trade.ts`, before calling `riskManager.checkCorrelation()`:
        *   Identify all symbols in `portfolio.positions`.
        *   Call `MarketDataProvider.getAlignedHistory([candidate, ...positions])`.
        *   Calculate returns (% change) from these aligned prices.
        *   Pass the result to `checkCorrelation`.

3.  **Backtester Upgrade**:
    *   The `Backtester` currently takes `candles[]` for one symbol. It needs to be upgraded to accept a `Universe` of data or a `DataProvider` to simulate a real portfolio environment.

## 4. Conclusion
Implementing Correlation Checks fully requires this architectural upgrade. The logic for the math (`checkCorrelation`) exists, but the plumbing to feed it data does not.
