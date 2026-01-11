# Market Lab: Algorithmic Backtesting & Paper Trading Engine

## 1. Mission

To master financial market mechanics and investment strategies by building a robust, verifiable simulation engine from the ground up. This project serves as both a technical playground (TypeScript/Node.js) and a financial learning tool.

## 2. Core Philosophy

* **Slow is Fast:** We prioritize deep architectural understanding and correctness over rapid feature delivery.
* **Verification First:** No real money is risked until strategies are proven via rigorous backtesting and paper trading.
* **Modularity:** The system is built "bit by bit," allowing development to pause and resume without context loss.

## 3. Architecture Overview

The system is composed of three decoupled domains:

1. **Data Ingestion (The Source):** Reliable ETL pipelines to fetch, normalize, and store time-series market data (OHLCV).
2. **Strategy Core (The Brain):** Pure functions that accept data and return signals/decisions, independent of execution details.
3. **Execution & Ledger (The Hands):** A double-entry accounting system to track orders, positions, and balances (simulated or real).

## 4. Roadmap & Milestones

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

### Phase 6: Portfolio Intelligence (Current)

* [ ] **Multi-Asset Backtester:** Upgrade `Backtester` to iterate a "Universe" timeline, enabling true portfolio simulation.
* [ ] **Sector Exposure:** Implement constraints to limit risk concentration (e.g., "Max 20% Technology").
* [ ] **Unified Loop:** Refactor `runBacktest.ts` to load and trade multiple assets simultaneously.
* [ ] **Goal:** A system that thinks in terms of a "Portfolio," not just individual stocks.

### Phase 7: The Optimization Lab (Strategy Tuning)

* [ ] **Metric Expansion:** Implement Calmar Ratio, Sortino Ratio, and SQN to measure stability.
* [ ] **Experiment Persistence:** Create a DB table (`backtest_runs`) to log every simulation result.
* [ ] **The Automator:** Build a CLI tool for Bayesian/Grid search optimization with Walk-Forward Validation.
* [ ] **Goal:** A data-driven research lab to find robust, stable strategy parameters.

## 5. Getting Started

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
    npm run backtest <SYMBOLS_CSV> <START> <END>
    # Example: npm run backtest "CBA.AX,NAB.AX,WBC.AX" 2023-01-01 2024-01-01
    ```

* **Paper Trading (Bot):**

    ```bash
    # 1. Create a Portfolio
    npm run create-portfolio "My Bot" 10000

    # 2. Run a Dry Run (No DB updates)
    npm run trade <PORTFOLIO_ID> CBA.AX DRY

    # 3. Run Live (Updates DB)
    npm run trade <PORTFOLIO_ID> CBA.AX LIVE
    ```

## 6. Development Guidelines

### Follow the loop

Always try to understand what the current phase and mileston is. If there is none, we should not be developing. Make sure new development phases and milestones are documented under the roadmap section.

After aquiring the current milestone, we double check and try to understand relevant documentations under `docs`, and update/add new necessary documents when missing, for the current milestone, so we always work with complete and refresh context in mind.

Then we should try to analyze and break down the milestone into a workable sized todo list, and work down the list. Follow the loop: work on the item -> document anything new -> add unit tests -> make sure all tests are passed -> git commit.

After a milestone is delivered, ensure it's well documented under relevant sections under `docs`, and marked it off from the roadmap section.

### Documentation Strategy

We treat documentation as a first-class citizen.

* **`docs/`:** This folder contains the **Knowledge Base**.
  * **Concepts:** If we implement a financial algorithm (like RSI), we document the *math* and *theory* in `docs/logic/`.
  * **Design:** Architectural decisions (like Schema Design) go in `docs/design/`.
* **Code Comments:** Focus on *why*, not *what*. Complex math should reference the `docs/` files.

### Testing Policy

* **Logic Core:** All indicators and strategy logic must have unit tests (`src/logic/__tests__`).
* **Zero Regression:** Ensure `npm test` passes before committing logic changes.
