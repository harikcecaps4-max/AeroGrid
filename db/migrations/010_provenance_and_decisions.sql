-- 010_provenance_and_decisions.sql
-- AeroGrid: where the data came from, and an explainable, reproducible record of every verdict.
--
-- Design notes (normal forms):
--   * Provenance uses one table per entity with a real foreign key, not a single (entity_type, entity_id)
--     table. A polymorphic pair cannot have a foreign key, so it would allow rows pointing at nothing.
--   * evaluations -> gate results / factor scores are 1:N child tables with composite keys (BCNF).
--   * Relation operator - aircraft - airstrip is NOT stored as one ternary table. It is expressed through
--     fleets (operator + aircraft) and fleets.home_airstrip_id, and the engine output lives in evaluations.
--     No join dependency exists that would need a 5NF split; see the explanation in the hand-over notes.

-- ---------------------------------------------------------------------------
-- 1. data sources + status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  source_type  TEXT NOT NULL CHECK (source_type IN
                 ('official', 'manufacturer', 'field_survey', 'desk_research', 'synthetic', 'user_submitted')),
  url          TEXT,
  retrieved_on DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_data_sources_name UNIQUE (name)
);

INSERT INTO data_sources (name, source_type, notes)
VALUES ('Synthetic prototype data', 'synthetic', 'Placeholder rows created for the prototype. Not real survey data.')
ON CONFLICT (name) DO NOTHING;

-- every existing airstrip starts as synthetic: nothing is claimed as verified until someone verifies it
ALTER TABLE airstrips ADD COLUMN IF NOT EXISTS data_status TEXT NOT NULL DEFAULT 'synthetic';

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airstrips_data_status') THEN
    ALTER TABLE airstrips ADD CONSTRAINT chk_airstrips_data_status
      CHECK (data_status IN ('synthetic', 'desk_verified', 'field_verified'));
  END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS airstrip_field_sources (
  id          SERIAL PRIMARY KEY,
  airstrip_id INT  NOT NULL REFERENCES airstrips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  field_name  TEXT NOT NULL CHECK (field_name IN
                ('location', 'elevation_m', 'runway', 'ownership', 'surface', 'fuel_available',
                 'charging_available', 'night_landing', 'political_risk', 'access_points')),
  source_id   INT  NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  confidence  TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  verified_by INT  REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  verified_at TIMESTAMPTZ,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_airstrip_field_source UNIQUE (airstrip_id, field_name, source_id),
  CONSTRAINT chk_airstrip_field_verified_pair CHECK ((verified_by IS NULL) = (verified_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_airstrip_field_sources_source ON airstrip_field_sources (source_id);
CREATE INDEX IF NOT EXISTS idx_airstrip_field_sources_verified_by ON airstrip_field_sources (verified_by);

CREATE TABLE IF NOT EXISTS aircraft_field_sources (
  id                  SERIAL PRIMARY KEY,
  aircraft_profile_id INT  NOT NULL REFERENCES aircraft_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  field_name          TEXT NOT NULL CHECK (field_name IN
                        ('category', 'min_runway_m', 'range_km', 'payload_kg', 'passengers',
                         'cruise_speed_kmh', 'needs_paved', 'needs_charging', 'energy_type')),
  source_id           INT  NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  confidence          TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  verified_by         INT  REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  verified_at         TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_aircraft_field_source UNIQUE (aircraft_profile_id, field_name, source_id),
  CONSTRAINT chk_aircraft_field_verified_pair CHECK ((verified_by IS NULL) = (verified_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_aircraft_field_sources_source ON aircraft_field_sources (source_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_field_sources_verified_by ON aircraft_field_sources (verified_by);

-- ---------------------------------------------------------------------------
-- 2. versioned engine configuration (thresholds and weights are data, not code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engine_configs (
  id          SERIAL PRIMARY KEY,
  version     TEXT  NOT NULL CHECK (length(btrim(version)) > 0),
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  thresholds  JSONB NOT NULL CHECK (jsonb_typeof(thresholds) = 'object'),
  weights     JSONB NOT NULL CHECK (jsonb_typeof(weights) = 'object'),
  config_hash TEXT,
  notes       TEXT,
  created_by  INT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_engine_configs_version UNIQUE (version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_engine_configs_one_active ON engine_configs (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_engine_configs_created_by ON engine_configs (created_by);

-- hash is computed by the database; thresholds and weights cannot change after insert (only is_active can)
CREATE OR REPLACE FUNCTION fn_engine_configs_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.config_hash := encode(sha256(convert_to(NEW.thresholds::text || '|' || NEW.weights::text, 'UTF8')), 'hex');
  ELSIF NEW.thresholds IS DISTINCT FROM OLD.thresholds
     OR NEW.weights IS DISTINCT FROM OLD.weights
     OR NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION 'engine_configs %: thresholds, weights and version are immutable; insert a new version instead', OLD.version
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$f$;

DROP TRIGGER IF EXISTS trg_engine_configs_guard ON engine_configs;
CREATE TRIGGER trg_engine_configs_guard BEFORE INSERT OR UPDATE ON engine_configs
  FOR EACH ROW EXECUTE FUNCTION fn_engine_configs_guard();

-- ---------------------------------------------------------------------------
-- 3. evaluations: one verdict = one immutable record with its gates and factors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluations (
  id                  BIGSERIAL PRIMARY KEY,
  airstrip_id         INT  NOT NULL REFERENCES airstrips(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  aircraft_profile_id INT  NOT NULL REFERENCES aircraft_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  engine_config_id    INT  NOT NULL REFERENCES engine_configs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  engine_version      TEXT NOT NULL CHECK (length(btrim(engine_version)) > 0),
  score               NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  verdict             TEXT NOT NULL CHECK (verdict IN ('viable', 'conditional', 'not_viable')),
  input_snapshot      JSONB NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
  inputs_hash         TEXT  NOT NULL CHECK (inputs_hash ~ '^[0-9a-f]{64}$'),
  caveat              TEXT  NOT NULL CHECK (length(btrim(caveat)) > 0),   -- decision-support caveat on every verdict
  evaluated_by        INT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evaluations_pair ON evaluations (airstrip_id, aircraft_profile_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_aircraft ON evaluations (aircraft_profile_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_config ON evaluations (engine_config_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluated_by ON evaluations (evaluated_by);

CREATE TABLE IF NOT EXISTS evaluation_gate_results (
  evaluation_id BIGINT NOT NULL REFERENCES evaluations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  gate_key      TEXT   NOT NULL CHECK (gate_key ~ '^[a-z0-9_]+$'),
  passed        BOOLEAN NOT NULL,
  detail        TEXT,
  PRIMARY KEY (evaluation_id, gate_key)
);

CREATE TABLE IF NOT EXISTS evaluation_factor_scores (
  evaluation_id BIGINT NOT NULL REFERENCES evaluations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  factor_key    TEXT   NOT NULL CHECK (factor_key ~ '^[a-z0-9_]+$'),
  raw_value     NUMERIC,
  normalised    NUMERIC CHECK (normalised IS NULL OR (normalised >= 0 AND normalised <= 1)),
  weight        NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
  contribution  NUMERIC NOT NULL,
  PRIMARY KEY (evaluation_id, factor_key)
);

-- verdicts are history: they can be added, never edited or deleted
DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['evaluations', 'evaluation_gate_results', 'evaluation_factor_scores'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_immutable ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_immutable BEFORE UPDATE OR DELETE ON %1$I FOR EACH ROW EXECUTE FUNCTION fn_block_mutation()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_no_truncate ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_no_truncate BEFORE TRUNCATE ON %1$I FOR EACH STATEMENT EXECUTE FUNCTION fn_block_mutation()', t);
  END LOOP;
END
$mig$;

COMMENT ON TABLE evaluations IS 'Append-only. Each row stores the exact inputs, engine version and config used, so a verdict can be reproduced.';
COMMENT ON TABLE airstrip_field_sources IS 'Which source supports which field of an airstrip, with confidence and who verified it.';
COMMENT ON COLUMN airstrips.data_status IS 'synthetic until someone verifies it. field_verified should have a field_survey source row.';
