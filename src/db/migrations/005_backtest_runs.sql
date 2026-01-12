-- Up
CREATE TABLE IF NOT EXISTS backtest_runs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_name   TEXT            NOT NULL,
    parameters      JSONB           NOT NULL,
    metrics         JSONB           NOT NULL,
    time_range_start TIMESTAMPTZ    NOT NULL,
    time_range_end  TIMESTAMPTZ     NOT NULL,
    git_commit      TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for searching runs by strategy
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy ON backtest_runs (strategy_name);

-- GIN index for JSONB queries to allow efficient filtering on parameters
CREATE INDEX IF NOT EXISTS idx_backtest_runs_params ON backtest_runs USING GIN (parameters);

-- GIN index for JSONB queries to allow efficient filtering/sorting on metrics (e.g., "sharpeRatio > 2")
CREATE INDEX IF NOT EXISTS idx_backtest_runs_metrics ON backtest_runs USING GIN (metrics);

-- Down
DROP TABLE IF EXISTS backtest_runs;
