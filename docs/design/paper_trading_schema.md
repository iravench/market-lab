# Persistent Ledger Schema Design

To support Phase 4, we need to track the state of one or more portfolios.

## 1. Tables

### `portfolios`
Stores the metadata and cash balance for a specific trading entity.
*   `id`: UUID (Primary Key)
*   `name`: Text (e.g., "RSI Daily Strategy")
*   `initial_cash`: Decimal
*   `current_cash`: Decimal
*   `created_at`: Timestamptz

### `positions`
Stores currently held assets.
*   `portfolio_id`: UUID (Foreign Key)
*   `symbol`: Text
*   `quantity`: Decimal
*   `average_price`: Decimal (Cost basis including fees)
*   `updated_at`: Timestamptz
*   *Constraint:* Unique on `(portfolio_id, symbol)`

### `ledger_entries` (Completed Trades)
A historical record of all actions taken by the portfolio.
*   `id`: UUID
*   `portfolio_id`: UUID
*   `timestamp`: Timestamptz
*   `action`: Text (BUY/SELL)
*   `symbol`: Text
*   `quantity`: Decimal
*   `price`: Decimal
*   `fee`: Decimal
*   `realized_pnl`: Decimal (Null for BUY)
*   `reason`: Text (Strategy rationale)

## 2. Integrity Rules
1.  **Atomic Transactions:** Every trade must update `positions`, `portfolios.current_cash`, and `ledger_entries` within a single SQL transaction.
2.  **Idempotency:** An `executions` tracking table or similar mechanism should prevent the same strategy from acting on the same candle timestamp twice.
