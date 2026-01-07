# Technical Indicators: The Building Blocks of Strategy

This document details the mathematical algorithms used in our "Logic Core." We implement these from scratch to ensure full transparency and avoid "black box" dependencies.

## 1. Simple Moving Average (SMA)

### What is it?
The SMA is the unweighted mean of the previous $N$ data points. It is the most fundamental smoothing tool in technical analysis.

### The Math
$$ SMA_t = \frac{P_t + P_{t-1} + ... + P_{t-n+1}}{N} $$

Where:
*   $P$ = Price (usually Close price)
*   $N$ = The period (e.g., 20 days)

### How to use it
*   **Trend Identification:** If Price > SMA, the trend is up. If Price < SMA, the trend is down.
*   **Support/Resistance:** Prices often bounce off major SMAs (like the 50-day or 200-day).
*   **Crossovers:** A "Golden Cross" happens when a short-term SMA (e.g., 50) crosses *above* a long-term SMA (e.g., 200).

---

## 2. Relative Strength Index (RSI)

### What is it?
The RSI is a **momentum oscillator** that measures the speed and change of price movements. It oscillates between 0 and 100.

### The Math
$$ RSI = 100 - \frac{100}{1 + RS} $$

Where $RS$ (Relative Strength) is:
$$ RS = \frac{\text{Average Gain}}{\text{Average Loss}} $$

**Important Implementation Detail (Wilder's Smoothing):**
The standard RSI uses a specific smoothing method for the averages, not a simple SMA.
*   $AvgGain_{now} = \frac{(AvgGain_{prev} \times (N-1)) + CurrentGain}{N}$

### How to use it
*   **Overbought:** RSI > 70. Suggests the asset may be overvalued and due for a correction (Sell signal).
*   **Oversold:** RSI < 30. Suggests the asset may be undervalued and due for a bounce (Buy signal).
*   **Divergence:** When price makes a new High, but RSI makes a lower High. This is a strong reversal signal.

---

## 3. Exponential Moving Average (EMA)

### What is it?
The EMA is a type of moving average that places **greater weight and significance on the most recent data points**.

### The Math
$$ EMA_t = (P_t \times k) + (EMA_{t-1} \times (1-k)) $$

Where:
*   $k$ (The Multiplier) = $2 / (N + 1)$
*   $P_t$ = Current Price
*   $N$ = The period

*Note: The very first EMA calculation in a series typically uses the SMA as a starting seed.*

### Why use it?
*   **Reduced Lag:** Because it reacts faster to price changes than the SMA, it is preferred by short-term traders.
*   **Crossovers:** The "MACD" indicator (Moving Average Convergence Divergence) relies entirely on the relationship between two EMAs (usually 12 and 26 periods).