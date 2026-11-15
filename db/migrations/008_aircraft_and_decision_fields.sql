-- 008_aircraft_and_decision_fields.sql
-- AeroGrid Decision Engine data model: extend aircraft_profiles for suitability
-- scoring and add nullable provenance-tracked decision fields on airstrips.
-- Non-duplicating companion to 001_init.sql..007_seed_access_distances_fleets.sql.

-- 1. Drop legacy inline category CHECK constraint on aircraft_profiles so
--    lowercase normalized categories + light_fixed_wing are permitted.
DO $$
DECLARE
  con_rec RECORD;
BEGIN
  FOR con_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'aircraft_profiles'::regclass
      AND contype = 'c'
      AND (
        conname = 'aircraft_profiles_category_check'
        OR conname = 'chk_aircraft_category_valid'
        OR pg_get_constraintdef(oid) ILIKE '%category%'
      )
  LOOP
    EXECUTE format('ALTER TABLE aircraft_profiles DROP CONSTRAINT %I', con_rec.conname);
  END LOOP;
END $$;

UPDATE aircraft_profiles
SET category = CASE
  WHEN LOWER(category) = 'hybrid' THEN 'stol'
  ELSE LOWER(category)
END
WHERE category IS NOT NULL;

-- 2. Extend aircraft_profiles with performance, surface compatibility & provenance columns
ALTER TABLE aircraft_profiles
  ADD COLUMN IF NOT EXISTS takeoff_distance_m NUMERIC,
  ADD COLUMN IF NOT EXISTS landing_distance_m NUMERIC,
  ADD COLUMN IF NOT EXISTS mtow_kg            NUMERIC,
  ADD COLUMN IF NOT EXISTS seats              INT,
  ADD COLUMN IF NOT EXISTS allowed_surfaces   TEXT[] NOT NULL DEFAULT ARRAY['asphalt', 'concrete']::TEXT[],
  ADD COLUMN IF NOT EXISTS source             TEXT NOT NULL DEFAULT 'PLACEHOLDER - verify against manufacturer data',
  ADD COLUMN IF NOT EXISTS notes              TEXT;

-- Backfill pre-existing rows cleanly before enforcing CHECK constraints
UPDATE aircraft_profiles
SET
  takeoff_distance_m = COALESCE(takeoff_distance_m, min_runway_m, 100),
  landing_distance_m = COALESCE(landing_distance_m, min_runway_m, 100),
  mtow_kg            = COALESCE(mtow_kg, GREATEST(COALESCE(payload_kg, 400) * 3, 1000)),
  seats              = COALESCE(seats, passengers, 4),
  source             = 'PLACEHOLDER - verify against manufacturer data',
  notes              = COALESCE(notes, 'PLACEHOLDER legacy seed profile - verify against manufacturer data');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_category_valid') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_category_valid
      CHECK (category IN ('evtol', 'stol', 'light_fixed_wing', 'turboprop'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_takeoff_pos') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_takeoff_pos
      CHECK (takeoff_distance_m IS NULL OR (takeoff_distance_m > 0 AND takeoff_distance_m <= 5000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_landing_pos') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_landing_pos
      CHECK (landing_distance_m IS NULL OR (landing_distance_m > 0 AND landing_distance_m <= 5000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_mtow_pos') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_mtow_pos
      CHECK (mtow_kg IS NULL OR (mtow_kg > 0 AND mtow_kg <= 100000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_payload_pos') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_payload_pos
      CHECK (payload_kg IS NULL OR (payload_kg > 0 AND payload_kg <= 50000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_seats_nonneg') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_seats_nonneg
      CHECK (seats IS NULL OR (seats >= 0 AND seats <= 500));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_range_pos') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_range_pos
      CHECK (range_km IS NULL OR (range_km > 0 AND range_km <= 20000));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aircraft_allowed_surfaces_nonempty') THEN
    ALTER TABLE aircraft_profiles
      ADD CONSTRAINT chk_aircraft_allowed_surfaces_nonempty
      CHECK (cardinality(allowed_surfaces) >= 1);
  END IF;
END $$;

-- 3. Add nullable decision-support fields and confidence/source tracking to airstrips
ALTER TABLE airstrips
  ADD COLUMN IF NOT EXISTS terrain_risk         TEXT NULL,
  ADD COLUMN IF NOT EXISTS catchment_population INT NULL,
  ADD COLUMN IF NOT EXISTS last_mile_access_km  NUMERIC(6,2) NULL,
  ADD COLUMN IF NOT EXISTS data_confidence      TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS source               TEXT NOT NULL DEFAULT 'PLACEHOLDER - unverified regional registry',
  ADD COLUMN IF NOT EXISTS verified_at          DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_terrain_risk') THEN
    ALTER TABLE airstrips
      ADD CONSTRAINT chk_airstrip_terrain_risk
      CHECK (terrain_risk IS NULL OR terrain_risk IN ('low', 'moderate', 'high', 'severe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_catchment_nonneg') THEN
    ALTER TABLE airstrips
      ADD CONSTRAINT chk_airstrip_catchment_nonneg
      CHECK (catchment_population IS NULL OR catchment_population >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_last_mile_nonneg') THEN
    ALTER TABLE airstrips
      ADD CONSTRAINT chk_airstrip_last_mile_nonneg
      CHECK (last_mile_access_km IS NULL OR (last_mile_access_km >= 0 AND last_mile_access_km <= 500));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrip_data_confidence') THEN
    ALTER TABLE airstrips
      ADD CONSTRAINT chk_airstrip_data_confidence
      CHECK (data_confidence IN ('high', 'medium', 'low', 'unverified'));
  END IF;
END $$;

-- 4. Upsert 5 canonical representative aircraft profiles (all marked PLACEHOLDER)
INSERT INTO aircraft_profiles (
  name, category, min_runway_m, takeoff_distance_m, landing_distance_m,
  mtow_kg, payload_kg, seats, passengers, range_km, needs_charging,
  allowed_surfaces, source, notes
)
VALUES
  (
    'Joby S4 (Representative eVTOL)',
    'evtol',
    60, 60, 60,
    2404, 453, 4, 4, 160, TRUE,
    ARRAY['asphalt', 'concrete']::TEXT[],
    'PLACEHOLDER - verify against manufacturer data',
    'PLACEHOLDER figures for 4-passenger tilt-propeller eVTOL operating from paved FATO/runway strip. Pilot to verify against OEM POH/type data.'
  ),
  (
    'Electra EL-2 Goldfinch (Representative eSTOL)',
    'stol',
    95, 95, 95,
    3175, 900, 9, 9, 800, TRUE,
    ARRAY['asphalt', 'concrete', 'gravel', 'grass']::TEXT[],
    'PLACEHOLDER - verify against manufacturer data',
    'PLACEHOLDER figures for hybrid-electric blown-lift ultra-short takeoff aircraft. Pilot to verify against OEM specification sheet.'
  ),
  (
    'Viking DHC-6 Twin Otter Series 400',
    'stol',
    366, 366, 320,
    5670, 1800, 19, 19, 1480, FALSE,
    ARRAY['asphalt', 'concrete', 'gravel', 'grass', 'laterite']::TEXT[],
    'PLACEHOLDER - verify against manufacturer data',
    'PLACEHOLDER figures for twin-turboprop unpressurized STOL utility commuter (ISA sea level, MTOW over 50ft obstacle). Pilot to verify against Viking AFM.'
  ),
  (
    'Cessna 208B Grand Caravan EX',
    'light_fixed_wing',
    658, 658, 500,
    3995, 1400, 9, 9, 1680, FALSE,
    ARRAY['asphalt', 'concrete', 'gravel']::TEXT[],
    'PLACEHOLDER - verify against manufacturer data',
    'PLACEHOLDER figures for single-engine utility turboprop regional feeder (ISA sea level, MTOW over 50ft obstacle). Pilot to verify against Textron POH.'
  ),
  (
    'ATR 42-600S (Regional Turboprop)',
    'turboprop',
    1050, 1050, 950,
    18600, 4900, 48, 48, 1300, FALSE,
    ARRAY['asphalt', 'concrete']::TEXT[],
    'PLACEHOLDER - verify against manufacturer data',
    'PLACEHOLDER figures for regional commuter turboprop short-field variant requiring paved runway. Pilot to verify against ATR performance manual.'
  )
ON CONFLICT (name) DO UPDATE SET
  category           = EXCLUDED.category,
  min_runway_m       = EXCLUDED.min_runway_m,
  takeoff_distance_m = EXCLUDED.takeoff_distance_m,
  landing_distance_m = EXCLUDED.landing_distance_m,
  mtow_kg            = EXCLUDED.mtow_kg,
  payload_kg         = EXCLUDED.payload_kg,
  seats              = EXCLUDED.seats,
  passengers         = EXCLUDED.passengers,
  range_km           = EXCLUDED.range_km,
  needs_charging     = EXCLUDED.needs_charging,
  allowed_surfaces   = EXCLUDED.allowed_surfaces,
  source             = EXCLUDED.source,
  notes              = EXCLUDED.notes;

-- 5. Re-link fleets referencing legacy 002/007 placeholder names before cleaning up unreferenced legacy profiles
WITH legacy_map(old_name, new_name) AS (
  VALUES
    ('Generic 4-seat eVTOL',     'Joby S4 (Representative eVTOL)'),
    ('Sarla Shunya 6-seat eVTOL', 'Joby S4 (Representative eVTOL)'),
    ('Electra EL-2 eSTOL',        'Electra EL-2 Goldfinch (Representative eSTOL)'),
    ('STOL commuter class',       'Viking DHC-6 Twin Otter Series 400'),
    ('Cessna 208B Grand Caravan', 'Cessna 208B Grand Caravan EX'),
    ('Regional turboprop class',  'ATR 42-600S (Regional Turboprop)')
)
UPDATE fleets f
SET aircraft_profile_id = target.id,
    updated_at = now()
FROM aircraft_profiles old_ap
JOIN legacy_map lm ON lm.old_name = old_ap.name
JOIN aircraft_profiles target ON target.name = lm.new_name
WHERE f.aircraft_profile_id = old_ap.id;

DELETE FROM aircraft_profiles ap
WHERE ap.name NOT IN (
  'Joby S4 (Representative eVTOL)',
  'Electra EL-2 Goldfinch (Representative eSTOL)',
  'Viking DHC-6 Twin Otter Series 400',
  'Cessna 208B Grand Caravan EX',
  'ATR 42-600S (Regional Turboprop)'
)
AND NOT EXISTS (
  SELECT 1 FROM fleets f WHERE f.aircraft_profile_id = ap.id
);
