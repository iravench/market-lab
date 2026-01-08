# Execution Modes: Backtesting vs. Dry Run vs. Live

To ensure strategy safety, the system supports three distinct modes of operation.

## 1. Backtesting (Historical)
*   **Purpose:** Rapid discovery and validation of strategy logic.
*   **Data:** Historical database records (Phase 1).
*   **Portfolio:** In-Memory (`Portfolio` class).
*   **Persistence:** None. Results are reported and discarded.
*   **Time:** Replays months/years of data in seconds.

## 2. Dry Run (Forward Testing / Shadow Trading)
*   **Purpose:** Verify system stability and strategy behavior on *live* incoming data without financial risk.
*   **Data:** Latest candles fetched in real-time.
*   **Portfolio:** Persistent Ledger (Starting state loaded from DB).
*   **Persistence:** **Read-Only**. Decisions are logged to the console/files, but the database state is never updated.
*   **Time:** Runs in "Real-Time" (e.g., once an hour or once a day).

## 3. Live Paper Trading (Forward Testing)
*   **Purpose:** Establish a "track record" for a strategy using simulated funds.
*   **Data:** Latest candles fetched in real-time.
*   **Portfolio:** Persistent Ledger (DB-backed).
*   **Persistence:** **Full Read/Write**. Trades result in permanent changes to the database-stored portfolio.
*   **Time:** Runs in "Real-Time".

---

## Comparison Summary

| Feature | Backtesting | Dry Run | Live Paper |
| :--- | :--- | :--- | :--- |
| **State Storage** | RAM | DB (Read-only) | DB (Read/Write) |
| **Updates Ledger** | No | No | **Yes** |
| **Prevents Loss** | Yes | Yes | Yes (Simulated Funds) |
| **Data Context** | Past | "Now" | "Now" |

## Why use Dry Run?
Dry Run is the "Final Inspection" before allowing a bot to manage any state. It ensures that the database connection, API keys, and scheduling logic are all working correctly without accidentally corrupting your Paper Trading portfolio state if there is a bug in the execution logic.
