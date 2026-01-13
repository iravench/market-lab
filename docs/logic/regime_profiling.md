# Asset Regime Profiling (Asset Personality)

**Implemented:** Phase 8
**Status:** Active

## 1. The Concept

Traditional backtesting asks: *"Does this strategy work on this asset?"*
Regime Profiling asks: *"What kind of strategy does this asset prefer?"*

By inverting the question, we stop trying to force square pegs (Trend Strategies) into round holes (Mean Reverting Assets). We assume every asset has a "Personality" or "Regime Bias" that persists over time.

## 2. The Canonical Suite

To fingerprint an asset, we test it against four standardized "Archetypes" of market behavior. We do not optimize these strategies for profit; we optimize them to see *which one fits best*.

| Archetype | Strategy | Logic | Regime Identified |
| :--- | :--- | :--- | :--- |
| **Trend Following** | `EmaAdxStrategy` | Moving Average Crossover + ADX | **TRENDING** |
| **Mean Reversion** | `BollingerMeanReversionStrategy` | Bollinger Bands + MFI | **MEAN_REVERSION** |
| **Volatility Breakout** | `VolatilityBreakoutStrategy` | Donchian Channel Break + Volume | **VOLATILE_BREAKOUT** |
| **Passive Beta** | `BuyAndHoldStrategy` | Buy & Hold | **BULL_MARKET** |

## 3. The Profiling Methodology

The `RegimeProfiler` performs the following steps for a given asset (e.g., `CBA.AX`):

1.  **Window Slicing:** The history is divided into Annual Windows (e.g., 2023, 2024, 2025).
2.  **Bayesian Optimization (TPE):**
    *   For each window, **ALL** canonical strategies are optimized using TPE (Tree-structured Parzen Estimator).
    *   We search for the parameters that maximize the chosen **Objective** (default: `sharpeRatio`).
3.  **Classification:**
    *   The results are passed to a **RegimeClassifier** specific to the objective.
    *   **Sharpe Classifier:**
        *   If `BuyAndHold` Sharpe > 2.5 and > Trend Sharpe, we classify as `BULL_MARKET`.
        *   If the best strategy has Sharpe < 0.5, the year is classified as `CHOPPY`.
    *   **Generic Classifier (e.g., Calmar/Sortino):**
        *   Winner takes all if above a quality threshold (e.g., 0.5).

## 4. Usage

Run the profiler via CLI:

```bash
npm run profile-asset <SYMBOL> <START_DATE> <END_DATE> [--objective=metric]
# Example
npm run profile-asset CBA.AX 2020-01-01 2024-01-01 -- --objective=calmarRatio
```

### Example Output

```text
==========================================
🧠 ASSET IDENTITY: CBA.AX
📝 Conclusion: Asset CBA.AX is predominantly CHOPPY.
==========================================
┌──────┬─────────────────────┬───────────────────────┬────────┐
│ Year │ Regime              │ Winner                │ Sharpe │
├──────┼─────────────────────┼───────────────────────┼────────┤
│ 2023 │ 'VOLATILE_BREAKOUT' │ 'Volatility Breakout' │ '2.44' │
│ 2024 │ 'CHOPPY'            │ 'None'                │ '0.00' │
│ 2025 │ 'CHOPPY'            │ 'None'                │ '0.00' │
└──────┴─────────────────────┴───────────────────────┴────────┘
```

## 5. Strategic Implication

Once an asset is profiled:
*   **Trending Assets:** Deploy `EmaAdxStrategy` or Breakout logic.
*   **Mean Reverting Assets:** Deploy `RsiStrategy` or Grid bots.
*   **Choppy Assets:** **Do not trade.** Remove from watchlist.

This filter significantly improves portfolio Sharpe Ratio by avoiding "Bad Games."
