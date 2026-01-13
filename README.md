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

### Phase 8: Asset Intelligence & Market Physics (Active)

* [x] **Market Physics (Volume):** Implement OBV, VWAP, and MFI to measure move conviction.
* [x] **The "Canonical" Suite:** Implement standardized strategies (Trend, Mean Reversion, Volatility Breakout, Buy & Hold) as behavior benchmarks.
* [x] **Liquidity Guards:** Upgrade strategies to respect volume limits (avoiding "ghost" fills).
* [x] **Regime Profiler:** Build a tool to run multi-year meta-analysis to fingerprint "Asset Personality" (Trending vs. Choppy).
* [ ] **Goal:** A system that understands *what* an asset is (Regime) and *how* it moves (Volume), ensuring we only deploy strategies in their winning environments.

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

* **Backfill Data:**

    ```bash
    npm run backfill <SYMBOL> <START_DATE> <INTERVAL>
    # Example: npm run backfill CBA.AX 2024-01-01 1d
    ```

* **Verify Data:**

    ```bash
    npm run verify <SYMBOL>
    ```

* **Run Tests:**

    ```bash
    npm test
    ```

* **Run Backtest:**

    ```bash
    npm run backtest <SYMBOLS_CSV> <START> <END> [STRATEGY_NAME]
    # Example: npm run backtest "CBA.AX,NAB.AX" 2023-01-01 2024-01-01 "RsiStrategy"
    ```

    **Available Strategies:**
    *   `RsiStrategy` (Default)
    *   `EmaAdxStrategy`
    *   `VolatilityBreakoutStrategy`
    *   `BollingerMeanReversionStrategy`
    *   `BuyAndHoldStrategy`

    **Example Output:**
    ```text
    =======================================
    🏁 Backtest Complete: RSI Reversal
    =======================================
    Initial Capital:     $10000.00
    Final Capital:       $10131.82
    Total Return:        1.32%
    Max Drawdown:        3.63%
    Max Sector Exposure: 21.61%
    Sharpe Ratio:        0.287
    Win Rate:            57.14%
    Total Trades:        17

    📊 Final Portfolio: 100% Cash

    📜 Trade History (Last 3 per symbol):
      --- CBA.AX (Total Trades: 4) ---
      [2025-11-18] BUY 10 @ $151.45
      [2026-01-05] SELL 10 @ $156.63
    ```

    **Key Metrics:**
    *   **Max Sector Exposure:** The highest percentage of your portfolio concentrated in a single sector (e.g., Banking) at any point. Used to verify diversification.
    *   **Max Drawdown:** The largest peak-to-trough decline in portfolio value. Measures risk.
    *   **Sharpe Ratio:** Risk-adjusted return. > 1.0 is good, > 2.0 is excellent.

* **Run Optimization:**

    ```bash
    # Create a config file (e.g., config.json)
    npm run optimize config.json
    ```

    **Recommended Search Method:** Use `"searchMethod": "bayesian"` (TPE). It is significantly more efficient than Grid Search, finding optimal parameters in 10-20% of the iterations.

    **Available Strategies:** `RsiStrategy`, `EmaAdxStrategy`

    **Example `config.json`:**
    ```json
    {
      "strategyName": "RsiStrategy",
      "assets": ["CBA.AX"],
      "startDate": "2023-01-01",
      "endDate": "2024-01-01",
      "objective": "sharpeRatio",
      "searchMethod": "bayesian",
      "maxIterations": 50,
      "parameters": {
        "period": { "min": 5, "max": 30, "type": "integer" },
        "buyThreshold": { "min": 20, "max": 40, "type": "integer" }
      }
    }
    ```

* **Run Walk-Forward Analysis:**

    ```bash
    npm run walk-forward wf_config.json
    ```

    **Example `wf_config.json`:**
    ```json
    {
      "strategyName": "RsiStrategy",
      "assets": ["CBA.AX"],
      "startDate": "2023-01-01",
      "endDate": "2026-01-01",
      "trainWindowDays": 180,
      "testWindowDays": 90,
      "anchored": false,
      "objective": "sharpeRatio",
      "searchMethod": "bayesian",
      "maxIterations": 30,
      "parameters": {
        "period": { "min": 10, "max": 20, "type": "integer" },
        "buyThreshold": { "min": 25, "max": 35, "type": "integer" }
      }
    }
    ```

* **Paper Trading (Bot):**

    ```bash
    # 1. Create a Portfolio
    npm run create-portfolio "My Bot" 10000

    # 2. Run a Dry Run (No DB updates)
    npm run trade <PORTFOLIO_ID> <SYMBOL> DRY [STRATEGY_NAME]
    
    # 3. Run Live (Updates DB)
    npm run trade <PORTFOLIO_ID> <SYMBOL> LIVE [STRATEGY_NAME]
    ```
    
    *Note: Defaults to `RsiStrategy` if `STRATEGY_NAME` is omitted.*
