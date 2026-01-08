-- Up

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT            NOT NULL,
    initial_cash    NUMERIC         NOT NULL,
    current_cash    NUMERIC         NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    portfolio_id    UUID            NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol          TEXT            NOT NULL,
    quantity        NUMERIC         NOT NULL,
    average_price   NUMERIC         NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (portfolio_id, symbol)
);

-- Ledger Entries (Trade History)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    portfolio_id    UUID            NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ     NOT NULL,
    action          TEXT            NOT NULL, -- BUY, SELL
    symbol          TEXT            NOT NULL,
    quantity        NUMERIC         NOT NULL,
    price           NUMERIC         NOT NULL,
    fee             NUMERIC         NOT NULL,
    realized_pnl    NUMERIC,                  -- NULL for BUYs
    reason          TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (timestamp, id)
);

-- Idempotency tracking to prevent duplicate executions for the same candle
CREATE TABLE IF NOT EXISTS strategy_executions (
    portfolio_id    UUID            NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol          TEXT            NOT NULL,
    strategy_name   TEXT            NOT NULL,
    candle_time     TIMESTAMPTZ     NOT NULL,
    executed_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (portfolio_id, symbol, strategy_name, candle_time)
);

-- Create hypertable for ledger entries
SELECT create_hypertable('ledger_entries', 'timestamp', if_not_exists => TRUE);

-- Down
DROP TABLE IF EXISTS strategy_executions;
DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS portfolios;