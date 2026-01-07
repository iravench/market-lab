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
