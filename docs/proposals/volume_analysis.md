# Proposal: Volume Analysis Integration

**Status:** Draft
**Date:** 2026-01-11
**Context:** Future Enhancements (Signal Quality & Liquidity Safety)

## 1. The "Fuel" of Price Action
Currently, our system relies heavily on Price-derived indicators (RSI, MACD, SMA). While effective, these ignore the "fuel" driving the moves: **Volume**.

Volume provides the "conviction" behind a price move. A 5% rally on low volume is a "trap." A 5% rally on massive volume is a "breakout."

## 2. Proposed Modules

### 2.1 Indicators (The Logic)
We should implement the following volume-based indicators to upgrade our `Strategy Core`:

1.  **OBV (On-Balance Volume):**
    *   **Concept:** Cumulative volume added on up-days and subtracted on down-days.
    *   **Usage:** Divergence. If Price makes a Lower Low but OBV makes a Higher Low, smart money is accumulating.
2.  **VWAP (Volume Weighted Average Price):**
    *   **Concept:** The average price paid by all participants, weighted by volume.
    *   **Usage:** Institutional benchmark. If Price > VWAP, the trend is bullish.
3.  **MFI (Money Flow Index):**
    *   **Concept:** "Volume-weighted RSI."
    *   **Usage:** Identifies overbought/oversold conditions where volume supports the reversal.

### 2.2 Risk Management (The Defense)

1.  **Volume Validation Filter:**
    *   **Logic:** "Reject any BUY signal if the breakout candle's volume is < 1.5x the 20-day Average Volume."
    *   **Why:** Prevents entering low-conviction moves that often reverse immediately.

2.  **Liquidity Constraints (Backtesting Reality):**
    *   **Logic:** "Max Trade Size = 1% of Candle Volume."
    *   **Why:** Currently, our backtester assumes infinite liquidity. In reality, large orders in thin markets cause massive slippage. This constraint forces the strategy to be realistic about scalability.

## 3. Implementation Plan

1.  **Library Expansion:** Create `src/logic/indicators/volume.ts` implementing OBV and VWAP.
2.  **Liquidity Guard:** Update `Backtester` and `RiskManager` to check `currentCandle.volume` before sizing a position.
3.  **Strategy Upgrade:** Create a `VolumeTrendStrategy` that combines ADX (Trend) with OBV (Confirmation).

## 4. Conclusion
Integrating volume transforms the system from a "Technical Analysis" bot into a "Market Mechanics" engine, aligning closer with how institutional algorithms operate.
