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
