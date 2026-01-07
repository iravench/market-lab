-- Up
CREATE TABLE IF NOT EXISTS candles (
    time        TIMESTAMPTZ       NOT NULL,
    symbol      TEXT              NOT NULL,
    interval    TEXT              NOT NULL,
    open        NUMERIC           NOT NULL,
    high        NUMERIC           NOT NULL,
    low         NUMERIC           NOT NULL,
    close       NUMERIC           NOT NULL,
    volume      NUMERIC           NOT NULL
);

-- Convert to hypertable (TimescaleDB specific)
SELECT create_hypertable('candles', 'time', if_not_exists => TRUE);

-- Create unique index to prevent duplicate data for the same candle
CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_symbol_interval_time 
ON candles (symbol, interval, time DESC);

-- Down
DROP TABLE IF EXISTS candles;
