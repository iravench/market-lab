-- Up
ALTER TABLE asset_profiles ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_asset_profiles_meta ON asset_profiles USING GIN (meta);

-- Down
DROP INDEX IF EXISTS idx_asset_profiles_meta;
ALTER TABLE asset_profiles DROP COLUMN IF EXISTS meta;
