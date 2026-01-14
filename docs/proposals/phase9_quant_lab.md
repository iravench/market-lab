# Proposal: Phase 9 - The Quant Lab (Statistical Profiling)

**Status:** Draft
**Date:** 2026-01-14
**Context:** Post-Phase 8 (Asset Intelligence)

## 1. The Vision: Physics + Empiricism

In **Phase 8**, we built a "Regime Profiler" that identifies market personalities by running a tournament of strategies.
**Phase 9** upgrades this profiler with "Statistical Physics." By measuring the fundamental properties of price movement (Roughness, Memory, Efficiency), we can classify assets with much higher confidence.

We are not building a new tool; we are **upgrading the brain** of the existing `RegimeProfiler`.

## 2. New Asset Classifications

We will move beyond the simple `TRENDING` vs `CHOPPY` binary to a robust 4-class system:

### 2.1. The "Trend Runner" (Persistent)
*   **Physics:** $H > 0.5$ (Long Memory), High Efficiency (KER $\approx$ 1.0).
*   **Behavior:** Price moves in smooth, efficient lines.
*   **Action:** **Aggressive Trend.** (Enable Breakouts, Trailing Stops).

### 2.2. The "Mean Reverter" (Elastic)
*   **Physics:** $H < 0.5$ (Anti-Persistent), Stationarity (ADF Test pass).
*   **Behavior:** Rubber-band action. Price snaps back to value.
*   **Action:** **Grid / Reversion.** (Enable Bollinger Bands, RSI).

### 2.3. The "Regime Shifter" (Volatile)
*   **Physics:** High Kurtosis (Fat Tails).
*   **Behavior:** Quiet periods punctuated by explosive violence.
*   **Action:** **Volatility Breakout Only.** (Sit out the quiet, catch the explosion).

### 2.4. The "Random Walker" (Noise)
*   **Physics:** $H \approx 0.5$ (Geometric Brownian Motion).
*   **Behavior:** Pure stochastic noise. Past contains zero info about future.
*   **Action:** **BLACKLIST.** (Do Not Trade).

## 3. Implementation Plan

### 3.1. Math Library Expansion (`src/logic/math/`)
Implement the core statistical functions:
*   `calculateHurstExponent(series)`: The Rescaled Range (R/S) analysis.
*   `calculateEfficiencyRatio(series)`: Kaufman's Efficiency Ratio.
*   `calculateKurtosis(series)`: Fourth moment of the distribution.

### 3.2. Profiler Upgrade (`src/logic/analysis/regimeProfiler.ts`)
The profiling loop will now run in two stages:
1.  **Physics Scan:** Calculate H, KER, ADX, and Kurtosis.
2.  **Strategy Tournament:** Run the Canonical Suite (as implemented in Phase 8).
3.  **Synthesis:**
    *   If Physics says "Random Walk" AND Tournament says "No Winner" -> **Classify as RANDOM_WALK**.
    *   If Physics says "Persistent" AND Tournament Trend Strategy wins -> **Classify as TREND_RUNNER**.

### 3.3. Trade Guard Adjustment (`src/scripts/trade.ts`)
Update the `RegimeGuard` to handle the new classifications:
*   `RANDOM_WALK` -> Block ALL trades.
*   `REGIME_SHIFTER` -> Allow *only* Volatility Breakout.

## 5. Migration & Alignment

Phase 9 is a refinement of Phase 8, not a replacement. We are mapping "What happened" (Empirical Regime) to "Why it happened" (Physical Profile).

| Phase 8 Regime (Empirical) | Phase 9 Profile (Physical) | Physics Signature |
| :--- | :--- | :--- |
| **TRENDING** | **Trend Runner** | $H > 0.5$, High Efficiency |
| **BULL_MARKET** | **Trend Runner** | $H > 0.5$, Positive Drift |
| **MEAN_REVERSION** | **Mean Reverter** | $H < 0.5$, Stationary |
| **VOLATILE_BREAKOUT** | **Regime Shifter** | High Kurtosis (Fat Tails) |
| **CHOPPY** | **Random Walker** | $H \approx 0.5$ (Noise) |

*Note: Phase 8's `CHOPPY` was a "catch-all" for anything that didn't work. Phase 9 specifically identifies `Random Walker` as "Mathematical Noise," allowing us to confidently blacklist it.*
