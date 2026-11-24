-- 014_dedupe_and_enrich.sql
-- Archives duplicate "(test)" and legacy overlapping airstrips via data_status = 'archived'
-- (never hard-deleting referenced rows), enforces unique location among active airstrips,
-- adds/enriches nullable decision fields, and records 'derived/estimated' provenance (confidence='low').
-- Fully idempotent; leaves verified_at NULL.

-- 1. Extend airstrips.data_status CHECK to allow 'archived'
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrips_data_status') THEN
    ALTER TABLE airstrips DROP CONSTRAINT chk_airstrips_data_status;
  END IF;
  ALTER TABLE airstrips ADD CONSTRAINT chk_airstrips_data_status
    CHECK (data_status IN ('synthetic', 'desk_verified', 'field_verified', 'archived'));
END
$mig$;

-- 2. Archive duplicate airstrips within 100m, keeping the real/canonical record in each group.
--    Priority to keep: non-"(test)" name first, then highest id (canonical 004_seed_all_airstrips row).
WITH dup_pairs AS (
  SELECT
    a.id AS id_a, a.name AS name_a,
    b.id AS id_b, b.name AS name_b
  FROM airstrips a
  JOIN airstrips b
    ON a.id < b.id
   AND a.data_status <> 'archived'
   AND b.data_status <> 'archived'
   AND ST_DWithin(a.location::geography, b.location::geography, 100)
),
to_archive AS (
  SELECT DISTINCT
    CASE
      WHEN name_a ILIKE '%(test)%' AND name_b NOT ILIKE '%(test)%' THEN id_a
      WHEN name_b ILIKE '%(test)%' AND name_a NOT ILIKE '%(test)%' THEN id_b
      ELSE id_a
    END AS archive_id
  FROM dup_pairs
)
UPDATE airstrips
SET data_status = 'archived'
WHERE id IN (SELECT archive_id FROM to_archive)
  AND data_status <> 'archived';

-- 3. Prevent two active airstrips from sharing the same location
CREATE UNIQUE INDEX IF NOT EXISTS uq_airstrips_active_location
  ON airstrips (location)
  WHERE data_status <> 'archived';

-- 4. Add nullable decision-support columns if not already present (verified_at remains NULL)
ALTER TABLE airstrips
  ADD COLUMN IF NOT EXISTS terrain_risk         TEXT NULL,
  ADD COLUMN IF NOT EXISTS catchment_population INT NULL,
  ADD COLUMN IF NOT EXISTS last_mile_access_km  NUMERIC(6,2) NULL,
  ADD COLUMN IF NOT EXISTS verified_at          TIMESTAMPTZ NULL;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_terrain_risk') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_airstrip_terrain_risk
      CHECK (terrain_risk IS NULL OR terrain_risk IN ('low', 'moderate', 'high', 'severe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_catchment_nonneg') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_airstrip_catchment_nonneg
      CHECK (catchment_population IS NULL OR catchment_population >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_last_mile_nonneg') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_airstrip_last_mile_nonneg
      CHECK (last_mile_access_km IS NULL OR (last_mile_access_km >= 0 AND last_mile_access_km <= 500));
  END IF;
END
$mig$;

-- 5. Extend provenance field_name CHECK and register 'derived/estimated' data source
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'airstrip_field_sources_field_name_check') THEN
    ALTER TABLE airstrip_field_sources DROP CONSTRAINT airstrip_field_sources_field_name_check;
  END IF;
  ALTER TABLE airstrip_field_sources ADD CONSTRAINT airstrip_field_sources_field_name_check
    CHECK (field_name IN (
      'location', 'elevation_m', 'runway', 'ownership', 'surface',
      'fuel_available', 'charging_available', 'night_landing',
      'political_risk', 'access_points',
      'terrain_risk', 'catchment_population', 'last_mile_access_km'
    ));
END
$mig$;

INSERT INTO data_sources (name, source_type, notes)
VALUES (
  'derived/estimated',
  'desk_research',
  'Rule-derived or aggregated estimate from existing tables (elevation_m, airstrip_access_points). Unverified; confidence=low.'
)
ON CONFLICT (name) DO NOTHING;

-- 6. Enrich NULL terrain_risk from elevation_m rule and record provenance (verified_at stays NULL)
WITH updated_terrain AS (
  UPDATE airstrips
  SET terrain_risk = CASE
    WHEN elevation_m >= 1800 THEN 'severe'
    WHEN elevation_m >= 1000 THEN 'high'
    WHEN elevation_m >= 500  THEN 'moderate'
    ELSE 'low'
  END
  WHERE terrain_risk IS NULL
    AND elevation_m IS NOT NULL
    AND data_status <> 'archived'
  RETURNING id
)
INSERT INTO airstrip_field_sources (airstrip_id, field_name, source_id, confidence, verified_by, verified_at, note)
SELECT
  u.id,
  'terrain_risk',
  ds.id,
  'low',
  NULL,
  NULL,
  'derived/estimated from elevation_m'
FROM updated_terrain u
JOIN data_sources ds ON ds.name = 'derived/estimated'
ON CONFLICT (airstrip_id, field_name, source_id) DO NOTHING;

-- 7. catchment_population: cities table has no population column in the live schema, so leave NULL.

-- 8. Enrich NULL last_mile_access_km from MIN(distance_km) in airstrip_access_points and record provenance
WITH nearest_access AS (
  SELECT airstrip_id, MIN(distance_km) AS min_km
  FROM airstrip_access_points
  GROUP BY airstrip_id
),
updated_access AS (
  UPDATE airstrips a
  SET last_mile_access_km = na.min_km
  FROM nearest_access na
  WHERE a.id = na.airstrip_id
    AND a.last_mile_access_km IS NULL
    AND a.data_status <> 'archived'
  RETURNING a.id
)
INSERT INTO airstrip_field_sources (airstrip_id, field_name, source_id, confidence, verified_by, verified_at, note)
SELECT
  u.id,
  'last_mile_access_km',
  ds.id,
  'low',
  NULL,
  NULL,
  'derived/estimated from MIN(airstrip_access_points.distance_km)'
FROM updated_access u
JOIN data_sources ds ON ds.name = 'derived/estimated'
ON CONFLICT (airstrip_id, field_name, source_id) DO NOTHING;
