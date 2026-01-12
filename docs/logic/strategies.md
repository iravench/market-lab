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

### EMA-ADX Trend Follower (`EmaAdxStrategy`)

A trend-following strategy that uses Exponential Moving Average (EMA) crossovers for entry/exit and the Average Directional Index (ADX) as a strength filter.

#### Logic
*   **Buy Signal:** When the Fast EMA crosses *above* the Slow EMA AND the ADX is above a specific threshold (e.g., 25). This indicates momentum is shifting upwards and the trend is strong enough to avoid a whipsaw.
*   **Sell Signal:** When the Fast EMA crosses *below* the Slow EMA. This indicates the trend is losing steam or reversing.
*   **Hold:** In all other cases (neutral, weak trend, or no recent crossover).

#### Configuration
```typescript
interface EmaAdxStrategyConfig {
    fastPeriod: number;   // Period for the fast EMA (default: 9)
    slowPeriod: number;   // Period for the slow EMA (default: 21)
    adxPeriod: number;    // Lookback for ADX calculation (default: 14)
    adxThreshold: number; // Minimum trend strength to enter (default: 25)
}
```

#### Strategic Value
This strategy is designed to capture the "meat" of a move while staying in cash during sideways, choppy markets where crossovers frequently fail.

---

### Volatility Breakout (`VolatilityBreakoutStrategy`)

A breakout strategy that aims to capture explosive moves using Donchian Channels and volume confirmation.

#### Logic
*   **Buy Signal:** When Close Price > Previous N-day High (Upper Donchian Channel) **AND** Volume > 1.5x Average Volume.
*   **Sell Signal:** When Close Price < Previous N-day Low (Lower Donchian Channel). This acts as a trailing stop.

#### Configuration
```typescript
interface VolatilityBreakoutConfig {
    donchianPeriod: number;   // Lookback for High/Low (default: 20)
    volumeSmaPeriod: number;  // Lookback for Avg Volume (default: 20)
    volumeMultiplier: number; // Factor for Volume Confirmation (default: 1.5)
}
```

#### Best For
"Explosive" regimes where price moves are sharp and sustained.

---

### Bollinger Mean Reversion (`BollingerMeanReversionStrategy`)

An enhanced mean-reversion strategy that combines Bollinger Bands with Money Flow Index (MFI).

#### Logic
*   **Buy Signal:** Price < Lower Band **AND** MFI < 20 (Oversold).
*   **Sell Signal:** Price > Upper Band **OR** MFI > 80 (Overbought).

#### Configuration
```typescript
interface BollingerMeanReversionConfig {
    bbPeriod: number;        // Bollinger Band Period (default: 20)
    bbMultiplier: number;    // Std Dev Multiplier (default: 2)
    mfiPeriod: number;       // MFI Period (default: 14)
    mfiBuyThreshold: number; // Oversold Level (default: 20)
}
```

#### Best For
"Range Bound" or "Mean Reverting" regimes where price oscillates within a channel.

---

### Buy & Hold (`BuyAndHoldStrategy`)

The baseline benchmark strategy.

#### Logic
*   **Buy Signal:** Always returns BUY. (Execution engine handles single entry).
*   **Sell Signal:** Never.

#### Best For
"Bull Markets" where market beta outperforms active management. Used as the control group for profiling.

