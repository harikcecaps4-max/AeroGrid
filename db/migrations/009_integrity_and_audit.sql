-- 009_integrity_and_audit.sql
-- AeroGrid: data integrity, hashing and audit.
--
-- Covers the project rule "verify data using hashing, salting and database rules":
--   * database rules ....... CHECK / NOT NULL / FK ... RESTRICT / unique keys, plus FK indexes
--   * hashing .............. SHA-256 row checksums on airstrips, runways, aircraft_profiles;
--                            SHA-256 hash chain on audit_log; token hashes only for refresh tokens
--   * salting .............. users.password_hash must be a bcrypt hash (the salt is inside the bcrypt string),
--                            so plain-text passwords cannot be stored at all
--
-- Honest limit: triggers and hashes make tampering DETECTABLE. A database owner can still disable a trigger,
-- but then fn_verify_audit_chain() and the checksum checks in verify/verify_normalization.sql will show it.

-- ---------------------------------------------------------------------------
-- 1. generic helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$f$;

CREATE OR REPLACE FUNCTION fn_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
  RETURN NULL;
END
$f$;

-- ---------------------------------------------------------------------------
-- 2. users: timestamps, soft disable, lockout, enforced bcrypt + normalised email
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMPTZ;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_failed_login_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_failed_login_nonneg CHECK (failed_login_count >= 0);
  END IF;

  -- emails are stored lower-case, so the existing UNIQUE (email) is effectively case-insensitive
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_email_format
      CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
  END IF;

  -- only bcrypt hashes ($2a/$2b/$2x/$2y$, cost, 22-char salt + 31-char hash) can be stored
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_password_is_bcrypt') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_password_is_bcrypt
      CHECK (password_hash ~ '^\$2[abxy]\$[0-9]{2}\$[./A-Za-z0-9]{53}$');
  END IF;
END
$mig$;

-- refresh tokens: only the SHA-256 of the token is stored, never the token itself
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash  TEXT NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  replaced_by BIGINT REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent  TEXT,
  ip_address  TEXT,
  CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
  CONSTRAINT chk_refresh_tokens_expiry CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_replaced_by ON refresh_tokens (replaced_by);

-- ---------------------------------------------------------------------------
-- 3. updated_at maintained by the database, not by application code
-- ---------------------------------------------------------------------------
DO $mig$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['airstrips', 'runways', 'organizations', 'fleets', 'assets', 'aircraft_profiles', 'users'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t);
  END LOOP;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 4. SHA-256 row checksums (tamper detection for the data the decision engine trusts)
-- ---------------------------------------------------------------------------
-- Hash only covers each table's own stable attributes, so the later column drops in 012 do not change it.
-- jsonb_build_array keeps NULLs and field positions, so ('a', NULL) and (NULL, 'a') hash differently.

CREATE OR REPLACE FUNCTION fn_airstrips_hash(a airstrips) RETURNS TEXT LANGUAGE sql STABLE AS $f$
  SELECT encode(sha256(convert_to(
    jsonb_build_array(a.name, a.state_id, a.ownership_id, ST_AsText(a.location), a.elevation_m)::text,
    'UTF8')), 'hex')
$f$;

CREATE OR REPLACE FUNCTION fn_runways_hash(r runways) RETURNS TEXT LANGUAGE sql STABLE AS $f$
  SELECT encode(sha256(convert_to(
    jsonb_build_array(r.airstrip_id, r.designator, r.length_m, r.width_m, r.surface_id, r.is_primary)::text,
    'UTF8')), 'hex')
$f$;

CREATE OR REPLACE FUNCTION fn_aircraft_profiles_hash(p aircraft_profiles) RETURNS TEXT LANGUAGE sql STABLE AS $f$
  SELECT encode(sha256(convert_to(
    jsonb_build_array(p.name, p.category, p.min_runway_m, p.range_km, p.payload_kg, p.passengers,
                      p.needs_charging, p.cruise_speed_kmh, p.needs_paved, p.energy_type)::text,
    'UTF8')), 'hex')
$f$;

CREATE OR REPLACE FUNCTION fn_airstrips_set_checksum() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN NEW.checksum := fn_airstrips_hash(NEW); RETURN NEW; END
$f$;

CREATE OR REPLACE FUNCTION fn_runways_set_checksum() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN NEW.checksum := fn_runways_hash(NEW); RETURN NEW; END
$f$;

CREATE OR REPLACE FUNCTION fn_aircraft_profiles_set_checksum() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN NEW.checksum := fn_aircraft_profiles_hash(NEW); RETURN NEW; END
$f$;

DROP TRIGGER IF EXISTS trg_airstrips_checksum ON airstrips;
CREATE TRIGGER trg_airstrips_checksum BEFORE INSERT OR UPDATE ON airstrips
  FOR EACH ROW EXECUTE FUNCTION fn_airstrips_set_checksum();

DROP TRIGGER IF EXISTS trg_runways_checksum ON runways;
CREATE TRIGGER trg_runways_checksum BEFORE INSERT OR UPDATE ON runways
  FOR EACH ROW EXECUTE FUNCTION fn_runways_set_checksum();

DROP TRIGGER IF EXISTS trg_aircraft_profiles_checksum ON aircraft_profiles;
CREATE TRIGGER trg_aircraft_profiles_checksum BEFORE INSERT OR UPDATE ON aircraft_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_aircraft_profiles_set_checksum();

-- back-fill existing rows
UPDATE airstrips a SET checksum = fn_airstrips_hash(a);
UPDATE runways r SET checksum = fn_runways_hash(r);
UPDATE aircraft_profiles p SET checksum = fn_aircraft_profiles_hash(p);

-- ---------------------------------------------------------------------------
-- 5. audit_log: SHA-256 hash chain, append-only
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS chain_seq BIGINT,
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_hash  TEXT;

-- audit rows must outlive users: deleting a user is blocked, users are disabled with is_active instead
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_log_user') THEN
    ALTER TABLE audit_log ADD CONSTRAINT fk_audit_log_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$mig$;

-- the hash covers every audit field; timestamps are rendered in UTC so the hash never depends on session time zone
CREATE OR REPLACE FUNCTION fn_audit_row_hash(p_prev TEXT, r audit_log) RETURNS TEXT LANGUAGE sql STABLE AS $f$
  SELECT encode(sha256(convert_to(
    p_prev || jsonb_build_array(r.chain_seq, r.id, r.user_id, r.user_email, r.action, r.entity_type,
                                r.entity_id, r.changes, r.ip_address,
                                to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'))::text,
    'UTF8')), 'hex')
$f$;

-- chain any rows that already exist (runs only while nothing is chained yet)
DO $mig$
DECLARE
  r      audit_log;
  v_prev TEXT := repeat('0', 64);
  n      BIGINT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM audit_log WHERE row_hash IS NOT NULL) THEN
    FOR r IN SELECT * FROM audit_log ORDER BY id LOOP
      n := n + 1;
      r.chain_seq := n;
      r.prev_hash := v_prev;
      r.row_hash  := fn_audit_row_hash(v_prev, r);
      UPDATE audit_log SET chain_seq = r.chain_seq, prev_hash = r.prev_hash, row_hash = r.row_hash WHERE id = r.id;
      v_prev := r.row_hash;
    END LOOP;
  END IF;
END
$mig$;

ALTER TABLE audit_log
  ALTER COLUMN chain_seq SET NOT NULL,
  ALTER COLUMN prev_hash SET NOT NULL,
  ALTER COLUMN row_hash  SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_log_chain_seq ON audit_log (chain_seq);

-- chain_seq is assigned under a lock, so concurrent inserts cannot fork the chain
CREATE OR REPLACE FUNCTION fn_audit_chain() RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE
  v_prev TEXT;
  v_seq  BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('aerogrid_audit_chain'));
  SELECT row_hash, chain_seq INTO v_prev, v_seq FROM audit_log ORDER BY chain_seq DESC LIMIT 1;
  NEW.chain_seq := COALESCE(v_seq, 0) + 1;
  NEW.prev_hash := COALESCE(v_prev, repeat('0', 64));
  NEW.row_hash  := fn_audit_row_hash(NEW.prev_hash, NEW);
  RETURN NEW;
END
$f$;

DROP TRIGGER IF EXISTS trg_audit_log_chain ON audit_log;
CREATE TRIGGER trg_audit_log_chain BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_audit_chain();

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION fn_block_mutation();

-- returns zero rows when the chain is intact
CREATE OR REPLACE FUNCTION fn_verify_audit_chain()
RETURNS TABLE (bad_chain_seq BIGINT, problem TEXT) LANGUAGE sql STABLE AS $f$
  SELECT t.chain_seq, t.problem
  FROM (
    SELECT a.chain_seq,
           CASE
             WHEN a.chain_seq <> row_number() OVER (ORDER BY a.chain_seq)
               THEN 'gap or reorder in chain_seq'
             WHEN a.prev_hash IS DISTINCT FROM COALESCE(lag(a.row_hash) OVER (ORDER BY a.chain_seq), repeat('0', 64))
               THEN 'prev_hash does not match the previous row'
             WHEN a.row_hash IS DISTINCT FROM fn_audit_row_hash(a.prev_hash, a)
               THEN 'row content does not match its hash'
           END AS problem
    FROM audit_log a
  ) t
  WHERE t.problem IS NOT NULL
  ORDER BY t.chain_seq
$f$;

-- ---------------------------------------------------------------------------
-- 6. indexes on foreign keys that had none (joins and ON DELETE checks scan these)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_airstrips_ownership_id ON airstrips (ownership_id);
CREATE INDEX IF NOT EXISTS idx_airports_state_id      ON airports (state_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id      ON audit_log (user_id);

COMMENT ON FUNCTION fn_verify_audit_chain() IS 'Returns the broken links of the audit hash chain; zero rows means intact.';
COMMENT ON COLUMN airstrips.checksum IS 'SHA-256 of name, state, ownership, location, elevation. Set by trigger.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt only (salt inside the hash). Enforced by chk_users_password_is_bcrypt.';
