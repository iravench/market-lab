-- Up
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS high_water_mark NUMERIC DEFAULT 0;

-- Down
ALTER TABLE portfolios DROP COLUMN IF NOT EXISTS high_water_mark;
