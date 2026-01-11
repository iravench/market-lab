# Proposal: Phase 7 - The Optimization Lab (Strategy Tuning)

**Status:** Draft
**Date:** 2026-01-12
**Context:** Post-Phase 6 (Portfolio Intelligence)

## 1. The Vision: From "Building" to "Tuning"

We have successfully built a robust trading engine ("The Car"). It has reliable data, risk brakes, and a functional steering wheel (backtester).
**Phase 7** is about tuning the engine to win the race.

The goal is to transition from manual "guess and check" strategy development to a systematic, data-driven **Optimization Loop**.

## 2. Core Philosophy: Avoiding "Overfitting"

The biggest risk in algorithmic optimization is **Curve Fitting**: finding a configuration that worked perfectly in the past by luck, but fails in the future.

To mitigate this, we adhere to the "Slow is Fast" tuning principles:
1.  **Stability over Peak Performance:** We prefer a strategy that returns 15% consistently across many parameter settings (a "Plateau") over one that returns 50% at a single specific setting (a "Peak").
2.  **Walk-Forward Validation:** We never optimize on the entire dataset. We train on the past and validate on the "future" (Out-of-Sample).
3.  **Risk-Adjusted Metrics:** We optimize for **Calmar Ratio** (Return / Drawdown) and **SQN** (System Quality), not just raw profit.

## 3. Architecture: The Optimization Lab

We will build a native TypeScript "Optimization Layer" on top of the existing `Backtester`.

### 3.1. Expanded Metrics (The "Ruler")
The current metrics (Sharpe, Drawdown) are insufficient for assessing stability. We will add:
*   **Calmar Ratio:** `Annualized Return / Max Drawdown`. (Measures "Return per unit of crash risk").
*   **Sortino Ratio:** Penalizes only downside volatility.
*   **System Quality Number (SQN):** `sqrt(N) * (Expectancy / StdDev)`. Measures statistical significance.
*   **Expectancy:** Average R-Multiple per trade.

### 3.2. Persistence Layer (The "Lab Notebook")
We need to log every experiment to analyze the "landscape" of parameters.

**New Database Table: `backtest_runs`**
*   `id`: UUID
*   `strategy_name`: Text
*   `parameters`: JSONB (e.g., `{"rsiPeriod": 14, "stopLoss": 2.0}`)
*   `metrics`: JSONB (The full results)
*   `time_range`: Date Range
*   `git_commit`: Text (To track code version)

### 3.3. The Automator (The "Search Engine")
A CLI tool (`npm run optimize`) that accepts a search configuration. We will support multiple search strategies, evolving from simple to sophisticated.

#### A. Grid Search (The Baseline)
Exhaustively tests specific ranges (e.g., RSI [10, 14, 20]). Good for small parameter spaces.

#### B. Bayesian Optimization (The "AI" Approach)
Instead of blind guessing or exhaustive looping, we use **Bayesian Optimization** (e.g., via a library like `bayesopt-js` or a custom Gaussian Process implementation).
*   **Concept:** The system builds a probabilistic model ("surrogate") of the strategy's performance surface. It balances **Exploration** (trying unknown areas) vs. **Exploitation** (refining known good areas).
*   **Benefit:** drastically reduces the number of backtests needed to find optimal parameters compared to Grid Search.
*   **Workflow:**
    1.  Run 10 random configs to seed the model.
    2.  Model predicts the next best parameter set to try.
    3.  Run Backtest.
    4.  Update Model.
    5.  Repeat.

### 3.4. The Validator: Walk-Forward Analysis
Regardless of the search method (Grid or Bayesian), the result must be validated via **Walk-Forward Analysis**.
1.  **Train:** Optimize parameters on Year $N$.
2.  **Test:** Run the winner on Year $N+1$.
3.  **Repeat:** Aggregate the "Test" results to see the true performance.

## 4. Workflow Example

1.  **Define:** User creates `optimization_config.json`:
    ```json
    {
      "strategy": "RsiStrategy",
      "method": "bayesian",
      "parameters": {
        "period": { "min": 5, "max": 30, "type": "integer" },
        "riskPerTrade": { "min": 0.005, "max": 0.03, "type": "float" }
      },
      "objective": "calmarRatio",
      "iterations": 50
    }
    ```
2.  **Run:** `npm run optimize optimization_config.json`
3.  **Process:** The Bayesian Optimizer intelligently samples the space.
4.  **Visualize:**
    *   "Found local maximum at Period=14, Risk=0.015."
    *   "Convergence reached after 32 iterations."

## 5. Roadmap

1.  **Metric Expansion:** Implement Calmar, Sortino, SQN in `PerformanceAnalyzer`.
2.  **Database Persistence:** Create `backtest_runs` table and adapter.
3.  **Bayesian Core:** Integrate a lightweight Bayesian Optimization library suitable for Node.js.
4.  **Walk-Forward Engine:** Implement the Train/Test window rolling logic to wrap the optimizer.
