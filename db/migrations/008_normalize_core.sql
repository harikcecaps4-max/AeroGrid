-- 008_normalize_core.sql
-- AeroGrid: normalisation, EXPAND phase (3NF / BCNF).
--
-- Adds the correctly normalised structures and back-fills them from the legacy columns.
-- Legacy columns are NOT dropped here, so the running backend keeps working.
-- The redundant columns are removed later by 012 (CONTRACT phase), after the code has been checked.
--
-- What is fixed and why:
--   * runway data lived on airstrips; surface depends on the runway, not the airstrip  -> runways
--   * fleets repeated aircraft attributes (category, min runway, range, payload)        -> transitive dependency
--       fleet -> aircraft_profile_id -> {category, min_runway_m, ...}                    -> use aircraft_profiles
--   * operator_name was free text repeated on every fleet                               -> organizations
--   * aircraft factors from the concept (speed, energy, paved need) had no home         -> aircraft_profiles
--   * asset condition had no history                                                    -> asset_condition_log

-- ---------------------------------------------------------------------------
-- 1. runways (one airstrip has one or more runways)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runways (
  id          SERIAL PRIMARY KEY,
  airstrip_id INT  NOT NULL REFERENCES airstrips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  designator  TEXT NOT NULL CHECK (designator ~ '^[A-Z0-9/]{1,10}$'),
  length_m    NUMERIC NOT NULL CHECK (length_m > 0 AND length_m <= 6000),
  width_m     NUMERIC CHECK (width_m IS NULL OR (width_m > 0 AND width_m <= 200)),
  surface_id  INT  NOT NULL REFERENCES surface_types(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  checksum    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_runways_airstrip_designator UNIQUE (airstrip_id, designator)
);

-- at most one primary runway per airstrip
CREATE UNIQUE INDEX IF NOT EXISTS uq_runways_one_primary ON runways (airstrip_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_runways_surface_id ON runways (surface_id);

INSERT INTO runways (airstrip_id, designator, length_m, width_m, surface_id, is_primary)
SELECT a.id, 'PRIMARY', a.runway_length_m, a.runway_width_m, a.surface_id, TRUE
FROM airstrips a
WHERE a.runway_length_m IS NOT NULL
  AND a.surface_id IS NOT NULL
ON CONFLICT (airstrip_id, designator) DO NOTHING;

-- While both representations exist, writes to the legacy columns keep the primary runway in step.
-- This trigger is removed in 012.
CREATE OR REPLACE FUNCTION fn_sync_primary_runway() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.runway_length_m IS NOT NULL AND NEW.surface_id IS NOT NULL THEN
    INSERT INTO runways (airstrip_id, designator, length_m, width_m, surface_id, is_primary)
    VALUES (NEW.id, 'PRIMARY', NEW.runway_length_m, NEW.runway_width_m, NEW.surface_id, TRUE)
    ON CONFLICT (airstrip_id, designator) DO UPDATE
      SET length_m = EXCLUDED.length_m,
          width_m = EXCLUDED.width_m,
          surface_id = EXCLUDED.surface_id,
          updated_at = now();
  END IF;
  RETURN NEW;
END
$f$;

DROP TRIGGER IF EXISTS trg_airstrips_sync_runway ON airstrips;
CREATE TRIGGER trg_airstrips_sync_runway
  AFTER INSERT OR UPDATE OF runway_length_m, runway_width_m, surface_id ON airstrips
  FOR EACH ROW EXECUTE FUNCTION fn_sync_primary_runway();

CREATE OR REPLACE VIEW v_airstrip_primary_runway AS
SELECT r.airstrip_id, r.id AS runway_id, r.designator, r.length_m, r.width_m, r.surface_id
FROM runways r
WHERE r.is_primary;

-- ---------------------------------------------------------------------------
-- 2. organizations (every company we deal with: fleet operators, investors, government bodies, suppliers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  org_type     TEXT NOT NULL DEFAULT 'operator' CHECK (org_type IN
                 ('operator', 'airline', 'cargo_operator', 'investor', 'government', 'supplier', 'other')),
  country_code TEXT CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  website      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_organizations_name UNIQUE (name)
);

INSERT INTO organizations (name, org_type)
SELECT DISTINCT btrim(operator_name), 'operator' FROM fleets WHERE operator_name IS NOT NULL
ON CONFLICT (name) DO NOTHING;

ALTER TABLE fleets ADD COLUMN IF NOT EXISTS operator_id INT;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fleets_operator') THEN
    ALTER TABLE fleets ADD CONSTRAINT fk_fleets_operator
      FOREIGN KEY (operator_id) REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$mig$;

UPDATE fleets f
SET operator_id = o.id
FROM organizations o
WHERE f.operator_id IS NULL AND o.name = btrim(f.operator_name);

-- link fleets to their aircraft profile where the seed only stored the model name
UPDATE fleets f
SET aircraft_profile_id = p.id
FROM aircraft_profiles p
WHERE f.aircraft_profile_id IS NULL AND lower(p.name) = lower(f.aircraft_model);

CREATE INDEX IF NOT EXISTS idx_fleets_operator_id ON fleets (operator_id);
CREATE INDEX IF NOT EXISTS idx_fleets_aircraft_profile_id ON fleets (aircraft_profile_id);
CREATE INDEX IF NOT EXISTS idx_fleets_target_airport_id ON fleets (target_airport_id);

-- ---------------------------------------------------------------------------
-- 3. aircraft_profiles: factors from the concept (speed, energy, surface need) + spec honesty
-- ---------------------------------------------------------------------------
ALTER TABLE aircraft_profiles
  ADD COLUMN IF NOT EXISTS cruise_speed_kmh NUMERIC,
  ADD COLUMN IF NOT EXISTS needs_paved      BOOLEAN,            -- NULL means unknown
  ADD COLUMN IF NOT EXISTS energy_type      TEXT,
  ADD COLUMN IF NOT EXISTS spec_status      TEXT NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS spec_source      TEXT,
  ADD COLUMN IF NOT EXISTS checksum         TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();

DO $mig$
DECLARE
  c TEXT;
  has_null BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_numbers_positive') THEN
    ALTER TABLE aircraft_profiles ADD CONSTRAINT chk_aircraft_numbers_positive CHECK (
      (min_runway_m IS NULL OR min_runway_m > 0) AND
      (range_km     IS NULL OR range_km     > 0) AND
      (payload_kg   IS NULL OR payload_kg   > 0) AND
      (passengers   IS NULL OR passengers  >= 0) AND
      (cruise_speed_kmh IS NULL OR cruise_speed_kmh > 0));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_energy_type') THEN
    ALTER TABLE aircraft_profiles ADD CONSTRAINT chk_aircraft_energy_type
      CHECK (energy_type IS NULL OR energy_type IN ('electric', 'hybrid_electric', 'jet_a1', 'avgas'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_spec_status') THEN
    ALTER TABLE aircraft_profiles ADD CONSTRAINT chk_aircraft_spec_status
      CHECK (spec_status IN ('placeholder', 'desk_verified', 'manufacturer_verified'));
  END IF;

  -- a profile can only be called manufacturer_verified if it says where the numbers came from
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_verified_needs_source') THEN
    ALTER TABLE aircraft_profiles ADD CONSTRAINT chk_aircraft_verified_needs_source
      CHECK (spec_status <> 'manufacturer_verified' OR (spec_source IS NOT NULL AND length(btrim(spec_source)) > 0));
  END IF;

  -- NOT NULL on the fields the decision engine needs, only where every row already has a value
  FOREACH c IN ARRAY ARRAY['category', 'min_runway_m', 'range_km', 'payload_kg', 'passengers'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM aircraft_profiles WHERE %I IS NULL)', c) INTO has_null;
    IF NOT has_null THEN
      EXECUTE format('ALTER TABLE aircraft_profiles ALTER COLUMN %I SET NOT NULL', c);
    END IF;
  END LOOP;
END
$mig$;

-- cruise speed is meaningful in the fleet seed, so carry it over.
-- needs_paved is NOT copied: fleets.requires_paved defaulted to TRUE, so it cannot be trusted.
UPDATE aircraft_profiles p
SET cruise_speed_kmh = s.v
FROM (
  SELECT aircraft_profile_id, MAX(cruise_speed_kmh) AS v
  FROM fleets
  WHERE aircraft_profile_id IS NOT NULL AND cruise_speed_kmh IS NOT NULL
  GROUP BY aircraft_profile_id
) s
WHERE p.id = s.aircraft_profile_id AND p.cruise_speed_kmh IS NULL;

UPDATE aircraft_profiles SET energy_type = 'electric'
WHERE energy_type IS NULL AND needs_charging IS TRUE;

-- compatibility view: same shape the old fleets table had, now built from the normalised tables
CREATE OR REPLACE VIEW v_fleets AS
SELECT f.id, f.name, f.operator_id, o.name AS operator_name,
       f.aircraft_profile_id, p.name AS aircraft_model, p.category,
       p.min_runway_m, p.range_km, p.payload_kg, p.passengers,
       p.cruise_speed_kmh, p.needs_paved, p.energy_type,
       f.tail_count, f.home_airstrip_id, f.target_airport_id, f.base_location,
       f.status, f.created_at, f.updated_at
FROM fleets f
LEFT JOIN organizations o ON o.id = f.operator_id
LEFT JOIN aircraft_profiles p ON p.id = f.aircraft_profile_id;

-- ---------------------------------------------------------------------------
-- 4. asset management: inspection dates + condition history
-- ---------------------------------------------------------------------------
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS installed_on         DATE,
  ADD COLUMN IF NOT EXISTS last_inspected_on    DATE,
  ADD COLUMN IF NOT EXISTS next_inspection_due  DATE;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assets_inspection_order') THEN
    ALTER TABLE assets ADD CONSTRAINT chk_assets_inspection_order CHECK (
      (installed_on IS NULL OR last_inspected_on IS NULL OR last_inspected_on >= installed_on) AND
      (last_inspected_on IS NULL OR next_inspection_due IS NULL OR next_inspection_due >= last_inspected_on));
  END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS asset_condition_log (
  id              BIGSERIAL PRIMARY KEY,
  asset_id        INT  NOT NULL REFERENCES assets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('operational', 'maintenance_required', 'under_repair', 'decommissioned', 'planned')),
  condition_grade TEXT NOT NULL CHECK (condition_grade IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  noted_by        INT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  noted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT
);
CREATE INDEX IF NOT EXISTS idx_asset_condition_log_asset ON asset_condition_log (asset_id, noted_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_condition_log_noted_by ON asset_condition_log (noted_by);

CREATE OR REPLACE FUNCTION fn_assets_log_condition() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.condition_grade IS DISTINCT FROM OLD.condition_grade THEN
    INSERT INTO asset_condition_log (asset_id, status, condition_grade)
    VALUES (NEW.id, NEW.status, NEW.condition_grade);
  END IF;
  RETURN NEW;
END
$f$;

DROP TRIGGER IF EXISTS trg_assets_log_condition ON assets;
CREATE TRIGGER trg_assets_log_condition
  AFTER INSERT OR UPDATE OF status, condition_grade ON assets
  FOR EACH ROW EXECUTE FUNCTION fn_assets_log_condition();

-- starting point of the history for assets that already exist
INSERT INTO asset_condition_log (asset_id, status, condition_grade)
SELECT s.id, s.status, s.condition_grade
FROM assets s
WHERE NOT EXISTS (SELECT 1 FROM asset_condition_log l WHERE l.asset_id = s.id);

-- ---------------------------------------------------------------------------
-- 5. declared capability vs what the asset register says (a check, not a second source of truth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_airstrip_capabilities AS
SELECT a.id AS airstrip_id,
       a.fuel_available     AS fuel_declared,
       COALESCE(bool_or(s.asset_type = 'fuel_point'        AND s.status = 'operational'), FALSE) AS fuel_from_assets,
       a.charging_available AS charging_declared,
       COALESCE(bool_or(s.asset_type = 'charging_station'  AND s.status = 'operational'), FALSE) AS charging_from_assets,
       a.night_landing      AS night_declared,
       COALESCE(bool_or(s.asset_type = 'lighting'          AND s.status = 'operational'), FALSE) AS lighting_from_assets
FROM airstrips a
LEFT JOIN assets s ON s.airstrip_id = a.id
GROUP BY a.id;

-- ---------------------------------------------------------------------------
-- 6. documentation inside the database
-- ---------------------------------------------------------------------------
COMMENT ON TABLE runways IS 'One row per runway. Surface and dimensions belong here, not on airstrips (3NF).';
COMMENT ON TABLE organizations IS 'Every company we deal with. fleets.operator_id points here and replaces the repeated operator_name text.';
COMMENT ON TABLE access_points IS 'DEPRECATED legacy table from 001. Replaced by airstrip_access_points; dropped in 012.';
COMMENT ON COLUMN airstrips.runway_length_m IS 'DEPRECATED: use runways. Dropped in 012.';
COMMENT ON COLUMN airstrips.runway_width_m IS 'DEPRECATED: use runways. Dropped in 012.';
COMMENT ON COLUMN airstrips.surface_id IS 'DEPRECATED: use runways.surface_id. Dropped in 012.';
COMMENT ON COLUMN aircraft_profiles.needs_paved IS 'NULL means unknown. Fill from manufacturer data.';
COMMENT ON COLUMN aircraft_profiles.spec_status IS 'placeholder until checked against a real source.';
