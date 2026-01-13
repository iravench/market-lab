# Liquidity Guards (Volume Participation)

## 1. Context & Problem
In backtesting, "Ghost Fills" occur when the simulation fills an order size that would have been impossible in the real market without significant slippage or moving the price. For example, buying 1,000,000 shares on a candle where the total traded volume was only 500 shares.

To make our backtests realistic (Phase 8: Market Physics), we must respect **Volume Participation Limits**.

## 2. Specification

### 2.1. Volume Limit Configuration
We introduce a new setting in `RiskConfig`:
*   `volumeLimitPct` (number, default `0.10` or 10%).
    *   This represents the maximum percentage of a candle's total volume we are allowed to participate in.

### 2.2. Logic
For every trade execution (BUY or SELL) on a specific candle:

1.  **Determine Market Volume**: Get `currentCandle.volume`.
2.  **Calculate Max Participation**: `maxQty = currentCandle.volume * volumeLimitPct`.
3.  **Clamp Order**:
    *   **BUY**: `finalQty = min(desiredQty, maxQty)`.
    *   **SELL**: `finalQty = min(positionQty, maxQty)`.
4.  **Execution**:
    *   If `finalQty < desiredQty`, we execute a **Partial Fill**.
    *   **Partial BUY**: We simply buy less.
    *   **Partial SELL**: We sell a portion of the position. The remainder is held until the next candle (where we try to sell again if the signal persists, or if the exit logic is state-based).

### 2.3. Edge Cases
*   **Zero Volume**: `maxQty = 0`. No trade is executed.
*   **Data Missing Volume**: If volume is `0` or `null` in data, we default to `0` (conservative) or allow user to disable the guard. (Decision: Default to 0/Conservative).
