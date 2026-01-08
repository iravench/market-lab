# Paper Trading Architecture

Paper Trading (Phase 4) is the bridge between historical backtesting and live execution. It involves running strategies against live market data intervals using a persistent, database-backed portfolio.

## 1. Core Components

### A. Persistent Ledger
Unlike the backtester's in-memory portfolio, the Paper Trading engine requires a durable state.
*   **Portfolio Table:** Stores current cash balance and metadata.
*   **Positions Table:** Stores active holdings (symbol, quantity, average cost).
*   **Audit Log:** Records every execution and state change for performance tracking.

### B. The Live Runner (Bot)
A scheduled process (e.g., Cron) that orchestrates the "Tick" of the system:
1.  **Sync:** Fetch the latest market candle for watched symbols.
2.  **Restore:** Load the current portfolio state from the database.
3.  **Analyze:** Feed the full history (Database + latest candle) into the Strategy.
4.  **Execute:** If a signal is generated, update the database ledger and record the trade.

### C. Idempotency Guard
A critical safety layer to ensure that if a script is triggered twice for the same candle (e.g., a retry), it does not execute duplicate trades.
*   *Mechanism:* Each execution is keyed by `(Strategy, Symbol, Candle Timestamp)`.

---

## 2. Process Flow

```mermaid
graph TD
    A[Cron Schedule] --> B[Fetch Latest Candle]
    B --> C[Load Portfolio from DB]
    C --> D[Run Strategy Analysis]
    D --> E{Signal?}
    E -- Yes --> F[Atomic DB Transaction]
    F --> G[Update Cash & Positions]
    F --> H[Log Trade]
    E -- No --> I[Log Neutral State]
    I --> J[End Process]
## 3. CLI Usage

### Create a Portfolio
Initialize a new persistent portfolio in the database.
```bash
npm run create-portfolio "My RSI Bot" 10000
```

### Run the Trading Bot
Execute the strategy for a specific symbol using a persistent portfolio.

**Dry Run (Safe):**
```bash
npm run trade <PORTFOLIO_ID> <SYMBOL> DRY
```

**Live Paper Trading (Database updates enabled):**
```bash
npm run trade <PORTFOLIO_ID> <SYMBOL> LIVE
```
