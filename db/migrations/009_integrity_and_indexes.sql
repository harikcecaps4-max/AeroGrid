-- 009_integrity_and_indexes.sql
-- AeroGrid spatial geography indexes, FK lookup indexes, and enum/uniqueness integrity constraints.
-- Fully idempotent (IF NOT EXISTS / pg_constraint checks).

-- 1. Spatial GiST indexes on airstrips.location::geography and airports.location
CREATE INDEX IF NOT EXISTS idx_airstrips_location_geog
  ON airstrips USING GIST ((location::geography));

CREATE INDEX IF NOT EXISTS idx_airports_location
  ON airports USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_airports_location_geog
  ON airports USING GIST ((location::geography));

-- 2. Foreign-key B-tree indexes on assets(airstrip_id) and airstrip_access_points(airstrip_id)
CREATE INDEX IF NOT EXISTS idx_assets_airstrip_id
  ON assets (airstrip_id);

CREATE INDEX IF NOT EXISTS idx_airstrip_access_points_airstrip_id
  ON airstrip_access_points (airstrip_id);

-- 3. Case-insensitive unique email index on users(LOWER(email))
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
  ON users (LOWER(email));

-- 4. Named CHECK constraints on assets.status, assets.condition_grade, and users.role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assets_status_valid') THEN
    ALTER TABLE assets
      ADD CONSTRAINT chk_assets_status_valid
      CHECK (status IN ('operational', 'maintenance_required', 'under_repair', 'decommissioned', 'planned'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assets_condition_grade_valid') THEN
    ALTER TABLE assets
      ADD CONSTRAINT chk_assets_condition_grade_valid
      CHECK (condition_grade IN ('excellent', 'good', 'fair', 'poor', 'critical'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role_valid') THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role_valid
      CHECK (role IN ('admin', 'analyst', 'viewer'));
  END IF;
END $$;
