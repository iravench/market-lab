# Candlesticks: The Building Blocks of Market Data

Candlesticks are the standard method for visualizing price action over a specific time interval (e.g., 1 minute, 1 hour, 1 day). Unlike a simple line chart, a candlestick provides four distinct price points, offering a deeper view of market sentiment and volatility.

## 1. The Anatomy of a Candle (OHLCV)

Every candle represents a specific slice of time and consists of:

*   **Open (O):** The price when the time interval began.
*   **High (H):** The maximum price reached during the interval.
*   **Low (L):** The minimum price reached during the interval.
*   **Close (C):** The price when the time interval ended.
*   **Volume (V):** The total amount of the asset traded during that interval.

### The Components
*   **Real Body:** The thick part of the candle. It represents the range between the **Open** and **Close**.
*   **Wicks (Shadows):** The thin lines above and below the body. They represent the **High** and **Low** extremes that were reached but not sustained.

---

## 2. Interpretation

### Bullish Candle (usually Green or White)
*   **Condition:** Close > Open.
*   **Meaning:** Buyers were in control, and the price increased during the period.

### Bearish Candle (usually Red or Black)
*   **Condition:** Close < Open.
*   **Meaning:** Sellers were in control, and the price decreased during the period.

---

## 3. Why Candles Matter for Algorithmic Trading

In our system, we store historical data as a series of candles. By analyzing the relationship between these four points, we can derive "Signals":

1.  **Volatility:** Large wicks relative to the body indicate high volatility and uncertainty.
2.  **Momentum:** A series of candles with large bodies and small wicks suggests strong momentum in that direction.
3.  **Rejection:** A long upper wick (often called a "pin bar") suggests that the market rejected higher prices, indicating a possible reversal.

## 4. Timeframes
A candle's meaning is relative to its **Interval**:
*   **1m / 5m:** Used for high-frequency or "Scalping" strategies.
*   **1h / 4h:** Used for "Swing Trading" (holding positions for days).
*   **1d / 1w:** Used for long-term investing.
