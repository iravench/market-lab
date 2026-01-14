# Proposal: Phase 8 - Asset Intelligence & Regime Profiling

**Status:** Draft / Conceptual
**Date:** 2026-01-12
**Context:** Post-Phase 7 (Optimization Lab)

## 1. The Vision: From "Does it work?" to "Why does it work?"

After building the Optimization Lab, we observed that optimization results don't just tell us which parameters are best; they reveal the **Market Regime** of the underlying asset.

If an optimized Trend Follower loses money while an optimized Mean Reverter breaks even, the asset is likely in a "Choppy" or "Mean Reverting" regime. **Phase 8** is about automating this meta-analysis to build a "Personality Profile" for any given stock.

## 2. Methodology: The "Regime Fingerprint"

Instead of testing one strategy, we test a **Canonical Strategy Suite** across multiple years. Each strategy in the suite represents a fundamental market behavior.

### 2.1. The Canonical Suite
1.  **Trend Following (TF):** EMA Cross + ADX filter. (Measures momentum conviction).
2.  **Mean Reversion (MR):** RSI + Bollinger Band Pullbacks. (Measures range-bound cycles).
3.  **Volatility Breakout (VB):** ATR-based Donchian Channel breaks. (Measures explosive movement).
4.  **Buy & Hold (BH):** Benchmark performance. (Measures structural bias).

### 2.2. The Profiling Loop
For a specific asset (e.g., `CBA.AX`):
1.  **Iterate Windows:** Loop through years (e.g., 2021, 2022, 2023, 2024).
2.  **Optimize All:** Run Bayesian Optimization for **all** strategies in the suite for that year.
3.  **Aggregate Metrics:** Record the best Sharpe Ratio achieved by each "Logic Type."
4.  **Classify:** Determine the dominant regime based on the winner.

## 3. The Asset Personality Profile

The result is a report that characterizes the asset's historical behavior:

*   **Logic Bias:** "CBA.AX has a 65% historical bias towards Mean Reversion."
*   **Regime Sensitivity:** "This asset turns 'Choppy' (No strategy wins) during high-interest rate environments."
*   **Parameter Stability:** "The Trend Follower has a stable 20-day EMA plateau across 3 out of 4 years."

## 4. Implementation Plan

### 4.1. The "Profiler" Script
A new script `npm run profile-asset <SYMBOL>` that:
1.  Loads multi-year data.
2.  Orchestrates the `OptimizationRunner` across the Strategy Suite.
3.  Generates a JSON/Markdown report of the "Personality."

### 4.2. Regime Detection Math
Define logic to classify a window:
*   **Strong Trend:** TF Sharpe > MR Sharpe AND TF Sharpe > 1.0.
*   **Range Bound:** MR Sharpe > TF Sharpe AND MR Sharpe > 1.0.
*   **Choppy / Grinding:** Max(All Strateges) Sharpe < 0.5.

## 5. Why this matters?

This prevents **Strategy-Asset Mismatch**. A trader often fails not because their strategy is bad, but because they are applying a Mean Reversion strategy to a stock that has a 90% "Trend Following" personality. This tool ensures we only play the games we are likely to win.

## 6. addtional information CHOPPY profiling

Using your existing list of metrics to identify a "choppy" stock is possible, but it requires an indirect approach. You can't measure "choppiness" directly with Sharpe or Drawdown alone; instead, you measure how badly a **Trend Following Strategy** fails on that stock.

To profile a stock as "Choppiness-Prone," you run a "Probe Backtest" using a standard Trend Following strategy (e.g., a simple Moving Average Crossover). If the stock is choppy, your metrics will show a specific "Failure Signature."

Here is how to interpret your metrics to detect chop, followed by advanced metrics specifically designed for this purpose.

### 1. The "Probe" Test: Detecting Chop via Failure

Run a basic **Moving Average Crossover** (e.g., SMA 50 vs SMA 200) on the stock. If the stock is choppy, the algorithm will get "whipsawed" (constantly buying high and selling low). Look for this specific data signature in your results:

| Metric | "Choppy" Signature | Why? |
| --- | --- | --- |
| **Win Rate** | **Extremely Low (< 30%)** | Choppy markets trigger false breakouts. The bot enters, the price immediately reverses, and it hits the stop loss. |
| **Max Drawdown** | **Steady Decline ("Bleed")** | Unlike a crash (sharp drop), chop causes a "death by a thousand cuts." The equity curve slopes downward consistently. |
| **Sortino Ratio** | **< 0.5** | Choppiness creates downside volatility (losses) without the upside volatility (big trend wins) to compensate. |
| **SQN** | **< 1.0 (Poor)** | Your "edge" is non-existent. The relationship between your expectancy and the standard deviation of your trades is weak. |
| **Trade Count** | **Abnormally High** | In a sideways market, price crosses moving averages frequently, triggering excessive over-trading. |

**Conclusion:** If you run a Trend Strategy and see a **High Trade Count + Low Win Rate**, that stock is mathematically "Choppy."

---

### 2. Advanced Profiling: Metrics Designed for Efficiency

While the standard metrics tell you *that* a strategy failed, they don't tell you *why*. Professional quants use specific "Efficiency Metrics" to profile the nature of a stock's movement before they even apply a strategy.

You should consider calculating these as "Meta-Metrics" for your stock profiling:

#### A. Kaufman Efficiency Ratio (KER)

This measures the "smoothness" of a trend. It compares the net price change to the total path traveled.

* **Formula:** `Abs(Price_Change) / Sum(Individual_Candle_Changes)`
* **Interpretation:**
* **Near 1.0:** Highly Trending (Smooth, efficient straight line).
* **Near 0.0:** Highly Choppy (Price moved a lot but went nowhere).


* **Profiling Rule:** If a stock's average KER over the last year is < 0.3, it is a "Choppy Instrument".

#### B. The Hurst Exponent (H)

This is a statistical measure used to classify a time series as "Mean Reverting" (Choppy) or "Persistent" (Trending).

* **Interpretation:**
* **H < 0.5:** Mean Reverting (Choppy). If price goes up, it is likely to go down next.
* **H = 0.5:** Random Walk (Geometric Brownian Motion). Hard to predict.
* **H > 0.5:** Trending. If price goes up, it is likely to continue up.


* **Profiling Rule:** If `H < 0.45`, the stock is naturally choppy and suitable for **Mean Reversion** bots (e.g., Bollinger Bands), but fatal for Trend bots.

#### C. Choppiness Index (CI)

A dedicated indicator that creates a score from 0 to 100 based on the ATR (volatility) relative to the price range.

* **Interpretation:**
* **> 61.8:** Market is consolidating/choppy.
* **< 38.2:** Market is trending.


* **Profiling Rule:** Calculate the percentage of time the stock spends with a CI > 61.8. If it's > 50% of the time, avoid running trend strategies on it.

### 3. Summary: The Profiling Workflow

Do not just run one strategy on all stocks. Use this two-step "Qualification" process:

1. **Step 1 (The Filter):** Calculate the **Hurst Exponent** for the stock's history.
* If `H < 0.5`: Label as "Mean Reverting". **Only** apply Bollinger Band/RSI strategies.
* If `H > 0.5`: Label as "Trending". **Only** apply Breakout/Moving Average strategies.


2. **Step 2 (The Validation):** Run the chosen strategy and check the **SQN (System Quality Number)**.
* If `SQN > 2.0`, your profile was correct, and the strategy fits the market type.

## 7. addtional information other types of profiling

While "Choppy" vs. "Trending" is the most critical distinction for immediate survival, professional quants categorize stocks into deeper "Personality Profiles" to match them with the correct mathematical models.

Using your backtest metrics (Sharpe, Drawdown, SQN) combined with the "Meta-Metrics" (Hurst, Efficiency Ratio), you can classify stocks into four distinct profiles.

### 1. The "Trend Runner" (Persistent)

These stocks exhibit "Long Memory." If they move up today, they are statistically likely to move up tomorrow.

* **Ideal Strategy:** Moving Average Crossovers, Breakouts, Trailing Stops.
* **The "Fingerprint" to look for:**
* **Hurst Exponent:**  (Strong persistence).
* **Kaufman Efficiency Ratio (KER):** High (). Price moves in straight lines with little noise.
* **Backtest Validation:** Run a simple "Buy & Hold" or "SMA 50/200 Cross."
* *Result:* High Win Rate (> 50%), High Ratio of Avg Win/Avg Loss.
* *Sharpe:* High (> 1.5).

### 2. The "Mean Reverter" (Elastic)

These stocks act like a rubber band. When they stretch too far from the average price, they snap back. They hate distinct trends and prefer to stay within a value zone.

* **Ideal Strategy:** Bollinger Bands, RSI Oversold/Overbought, Grid Trading.
* **The "Fingerprint" to look for:**
* **Hurst Exponent:**  (Anti-persistence).
* **ADX:** Consistently low ().
* **Augmented Dickey-Fuller (ADF) Test:** Returns a p-value  (indicating the price series is "Stationary" or stable over time).
* **Backtest Validation:** Run a "Bollinger Band Reversal" strategy.
* *Result:* High Win Rate (> 65%), but potentially lower Avg Win/Avg Loss (many small wins).

### 3. The "Random Walker" (Noise)

This is the most dangerous profile. The price movement is purely stochastic (random). Past prices contain **zero** information about future prices.

* **Ideal Strategy:** **Do Not Trade.** (Or sell options to harvest premium, if you are advanced).
* **The "Fingerprint" to look for:**
* **Hurst Exponent:**  (Pure randomness).
* **Backtest Validation:** Run *any* strategy.
* *Result:* SQN . Results look like coin flips (50% win rate, 1:1 risk/reward) minus transaction costs.
* *Equity Curve:* A slow, steady bleed downward due to spread and fees.

### 4. The "Regime Shifter" (Unstable)

These stocks alternate violently between quiet ranges and explosive trends. This often happens in biotech or meme stocks.

* **Ideal Strategy:** Volatility Breakout (buying only when volatility explodes).
* **The "Fingerprint" to look for:**
* **Kurtosis:** High (). This statistical measure indicates "Fat Tails"—frequent extreme events.
* **Backtest Validation:** Trend strategies will show massive drawdowns followed by massive spikes. The **Calmar Ratio** will be low because the Max Drawdown is huge, even if total return is high.


### Implementation: The "Pre-Flight" Profiler

Before you let your bot trade a stock, run a **Profiling Script** that calculates these metrics over the last 500 candles.

| Profile | Hurst Exp | ADX (14) | Efficiency Ratio | Action |
| --- | --- | --- | --- | --- |
| **Trend Runner** |  |  |  | Enable **Trend Strategy** |
| **Mean Reverter** |  |  |  | Enable **Mean Reversion Strategy** |
| **Random / Noise** |  | Mixed | Mixed | **BLACKLIST** (Do not trade) |

### Professional Insight: Hidden Markov Models (HMM)

Hedge funds don't just calculate these metrics once; they assume the profile changes over time. They use **Hidden Markov Models (HMM)** to detect the "Invisible State" of the market.

* *State 0:* Low Volatility Bull (Steady growth) -> **Leverage Up.**
* *State 1:* High Volatility Bear (Crash) -> **Cash / Short.**
* *State 2:* Chop -> **Stand Aside.**

Since you are using Python, you can use the `hmmlearn` library to feed in returns and volatility data. The model will output the "probability" that the stock is currently in a specific regime (e.g., "80% chance we are in a Bear State"). This allows your bot to switch profiles dynamically.
