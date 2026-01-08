# Strategies: The Decision Engine

While **Indicators** tell us *what happened*, **Strategies** (or Signal Generators) tell us *what to do*. A strategy is a deterministic set of rules that transforms market data into actionable signals.

## 1. The Strategy Interface

All strategies must implement the `Strategy` interface. This ensures that the Backtester and Execution engines can interact with any strategy uniformly.

### Interface Definition

```typescript
interface Strategy {
    name: string;
    analyze(candles: Candle[]): Signal;
}

interface Signal {
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    timestamp: Date;
    reason?: string; // Human-readable explanation
}
```

### The `analyze` Method
*   **Input:** An array of historical `Candle` data (OHLCV). The last candle in the array is considered the "current" moment being analyzed.
*   **Output:** A `Signal` decision for that specific moment.
*   **Pure Functionality:** Ideally, strategies should be stateless (or at least deterministic). Given the same input `Candle[]`, they should always return the same `Signal`.

---

## 2. Implemented Strategies

### RSI Reversal (`RsiStrategy`)

A classic mean-reversion strategy based on the Relative Strength Index.

#### Logic
*   **Buy Signal:** When RSI drops below a "Oversold" threshold (default 30). This suggests the asset is undervalued and due for a bounce.
*   **Sell Signal:** When RSI rises above a "Overbought" threshold (default 70). This suggests the asset is overvalued and due for a correction.
*   **Hold:** When RSI is between the thresholds (neutral zone).

#### Configuration
```typescript
interface RsiStrategyConfig {
    period: number;       // Lookback period for RSI calculation (default: 14)
    buyThreshold: number; // Level to trigger BUY (default: 30)
    sellThreshold: number;// Level to trigger SELL (default: 70)
}
```

#### Example Scenarios
| Scenario | RSI Value | Config (Buy/Sell) | Signal | Reason |
| :--- | :--- | :--- | :--- | :--- |
| Market Crash | 25.0 | 30 / 70 | **BUY** | `RSI (25.00) < 30` |
| Bull Run | 85.0 | 30 / 70 | **SELL** | `RSI (85.00) > 70` |
| Sideways | 50.0 | 30 / 70 | **HOLD** | `RSI (50.00) is neutral` |
