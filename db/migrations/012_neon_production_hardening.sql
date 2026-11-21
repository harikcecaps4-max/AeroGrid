-- 008_neon_production_hardening.sql
-- Production hardening for Neon PostgreSQL + PostGIS:
--   1. Automatic updated_at trigger function across mutable tables
--   2. Functional geography GiST indexes for ST_DWithin / ST_Distance index scans
--   3. Operational B-tree & case-insensitive lookup indexes for API filters
--   4. User account lifecycle & audit columns
--   5. Table comments for Neon Console & catalog introspection

-- 1. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. User account lifecycle columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_active_role ON users (role) WHERE is_active = TRUE;

-- 3. Attach updated_at triggers idempotently to mutable tables
DO $$
DECLARE
  tbl TEXT;
  trg TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['airstrips', 'fleets', 'assets', 'users']
  LOOP
    trg := 'trg_' || tbl || '_updated_at';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE t.tgname = trg
        AND c.relname = tbl
        AND NOT t.tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        trg,
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4. Functional geography GiST indexes so ST_DWithin(location::geography, ...) and ST_Distance
--    use spatial index scans instead of sequential scans on Neon compute.
CREATE INDEX IF NOT EXISTS idx_airstrips_location_geog
  ON airstrips USING GIST ((location::geography));

CREATE INDEX IF NOT EXISTS idx_airports_location_geog
  ON airports USING GIST ((location::geography));

CREATE INDEX IF NOT EXISTS idx_airstrip_access_points_location_geog
  ON airstrip_access_points USING GIST ((location::geography));

-- 5. Operational B-tree indexes for common API filters, joins, and text lookups
CREATE INDEX IF NOT EXISTS idx_airstrips_surface_ownership
  ON airstrips (surface_id, ownership_id);

CREATE INDEX IF NOT EXISTS idx_airstrips_political_severity
  ON airstrips (political_severity);

CREATE INDEX IF NOT EXISTS idx_airstrips_runway_length
  ON airstrips (runway_length_m);

CREATE INDEX IF NOT EXISTS idx_airstrips_name_lower
  ON airstrips (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_airports_name_lower
  ON airports (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log (action, created_at DESC);

-- 6. Catalog documentation comments
COMMENT ON TABLE airstrips IS 'Regional micro-airstrips in India with PostGIS SRID 4326 point geometry and runway/risk metadata.';
COMMENT ON TABLE airports IS 'Reference commercial airports used for regional connectivity and distance calculations.';
COMMENT ON TABLE airstrip_access_points IS '3NF last-mile multimodal access nodes linked to airstrips.';
COMMENT ON TABLE airstrip_airport_distances IS 'Precomputed great-circle distances and flight times between airstrips and airports.';
COMMENT ON TABLE fleets IS 'Operator fleet deployments and aircraft capability profiles.';
COMMENT ON TABLE assets IS 'On-ground infrastructure assets (hangars, chargers, fuel, lighting) linked to airstrips.';
COMMENT ON TABLE audit_log IS 'Append-only governance and operational audit trail.';
