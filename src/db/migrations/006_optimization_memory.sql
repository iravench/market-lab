-- Up
-- 1. Create optimizations table
CREATE TABLE IF NOT EXISTS optimizations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_name   TEXT            NOT NULL,
    config          JSONB           NOT NULL, -- Full OptimizationConfig
    risk_config     JSONB           NOT NULL, -- RiskConfig used
    git_commit      TEXT,
    status          TEXT            DEFAULT 'RUNNING', -- RUNNING, COMPLETED, FAILED
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 2. Modify backtest_runs
ALTER TABLE backtest_runs ADD COLUMN optimization_id UUID REFERENCES optimizations(id);
CREATE INDEX idx_runs_optimization_id ON backtest_runs(optimization_id);

-- Drop redundant column (we will do this safely in a separate step or just ignore it for now to avoid data loss on existing rows if any, but since it's dev, we drop)
ALTER TABLE backtest_runs DROP COLUMN IF EXISTS git_commit;

-- 3. Create asset_profiles (Memory Ledger)
CREATE TABLE IF NOT EXISTS asset_profiles (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          TEXT            NOT NULL,
    year            INTEGER         NOT NULL,
    metric_used     TEXT            NOT NULL,
    regime          TEXT            NOT NULL,
    winning_strategy TEXT           NOT NULL,
    winning_score   NUMERIC         NOT NULL,
    optimization_id UUID REFERENCES optimizations(id), -- Link to the proof
    details         JSONB           NOT NULL, -- Scores of other strategies
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of latest profile
CREATE INDEX idx_asset_profiles_lookup ON asset_profiles (symbol, year, metric_used, created_at DESC);

-- Down
DROP TABLE IF EXISTS asset_profiles;
ALTER TABLE backtest_runs ADD COLUMN git_commit TEXT;
ALTER TABLE backtest_runs DROP COLUMN optimization_id;
DROP TABLE IF EXISTS optimizations;
