-- 006_schema_enhancements.sql
-- AeroGrid PostGIS 3NF schema enhancements, GiST indexes, and DB-level integrity rules.
-- Non-duplicating companion to 001_init.sql..005_add_political_risk.sql; fully idempotent.

-- 1. Ensure PostGIS extension is active
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Complete 3NF lookup catalogs & domain CHECK constraints
INSERT INTO surface_types (name)
VALUES ('asphalt'), ('concrete'), ('gravel'), ('grass'), ('laterite'), ('unpaved')
ON CONFLICT (name) DO NOTHING;

INSERT INTO ownership_types (name)
VALUES ('private'), ('municipal'), ('state'), ('central'), ('defence'), ('psu')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_surface_type_valid') THEN
    ALTER TABLE surface_types
      ADD CONSTRAINT chk_surface_type_valid
      CHECK (LOWER(name) IN ('asphalt', 'concrete', 'gravel', 'grass', 'laterite', 'unpaved'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ownership_type_valid') THEN
    ALTER TABLE ownership_types
      ADD CONSTRAINT chk_ownership_type_valid
      CHECK (LOWER(name) IN ('private', 'municipal', 'state', 'central', 'defence', 'psu'));
  END IF;
END $$;

-- 3. Strengthen airstrips table: tamper-detection checksum, NOT NULL, UNIQUE, CHECK, and ON DELETE RESTRICT FKs
ALTER TABLE airstrips
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Deduplicate any repeated (name, state_id) airstrips before applying UNIQUE constraint
DELETE FROM airstrips a
USING airstrips b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.state_id IS NOT DISTINCT FROM b.state_id;

DO $$
DECLARE
  fk_rec RECORD;
BEGIN
  -- Enforce NOT NULL on core relational attributes when all existing rows are populated
  IF NOT EXISTS (SELECT 1 FROM airstrips WHERE state_id IS NULL) THEN
    ALTER TABLE airstrips ALTER COLUMN state_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM airstrips WHERE ownership_id IS NULL) THEN
    ALTER TABLE airstrips ALTER COLUMN ownership_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM airstrips WHERE surface_id IS NULL) THEN
    ALTER TABLE airstrips ALTER COLUMN surface_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM airstrips WHERE runway_length_m IS NULL) THEN
    ALTER TABLE airstrips ALTER COLUMN runway_length_m SET NOT NULL;
  END IF;

  -- Unique airstrip name within a state
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_airstrips_name_state') THEN
    ALTER TABLE airstrips ADD CONSTRAINT uq_airstrips_name_state UNIQUE (name, state_id);
  END IF;

  -- Physical runway & spatial coordinate bounds
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runway_length_positive') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_runway_length_positive
      CHECK (runway_length_m > 0 AND runway_length_m <= 6000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_runway_width_positive') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_runway_width_positive
      CHECK (runway_width_m IS NULL OR (runway_width_m > 0 AND runway_width_m <= 200));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_elevation_valid') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_elevation_valid
      CHECK (elevation_m IS NULL OR (elevation_m >= -500 AND elevation_m <= 9000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_lat_lng') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_airstrip_lat_lng
      CHECK (ST_SRID(location) = 4326 AND ST_Y(location) BETWEEN -90 AND 90 AND ST_X(location) BETWEEN -180 AND 180);
  END IF;

  -- Upgrade lookup foreign keys on airstrips to explicit ON DELETE RESTRICT ON UPDATE CASCADE
  FOR fk_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'airstrips'::regclass
      AND contype = 'f'
      AND conname NOT IN ('fk_airstrips_state', 'fk_airstrips_ownership', 'fk_airstrips_surface')
  LOOP
    EXECUTE format('ALTER TABLE airstrips DROP CONSTRAINT %I', fk_rec.conname);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_airstrips_state') THEN
    ALTER TABLE airstrips ADD CONSTRAINT fk_airstrips_state
      FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_airstrips_ownership') THEN
    ALTER TABLE airstrips ADD CONSTRAINT fk_airstrips_ownership
      FOREIGN KEY (ownership_id) REFERENCES ownership_types(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_airstrips_surface') THEN
    ALTER TABLE airstrips ADD CONSTRAINT fk_airstrips_surface
      FOREIGN KEY (surface_id) REFERENCES surface_types(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_airstrips_location ON airstrips USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_airstrips_state_id ON airstrips (state_id);

-- 4. Strengthen airports table (3NF state_id FK, code checks, lat/lng checks, GiST index)
ALTER TABLE airports
  ADD COLUMN IF NOT EXISTS state_id INT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM airports WHERE code IS NULL) THEN
    ALTER TABLE airports ALTER COLUMN code SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_airports_state') THEN
    ALTER TABLE airports ADD CONSTRAINT fk_airports_state
      FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airport_code_format') THEN
    ALTER TABLE airports ADD CONSTRAINT chk_airport_code_format
      CHECK (code = UPPER(code) AND LENGTH(code) BETWEEN 3 AND 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airport_lat_lng') THEN
    ALTER TABLE airports ADD CONSTRAINT chk_airport_lat_lng
      CHECK (ST_SRID(location) = 4326 AND ST_Y(location) BETWEEN -90 AND 90 AND ST_X(location) BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_airports_location ON airports USING GIST (location);

-- 5. Deduplicate & add UNIQUE constraint on aircraft_profiles(name)
DELETE FROM aircraft_profiles a
USING aircraft_profiles b
WHERE a.id > b.id
  AND a.name = b.name;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_aircraft_profiles_name') THEN
    ALTER TABLE aircraft_profiles ADD CONSTRAINT uq_aircraft_profiles_name UNIQUE (name);
  END IF;
END $$;

-- 6. airstrip_access_points (3NF last-mile multimodal access table with SRID 4326 Point & GiST index)
CREATE TABLE IF NOT EXISTS airstrip_access_points (
  id              SERIAL PRIMARY KEY,
  airstrip_id     INT NOT NULL REFERENCES airstrips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  access_type     TEXT NOT NULL CHECK (access_type IN ('highway', 'rail', 'city_centre', 'hospital', 'bus_terminal', 'industrial_hub', 'port')),
  name            TEXT NOT NULL,
  distance_km     NUMERIC(6,2) NOT NULL CHECK (distance_km >= 0 AND distance_km <= 500),
  drive_time_mins INT CHECK (drive_time_mins IS NULL OR (drive_time_mins >= 0 AND drive_time_mins <= 600)),
  road_condition  TEXT NOT NULL DEFAULT 'paved' CHECK (road_condition IN ('paved', 'semi-paved', 'unpaved', 'expressway')),
  location        geometry(Point, 4326) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_airstrip_access_point UNIQUE (airstrip_id, access_type, name),
  CONSTRAINT chk_access_point_lat_lng CHECK (
    ST_SRID(location) = 4326
    AND ST_Y(location) BETWEEN -90 AND 90
    AND ST_X(location) BETWEEN -180 AND 180
  )
);

CREATE INDEX IF NOT EXISTS idx_airstrip_access_points_location ON airstrip_access_points USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_airstrip_access_points_airstrip_id ON airstrip_access_points (airstrip_id);

-- Migrate any legacy rows from 001's access_points table without losing data
INSERT INTO airstrip_access_points (airstrip_id, access_type, name, distance_km, location)
SELECT
  ap.airstrip_id,
  COALESCE(ap.kind, 'highway'),
  COALESCE(ap.name, 'Regional Access Point'),
  ROUND((ST_Distance(ap.location::geography, a.location::geography) / 1000.0)::numeric, 2),
  ap.location
FROM access_points ap
JOIN airstrips a ON a.id = ap.airstrip_id
WHERE ap.airstrip_id IS NOT NULL
  AND ap.location IS NOT NULL
ON CONFLICT (airstrip_id, access_type, name) DO NOTHING;

-- 7. airstrip_airport_distances (3NF precomputed spatial distances & nearest-hub flags)
CREATE TABLE IF NOT EXISTS airstrip_airport_distances (
  id                     SERIAL PRIMARY KEY,
  airstrip_id            INT NOT NULL REFERENCES airstrips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  airport_id             INT NOT NULL REFERENCES airports(id) ON DELETE CASCADE ON UPDATE CASCADE,
  distance_km            NUMERIC(8,2) NOT NULL CHECK (distance_km > 0),
  bearing_deg            NUMERIC(5,2) CHECK (bearing_deg IS NULL OR (bearing_deg >= 0 AND bearing_deg < 360)),
  flight_time_evtol_mins INT CHECK (flight_time_evtol_mins IS NULL OR flight_time_evtol_mins > 0),
  is_nearest             BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_airstrip_airport_pair UNIQUE (airstrip_id, airport_id)
);

ALTER TABLE airstrip_airport_distances
  ADD COLUMN IF NOT EXISTS bearing_deg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS flight_time_evtol_mins INT;

CREATE INDEX IF NOT EXISTS idx_aad_airstrip_id ON airstrip_airport_distances (airstrip_id, distance_km);
CREATE INDEX IF NOT EXISTS idx_aad_airport_id ON airstrip_airport_distances (airport_id);
CREATE INDEX IF NOT EXISTS idx_aad_nearest ON airstrip_airport_distances (airstrip_id) WHERE is_nearest = TRUE;

-- 8. fleets (3NF operator fleet & deployment table with SRID 4326 base geometry & GiST index)
CREATE TABLE IF NOT EXISTS fleets (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  operator_name       TEXT NOT NULL,
  aircraft_profile_id INT REFERENCES aircraft_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  category            TEXT NOT NULL CHECK (category IN ('eVTOL', 'STOL', 'turboprop', 'hybrid')),
  aircraft_model      TEXT NOT NULL,
  tail_count          INT NOT NULL DEFAULT 1 CHECK (tail_count > 0),
  min_runway_m        NUMERIC NOT NULL CHECK (min_runway_m > 0),
  requires_paved      BOOLEAN NOT NULL DEFAULT TRUE,
  range_km            NUMERIC NOT NULL CHECK (range_km > 0),
  cruise_speed_kmh    NUMERIC CHECK (cruise_speed_kmh IS NULL OR cruise_speed_kmh > 0),
  payload_kg          NUMERIC CHECK (payload_kg IS NULL OR payload_kg > 0),
  home_airstrip_id    INT REFERENCES airstrips(id) ON DELETE SET NULL ON UPDATE CASCADE,
  target_airport_id   INT REFERENCES airports(id) ON DELETE SET NULL ON UPDATE CASCADE,
  base_location       geometry(Point, 4326) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'trial_phase', 'active_commercial', 'maintenance', 'suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fleets_base_lat_lng CHECK (
    ST_SRID(base_location) = 4326
    AND ST_Y(base_location) BETWEEN -90 AND 90
    AND ST_X(base_location) BETWEEN -180 AND 180
  )
);

CREATE INDEX IF NOT EXISTS idx_fleets_base_location ON fleets USING GIST (base_location);
CREATE INDEX IF NOT EXISTS idx_fleets_home_airstrip ON fleets (home_airstrip_id);

-- 9. Asset Management linked to airstrips
CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
  airstrip_id     INT NOT NULL REFERENCES airstrips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name            TEXT NOT NULL,
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('hangar', 'fuel_point', 'charging_station', 'lighting', 'terminal', 'ground_vehicle', 'weather_station', 'security_fence')),
  status          TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'maintenance_required', 'under_repair', 'decommissioned', 'planned')),
  condition_grade TEXT NOT NULL DEFAULT 'good' CHECK (condition_grade IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  capacity_spec   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assets_airstrip_name UNIQUE (airstrip_id, name)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assets_airstrip_name') THEN
    DELETE FROM assets a USING assets b WHERE a.id > b.id AND a.airstrip_id = b.airstrip_id AND a.name = b.name;
    ALTER TABLE assets ADD CONSTRAINT uq_assets_airstrip_name UNIQUE (airstrip_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_airstrip ON assets (airstrip_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets (asset_type);

-- 10. Audit Log recording changes for tamper-evidence and governance
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  user_email  TEXT,
  action      TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'REVISE_RISK', 'ASSET_CHANGE')),
  entity_type TEXT NOT NULL,
  entity_id   INT,
  changes     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

-- 11. Seed illustrative assets idempotently
INSERT INTO assets (airstrip_id, name, asset_type, status, condition_grade, quantity, capacity_spec, notes)
SELECT a.id, v.name, v.asset_type, v.status, v.condition_grade, v.qty, v.cap, v.notes
FROM airstrips a
JOIN (VALUES
  ('Jakkur Aerodrome', 'Flight Training Hangar A', 'hangar', 'operational', 'good', 2, 'Accommodates up to 6 light aircraft', 'Active maintenance hangar'),
  ('Jakkur Aerodrome', '100LL Avgas Fuel Depot', 'fuel_point', 'operational', 'excellent', 1, '5000 Liters Capacity', 'Regularly certified underground storage'),
  ('Jakkur Aerodrome', 'Runway Boundary Solar Lighting', 'lighting', 'operational', 'good', 1, 'LED edge lights', 'Visual approach illumination'),
  ('Toranagallu', 'Heavy Corporate Hangar', 'hangar', 'operational', 'excellent', 1, 'Accommodates regional turboprop / Gulfstream', 'Climate controlled facility'),
  ('Toranagallu', 'Dual 350kW DC Fast Vertiport Charger', 'charging_station', 'operational', 'excellent', 2, '700 kW Combined Capacity', 'CCS2 compliant eVTOL fast charger'),
  ('Hosur', 'Industrial Prototype Hangar', 'hangar', 'operational', 'good', 1, 'Spans 1200 sq meters', 'Supports cargo payload integration'),
  ('Hosur', 'eVTOL High-Voltage Pad Charger', 'charging_station', 'planned', 'good', 1, '400 kW Supercharging', 'Scheduled for Phase-2 installation'),
  ('Baramati Aerodrome', 'Multi-Aircraft Training Hangar', 'hangar', 'operational', 'excellent', 3, 'Spans 2500 sq meters', 'Houses active flight academy fleet'),
  ('Baramati Aerodrome', 'Runway Solar Lighting & VASI', 'lighting', 'operational', 'good', 1, 'Night landing certified', 'PAPI / VASI operational'),
  ('Mundra Port Industrial Strip', 'Maritime Logistics Vertiport Hangar', 'hangar', 'operational', 'excellent', 2, 'Spans 3000 sq meters', 'High-volume cargo throughput'),
  ('Mundra Port Industrial Strip', 'Aviation Jet-A1 & Electric Power Hub', 'charging_station', 'operational', 'excellent', 4, '1000 kW microgrid powered', 'Hybrid aviation support')
) AS v(strip_name, name, asset_type, status, condition_grade, qty, cap, notes)
ON a.name ILIKE '%' || v.strip_name || '%'
ON CONFLICT (airstrip_id, name) DO NOTHING;
