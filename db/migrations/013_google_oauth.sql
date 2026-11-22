-- 013_google_oauth.sql
-- Adds Google OAuth identity linkage (google_sub), makes users.password_hash nullable
-- for OAuth-only accounts, and allows LOGIN_GOOGLE in audit_log.action.
-- Fully idempotent; safe to re-run.

-- 1. Add nullable unique google_sub column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;

-- 2. Allow NULL password_hash for Google-authenticated users
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_password_is_bcrypt') THEN
    ALTER TABLE users DROP CONSTRAINT chk_users_password_is_bcrypt;
  END IF;
  ALTER TABLE users ADD CONSTRAINT chk_users_password_is_bcrypt
    CHECK (
      password_hash IS NULL
      OR password_hash ~ '^\$2[abxy]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    );
END
$mig$;

-- 3. Permit LOGIN_GOOGLE in audit_log action CHECK constraint
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_action_check') THEN
    ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_check;
  END IF;
  ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
    CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_GOOGLE', 'REVISE_RISK', 'ASSET_CHANGE'));
END
$mig$;
