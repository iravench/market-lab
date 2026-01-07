# Market Lab: Algorithmic Backtesting & Paper Trading Engine

## 1. Mission
To master financial market mechanics and investment strategies by building a robust, verifiable simulation engine from the ground up. This project serves as both a technical playground (TypeScript/Node.js) and a financial learning tool.

## 2. Core Philosophy
*   **Slow is Fast:** We prioritize deep architectural understanding and correctness over rapid feature delivery.
*   **Verification First:** No real money is risked until strategies are proven via rigorous backtesting and paper trading.
*   **Modularity:** The system is built "bit by bit," allowing development to pause and resume without context loss.

## 3. Architecture Overview
The system is composed of three decoupled domains:
1.  **Data Ingestion (The Source):** Reliable ETL pipelines to fetch, normalize, and store time-series market data (OHLCV).
2.  **Strategy Core (The Brain):** Pure functions that accept data and return signals/decisions, independent of execution details.
3.  **Execution & Ledger (The Hands):** A double-entry accounting system to track orders, positions, and balances (simulated or real).

## 4. Roadmap & Milestones

### Phase 1: The Data Foundation
*   [x] Design database schema for time-series data (e.g., PostgreSQL/TimescaleDB).
*   [x] Implement a market data adapter (e.g., using a free API like Alpha Vantage, Yahoo Finance, or Binance).
*   [x] Build a CLI tool to backfill historical data for selected assets.
*   [x] **Goal:** A local database populated with reliable historical candles.

### Phase 2: The Logic Core
*   [x] Implement basic technical indicators (SMA, EMA, RSI) as pure functions.
*   [ ] Create a "Signal Generator" interface.
*   [ ] **Goal:** The ability to mathematically identify market conditions (e.g., "RSI > 70").

### Phase 3: The Time Machine (Backtester)
*   [ ] Build the event loop to replay historical data candle-by-candle.
*   [ ] Implement the "Broker" simulation (fees, slippage, order filling).
*   [ ] Generate performance reports (Sharpe ratio, Max Drawdown, Total Return).
*   [ ] **Goal:** Verify if a strategy *would have* made money in the past.

### Phase 4: Paper Trading (Forward Testing)
*   [ ] Implement a persistent Ledger for portfolio state.
*   [ ] Build a scheduler to run strategies on live data intervals.
*   [ ] **Goal:** A "bot" that trades in real-time with fake money.

## 5. Getting Started

### Prerequisites
*   **Node.js** (v18+)
*   **Docker & Docker Compose** (for TimescaleDB)

### Setup
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Setup:**
    Create a `.env` file from the example:
    ```bash
    cp .env.example .env
    ```
3.  **Spin up the Database:**
    ```bash
    docker-compose up -d
    ```
4.  **Run Migrations:**
    ```bash
    npm run migrate
    ```

### Usage
*   **Backfill Data:**
    ```bash
    npm run backfill <SYMBOL> <START_DATE> <INTERVAL>
    # Example: npm run backfill CBA.AX 2024-01-01 1d
    ```
*   **Verify Data:**
    ```bash
    npm run verify <SYMBOL>
    ```
*   **Run Tests:**
    ```bash
    npm test
    ```

## 6. Development Guidelines

### Git Commit Style
We follow a structured commit convention to maintain a clear history:
1.  **Subject:** A concise summary of the change (e.g., `feat: implement RSI indicator`).
2.  **Body:** A detailed bulleted list explaining *what* changed and *why*.
    *   Example:
        ```text
        feat: implement core technical indicators (SMA, EMA, RSI)

        - Implemented pure math functions for SMA, EMA, and RSI with Wilder's Smoothing
        - Established Jest testing suite with 100% coverage
        - Added detailed documentation for logic and mathematical algorithms
        ```

### Documentation Strategy
We treat documentation as a first-class citizen.
*   **`docs/`:** This folder contains the **Knowledge Base**.
    *   **Concepts:** If we implement a financial algorithm (like RSI), we document the *math* and *theory* in `docs/logic/`.
    *   **Design:** Architectural decisions (like Schema Design) go in `docs/design/`.
*   **Code Comments:** Focus on *why*, not *what*. Complex math should reference the `docs/` files.

### Testing Policy
*   **Logic Core:** All indicators and strategy logic must have unit tests (`src/logic/__tests__`).
*   **Zero Regression:** Ensure `npm test` passes before committing logic changes.