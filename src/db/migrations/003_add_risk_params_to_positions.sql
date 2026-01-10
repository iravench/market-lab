-- Up
ALTER TABLE positions ADD COLUMN IF NOT EXISTS stop_loss NUMERIC;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS take_profit NUMERIC;

-- Ledger should also record the reason for trade (e.g. STOP_LOSS)
-- Already has 'reason' column from migration 002.

-- Down
ALTER TABLE positions DROP COLUMN IF NOT EXISTS stop_loss;
ALTER TABLE positions DROP COLUMN IF NOT EXISTS take_profit;
