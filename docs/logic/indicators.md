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

---

## 4. Average True Range (ATR)

### What is it?
The ATR is a **volatility indicator** that shows how much an asset moves, on average, during a given time frame. It does not provide trend direction, only the degree of price volatility.

### The Math
First, we calculate the **True Range (TR)**, which is the greatest of:
1.  Current High - Current Low
2.  |Current High - Previous Close|
3.  |Current Low - Previous Close|

$$ TR = \max[(H - L), |H - C_{prev}|, |L - C_{prev}|] $$

The **ATR** is then calculated using Wilder's Smoothing:
$$ ATR_t = \frac{(ATR_{prev} \times (N-1)) + TR_t}{N} $$

*Note: The first ATR in a series is the Simple Moving Average (SMA) of the first $N$ True Ranges.*

### How to use it
*   **Stop Loss Placement:** Setting a stop loss at $2 \times ATR$ below entry ensures the stop is outside the "noise" of normal volatility.
*   **Volatility-Adjusted Sizing:** Reducing position size when ATR is high and increasing it when ATR is low keeps dollar-risk constant.
*   **Regime Detection:** Expanding ATR suggests a breakout or increased market stress; contracting ATR suggests consolidation.

---

## 5. Average Directional Index (ADX)

### What is it?
The ADX is used to quantify **trend strength**. It does not indicate trend direction, only whether a strong trend (of any direction) is present.

### The Math
1.  **Directional Movement (DM):**
    *   $+DM = High_{now} - High_{prev}$ (if $> 0$ and $> Low_{prev} - Low_{now}$, else $0$)
    *   $-DM = Low_{prev} - Low_{now}$ (if $> 0$ and $> High_{now} - High_{prev}$, else $0$)
2.  **Directional Indicators (DI):**
    *   $+DI = 100 \times \frac{Smoothed +DM}{ATR}$
    *   $-DI = 100 \times \frac{Smoothed -DM}{ATR}$
3.  **Directional Index (DX):**
    *   $DX = 100 \times \frac{|+DI - -DI|}{+DI + -DI}$
4.  **ADX:** The smoothed average of $DX$.

### How to use it
*   **Trend Strength:** ADX > 25 indicates a strong trend. ADX < 20 indicates a weak trend or "chop."
*   **Filter:** Only execute trend-following strategies when ADX > 25.

---

## 6. Moving Average Convergence Divergence (MACD)

### What is it?
MACD is a **trend-following momentum indicator** that shows the relationship between two EMAs of an asset’s price.

### The Math
1.  **MACD Line:** $12\text{-period EMA} - 26\text{-period EMA}$
2.  **Signal Line:** $9\text{-period EMA}$ of the MACD Line.
3.  **Histogram:** $\text{MACD Line} - \text{Signal Line}$

### How to use it
*   **Momentum Validation:** If price is rising but MACD Histogram is falling (Divergence), the trend may be weakening.
*   **Crossovers:** MACD Line crossing above the Signal Line is a bullish signal.

---

## 7. Bollinger Bands

### What is it?
Bollinger Bands consist of a middle band (SMA) and two outer bands that are standard deviations away from the SMA.

### The Math
1.  **Middle Band:** $N\text{-period SMA}$
2.  **Upper Band:** $SMA + (k \times \sigma)$
3.  **Lower Band:** $SMA - (k \times \sigma)$
    *   $\sigma$ = Standard Deviation of price over $N$ periods.
    *   $k$ = Multiplier (typically 2).

### How to use it
*   **Volatility Squeeze:** When bands are very thin, it indicates low volatility and often precedes a major price breakout.
*   **Overextended:** Prices touching or exceeding the outer bands are statistically overextended and may revert to the mean.

---

## 8. On-Balance Volume (OBV)

### What is it?
OBV is a momentum indicator that uses volume flow to predict changes in stock price. It assumes that volume precedes price.

### The Math
$$
OBV_t = 
\begin{cases} 
OBV_{t-1} + Volume_t & \text{if } Close_t > Close_{t-1} \\
OBV_{t-1} - Volume_t & \text{if } Close_t < Close_{t-1} \\
OBV_{t-1} & \text{if } Close_t = Close_{t-1}
\end{cases}
$$

### How to use it
*   **Confirmation:** If price rises but OBV is flat or falling, the trend lacks conviction (divergence).
*   **Breakouts:** OBV often breaks trendline resistance *before* price does.

---

## 9. Volume Weighted Average Price (VWAP)

### What is it?
VWAP is the average price a security has traded at throughout the day (or period), based on both volume and price. It provides a benchmark for the "true" average price paid by participants.

### The Math
$$ VWAP = \frac{\sum (TypicalPrice \times Volume)}{\sum Volume} $$
Where $TypicalPrice = (High + Low + Close) / 3$.

### How to use it
*   **Institutional Benchmark:** Buying below VWAP is considered a "good value" entry; selling above is a "good exit."
*   **Trend Filter:** If Price > VWAP, the short-term trend is bullish.

---

## 10. Money Flow Index (MFI)

### What is it?
MFI is often called "Volume-weighted RSI." It measures buying and selling pressure between 0 and 100.

### The Math
1.  **Money Flow (MF):** $TypicalPrice \times Volume$
2.  **Positive MF:** Sum of MF for days where Typical Price rose.
3.  **Negative MF:** Sum of MF for days where Typical Price fell.
4.  **Money Flow Ratio:** $PositiveMF / NegativeMF$
5.  **MFI:** $100 - \frac{100}{1 + MoneyFlowRatio}$

### How to use it
*   **Oversold/Overbought:** Like RSI, MFI < 20 is oversold, MFI > 80 is overbought.
*   **Volume Divergence:** If price hits a new high but MFI fails to exceed its previous high, it indicates the rally is running on "fumes" (low volume).

---

## 11. Donchian Channels

### What is it?
Donchian Channels are formed by taking the highest high and the lowest low of the last $N$ periods. They identify the current trading range and potential breakouts.

### The Math
*   **Upper Channel:** $\max(High_{t-N} \dots High_{t-1})$
*   **Lower Channel:** $\min(Low_{t-N} \dots Low_{t-1})$
*   **Middle Channel:** $(Upper + Lower) / 2$

### How to use it
*   **Breakouts:** A close above the Upper Channel is a classic "Turtle Trading" buy signal (new N-day High).
*   **Trend Filter:** Price staying persistently above the Middle Channel indicates a strong uptrend.