# Market Lab: Algorithmic Backtesting & Paper Trading Engine

## 1. Mission
**Market Lab** is a robust, modular financial simulation engine designed to master market mechanics and investment strategies. It prioritizes "Slow is Fast" development—focusing on correctness, verification, and deep architectural understanding over rapid feature delivery.

The system serves as a "Time Machine" and "Sandboxed Exchange," allowing users to:
1.  **Backtest** strategies against historical data (verify logic).
2.  **Optimize** parameters to find stable configurations.
3.  **Profile** assets to understand their market regime (Trend vs. Chop).
4.  **Paper Trade** in real-time to validate execution and psychology.

## 2. Core Philosophy

* **Slow is Fast:** We prioritize deep architectural understanding and correctness over rapid feature delivery.
* **Verification First:** No real money is risked until strategies are proven via rigorous backtesting and paper trading.
* **Modularity:** The system is built "bit by bit," allowing development to pause and resume without context loss.

## 3. Architecture
The system follows a strict separation of concerns:

### 3.1. Data Ingestion (The Source)
*   **`src/services/marketDataProvider.ts`:** Fetches data, handles normalization, and alignment.
*   **`src/db/`:** Repository layer abstracting TimescaleDB interactions.
*   **Schema:** Universal OHLCV format, using `TIMESTAMPTZ` for UTC alignment and `NUMERIC` for precision.

### 3.2. Strategy Core (The Brain)
*   **`src/logic/strategies/`:** Pure logic modules implementing the `Strategy` interface.
    *   **Registry:** `src/logic/strategies/registry.ts` maps names (e.g., "RsiStrategy") to implementations.
    *   **Strategies:** `RsiStrategy`, `EmaAdxStrategy`, `VolatilityBreakoutStrategy`, etc.
*   **`src/logic/indicators/`:** Math libraries (SMA, EMA, RSI, ATR, etc.) as pure functions.

### 3.3. Execution & Risk (The Hands & The Shield)
*   **`src/logic/backtester.ts`:** Event loop simulating time travel. Replays history candle-by-candle.
*   **`src/logic/portfolio.ts`:** Ledger system tracking cash, positions, and equity. Supports partial fills.
*   **`src/logic/risk/risk_manager.ts`:** The "Gatekeeper." Enforces:
    *   **Transactional Risk:** Position sizing (Risk Unit), Stop Loss, Trailing Stops.
    *   **Systemic Risk:** Max Drawdown, Daily Loss Limits.
    *   **Portfolio Risk:** Sector Exposure, Correlation checks.
    *   **Liquidity Guards:** Volume Participation Limits (new in Phase 8).

## 4. Key Technologies
*   **Language:** TypeScript (Node.js v18+) - chosen for type safety and ubiquity.
*   **Database:** TimescaleDB (PostgreSQL extension) - optimized for time-series OHLCV data.
*   **Containerization:** Docker & Docker Compose - manages the database infrastructure.
*   **Testing:** Jest - enforces the "Verification First" mandate with unit and integration tests.
*   **Data Source:** Yahoo Finance (via `yahoo-finance2`) - for historical and live market data.

## 5. Roadmap & Milestones

### Phase 1: The Data Foundation

* [x] Design database schema for time-series data (e.g., PostgreSQL/TimescaleDB).
* [x] Implement a market data adapter (e.g., using a free API like Alpha Vantage, Yahoo Finance, or Binance).
* [x] Build a CLI tool to backfill historical data for selected assets.
* [x] **Goal:** A local database populated with reliable historical candles.

### Phase 2: The Logic Core

* [x] Implement basic technical indicators (SMA, EMA, RSI) as pure functions.
* [x] Create a "Signal Generator" interface.
* [x] **Goal:** The ability to mathematically identify market conditions (e.g., "RSI > 70").

### Phase 3: The Time Machine (Backtester)

* [x] Build the event loop to replay historical data candle-by-candle.
* [x] Implement the "Broker" simulation (fees, slippage, order filling).
* [x] Generate performance reports (Sharpe ratio, Max Drawdown, Total Return).
* [x] **Goal:** Verify if a strategy *would have* made money in the past.

### Phase 4: Paper Trading (Forward Testing)

* [x] Implement a persistent Ledger for portfolio state.
* [x] Build a scheduler to run strategies on live data intervals (via CLI automation).
* [x] **Goal:** A "bot" that trades in real-time with fake money.

### Phase 5: Risk Management & Sophistication

* [x] **Indicators:** Implement ATR, ADX, MACD, Bollinger Bands.
* [x] **Risk Engine:** Implement Volatility-Adjusted Sizing (Risk Unit).
* [x] **Defensive Logic:** Implement Chandelier Exits (ATR Trailing Stops).
* [x] **Defensive Logic:** Implement Dynamic Take Profits (Bollinger Bands).
* [x] **Regime Detection:** Filter trades based on ADX (Trend vs Chop).
* [x] **Portfolio Guard:** Implement Daily Loss Limits.
* [x] **Portfolio Guard:** Implement Correlation checks.
* [x] **Goal:** A robust, professional-grade system that prioritizes capital preservation.

### Phase 6: Portfolio Intelligence (Completed)

* [x] **Multi-Asset Backtester:** Upgrade `Backtester` to iterate a "Universe" timeline, enabling true portfolio simulation.
* [x] **Sector Exposure:** Implement constraints to limit risk concentration (e.g., "Max 20% Technology").
* [x] **Unified Loop:** Refactor `runBacktest.ts` to load and trade multiple assets simultaneously.
* [x] **Goal:** A robust system that manages a "Portfolio" of assets with shared risk constraints.

### Phase 7: The Optimization Lab (Strategy Tuning) (Completed)

* [x] **Metric Expansion:** Implement Calmar Ratio, Sortino Ratio, and SQN to measure stability.
* [x] **Experiment Persistence:** Create a DB table (`backtest_runs`) to log every simulation result.
* [x] **The Automator:** Build a CLI tool for Grid/Random search optimization.
* [x] **The Validator:** Build Walk-Forward Analysis engine to ensure stability.
* [x] **The AI:** Implement native **Tree-structured Parzen Estimator (TPE)** for efficient Bayesian optimization.
* [x] **Goal:** A data-driven research lab to find robust, stable strategy parameters.

### Phase 8: Asset Intelligence & Market Physics (Completed)

* [x] **Market Physics (Volume):** Implement OBV, VWAP, and MFI to measure move conviction.
* [x] **The "Canonical" Suite:** Implement standardized strategies (Trend, Mean Reversion, Volatility Breakout, Buy & Hold) as behavior benchmarks.
* [x] **Liquidity Guards:** Upgrade strategies to respect volume limits (avoiding "ghost" fills).
* [x] **Regime Profiler:** Build a tool to run multi-year meta-analysis to fingerprint "Asset Personality" (Trending vs. Choppy).
* [x] **Goal:** A system that understands *what* an asset is (Regime) and *how* it moves (Volume), ensuring we only deploy strategies in their winning environments.

### Phase 9: The Quant Lab (Statistical Profiling) (Active)

* [x] **Math Library Expansion:** Implement `Hurst Exponent`, `Kaufman Efficiency Ratio (KER)`, and `Kurtosis` calculations.
* [x] **Profiler Upgrade:** Integrate "Physics Mode" into the `RegimeProfiler` to calculate these metrics alongside empirical strategy results.
* [ ] **Advanced Classification:** Move beyond `TRENDING/CHOPPY` to robust profiles:
    *   **Trend Runner (Persistent):** High Hurst (>0.5), High Efficiency.
    *   **Mean Reverter (Elastic):** Low Hurst (<0.5), Stationarity.
    *   **Regime Shifter (Volatile):** High Kurtosis (Fat Tails).
    *   **Random Walker (Noise):** Hurst ~0.5. **BLACKLIST**.
* [ ] **Goal:** Move from "Guess and Check" to "Measure and Select" using statistical physics, ensuring we strictly avoid Random Walks.

## 6. Getting Started

### Prerequisites

* **Node.js** (v18+)
* **Docker & Docker Compose** (for TimescaleDB)

### Setup

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Environment Setup:**
    Create a `.env` file from the example:

    ```bash
    cp .env.example .env
    ```

3. **Spin up the Database:**

    ```bash
    docker-compose up -d
    ```

4. **Run Migrations:**

    ```bash
    npm run migrate
    ```

### Usage

#### 1. Data Management

**`npm run backfill`**
*   **Purpose:** Download historical OHLCV data from Yahoo Finance to the local TimescaleDB.
*   **Command:** `npm run backfill <SYMBOL> <START_DATE> <INTERVAL>`
*   **Example:** `npm run backfill CBA.AX 2023-01-01 1d`
*   **Output:**
    ```text
    📥 Fetching 1d candles for CBA.AX starting from 2023-01-01...
    💾 Saving 768 candles to database...
    ✅ Successfully backfilled CBA.AX.
    ```

**`npm run verify`**
*   **Purpose:** Check data integrity (gaps, missing candles) for a symbol.
*   **Command:** `npm run verify <SYMBOL>`
*   **Example:** `npm run verify CBA.AX`
*   **Output:**
    ```text
    📊 Data Stats for CBA.AX:
    ┌─────────┬──────────┬───────────────┬──────────────────────────┬──────────────────────────┐
    │ (index) │ interval │ total_candles │ first_candle             │ last_candle              │
    ├─────────┼──────────┼───────────────┼──────────────────────────┼──────────────────────────┤
    │ 0       │ '1d'     │ '1531'        │ 2020-01-01T23:00:00.000Z │ 2026-01-14T05:10:25.000Z │
    └─────────┴──────────┴───────────────┴──────────────────────────┴──────────────────────────┘

    📅 Latest 5 candles:
    ┌─────────┬──────────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
    │ (index) │ time                     │ open                 │ close                │ volume               │
    ├─────────┼──────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
    │ 0       │ 2026-01-14T05:10:25.000Z │ '154.20'             │ '152.88'             │ '1888875'            │
    │ 1       │ 2026-01-12T23:00:00.000Z │ '155.00'             │ '154.82'             │ '1324215'            │
    └─────────┴──────────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
    ```

---

#### 2. Strategy Development (The Lab)

**`npm run backtest`**
*   **Purpose:** **Raw Simulation.** Tests strategy logic against history *without* external safety guards. It validates "Does the math work?" not "Should I trade this today?"
*   **Command:** `npm run backtest <SYMBOLS_CSV> <START> <END> [STRATEGY_NAME]`
*   **Example:** `npm run backtest "CBA.AX" 2023-01-01 2026-01-01 "RsiStrategy"`
*   **Key Outputs:**
    *   `Sharpe Ratio`: Risk-adjusted return (>1.0 is good).
    *   `Max Drawdown`: Maximum peak-to-trough loss.
*   **Result (CBA.AX):**
    ```text
    🏁 Backtest Complete: RSI Reversal
    Initial Capital:     10000.00
    Final Capital:       10107.28
    Total Return:        1.07%
    Max Drawdown:        1.00%
    Max Sector Exposure: 17.00%
    Sharpe Ratio:        0.502
    Sortino Ratio:       0.751
    Calmar Ratio:        0.355
    SQN:                 0.00
    Expectancy:          $36.09
    Win Rate:            100.00%
    Total Trades:        3

    📊 Final Portfolio Breakdown:
      Financials          : 15.89% ($1605.70)
      Cash                : 84.11% ($8501.58)

    📜 Trade History (Last 3 per symbol):
      --- CBA.AX (Total Trades: 3) ---
      [2025-03-11] BUY 11 @ $144.94 (Fee: $10.00)
      [2025-04-07] SELL 11 @ $149.13 (Fee: $10.00)
      [2025-11-18] BUY 10 @ $151.45 (Fee: $10.00)
    ```

**`npm run optimize`**
*   **Purpose:** Find the best parameters (e.g., RSI Period) for a strategy using Bayesian Optimization (TPE).
*   **Command:** `npm run optimize <CONFIG_FILE>`
*   **Example Config (`optimize_config.json`):**
    ```json
    {
      "strategyName": "RsiStrategy",
      "assets": ["CBA.AX"],
      "startDate": "2024-01-01",
      "endDate": "2025-01-01",
      "objective": "sharpeRatio",
      "searchMethod": "bayesian",
      "maxIterations": 5,
      "parameters": {
        "period": { "min": 5, "max": 30, "type": "integer" },
        "buyThreshold": { "min": 20, "max": 40, "type": "integer" }
      }
    }
    ```
*   **Output:**
    ```text
    🚀 Starting Optimization: RsiStrategy
    🎯 Objective: sharpeRatio
    🔎 Method: bayesian
    ⏳ Loading Market Data...
    🔄 Iteration 1: Testing {"period":25,"buyThreshold":28}... Done. sharpeRatio: 0.000
    ...
    ✅ Optimization Session Complete.
    ```

**`npm run walk-forward`**
*   **Purpose:** Validate if optimized parameters hold up in "Out of Sample" future data.
*   **Command:** `npm run walk-forward <WF_CONFIG_FILE>`
*   **Example Config (`wf_config.json`):**
    ```json
    {
      "strategyName": "RsiStrategy",
      "assets": ["CBA.AX"],
      "startDate": "2023-01-01",
      "endDate": "2025-01-01",
      "trainWindowDays": 365,
      "testWindowDays": 180,
      "anchored": false,
      "objective": "sharpeRatio",
      "searchMethod": "bayesian",
      "maxIterations": 5,
      "parameters": {
        "period": { "min": 10, "max": 20, "type": "integer" },
        "buyThreshold": { "min": 25, "max": 35, "type": "integer" }
      }
    }
    ```
*   **Output:**
    ```text
    🚀 Starting Walk-Forward Analysis: RsiStrategy
    📅 Total Range: 2023-01-01 to 2025-01-01
    📏 Windows: Train=365d, Test=180d, Anchored=false
    ⏳ Loading Market Data...
    ✅ Generated 3 Walk-Forward Windows.

    🔹 Window 1: Train [2023-01-01 -> 2024-01-01] | Test [2024-01-01 -> 2024-06-29]
       🏆 Best Train Params: {"period":11,"buyThreshold":32} (sharpeRatio: 0.000)
    ...
    🏁 Walk-Forward Complete.
    ```

---

#### 3. Asset Intelligence (The Analyst)

**`npm run profile-asset`**
*   **Purpose:** Determine an asset's "Personality" (Regime) by testing it against the Canonical Strategy Suite.
*   **Command:** `npm run profile-asset <SYMBOL> <START> <END>`
*   **Example:** `npm run profile-asset CBA.AX 2024-01-01 2026-02-01`
*   **Output:**
    ```text
    ==========================================
    🧠 ASSET IDENTITY: CBA.AX
    📝 Conclusion: Asset CBA.AX is predominantly CHOPPY.
    ==========================================
    ┌─────────┬──────┬──────────┬────────┬───────────┬────────┬────────┬────────┬────────┬─────────┬──────────┬─────────┐
    │ (index) │ Year │ Regime   │ Winner │ Score     │ Hurst  │ KER    │ Kurt   │ Trend  │ MeanRev │ Breakout │ BuyHold │
    ├─────────┼──────┼──────────┼────────┼───────────┼────────┼────────┼────────┼────────┼─────────┼──────────┼─────────┤
    │ 0       │ 2024 │ 'CHOPPY' │ 'None' │ '-999.00' │ '0.46' │ '0.13' │ '5.12' │ '0.00' │ '0.00'  │ '0.00'   │ '1.67'  │
    │ 1       │ 2025 │ 'CHOPPY' │ 'None' │ '-999.00' │ '0.56' │ '0.02' │ '6.42' │ '0.00' │ '0.00'  │ '0.00'   │ '-0.74' │
    └─────────┴──────┴──────────┴────────┴───────────┴────────┴────────┴────────┴────────┴─────────┴──────────┴─────────┘
    ```
*   **Significance:** Tells the Execution Engine *which* strategies are safe to run.

---

#### 4. Execution (The Trader)

**`npm run create-portfolio`**
*   **Purpose:** Initialize a new persistent portfolio ledger.
*   **Command:** `npm run create-portfolio <NAME> <INITIAL_CASH>`
*   **Example:** `npm run create-portfolio "Demo_Bot" 10000`

**`npm run trade`**
*   **Purpose:** **Guarded Execution.** Runs the strategy on Live/Paper data with **Regime Guards** active.
*   **Philosophy:** Unlike Backtesting, this tool **rejects** signals if the environment is unsuitable.
*   **Command:** `npm run trade <PORTFOLIO_ID> <SYMBOL> <MODE> [STRATEGY_NAME]`
*   **Example:** `npm run trade "pf_123" CBA.AX DRY "RsiStrategy"`
*   **Output (Regime Guard in action):**
    ```text
    🤖 Starting Bot for CBA.AX
    🧠 Strategy: RsiStrategy
    📥 Fetching latest market data...
    🛡️  Regime Check: CBA.AX is profiled as 'CHOPPY' for 2026.
    ⛔ TRADE BLOCKED: Market is CHOPPY. No strategies allowed.
    ```
*   **Safety Guards:**
    *   **Regime Guard:** Blocks trades in wrong environments based on `Asset Profiles`.
    *   **Liquidity Guard:** Partial fills based on volume participation limits.
    *   **Daily Loss Limit:** Halts trading if today's loss > 2%.
    *   **Correlation Filter:** Rejects trades highly correlated with existing holdings.

