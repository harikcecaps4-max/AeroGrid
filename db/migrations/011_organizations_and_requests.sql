-- 011_organizations_and_requests.sql
-- AeroGrid: the business core.
--
--   A company (air taxi / eVTOL operator) asks: "can we deploy this fleet at these airstrips?"
--   That request is the CORE RUN:
--       deployment_request  ->  engine evaluates every requested aircraft x airstrip pair
--                           ->  evaluations (append-only, explainable)  ->  ranked result per aircraft
--
--   Around it:
--       organizations (008) .... every company we deal with
--       organization_relationships  where each company is in our pipeline, with history
--       services / organization_services  what we provide to whom
--       users.organization_id ... lets a company user log in and see only their own requests
--
-- Normal forms:
--   * 3NF/BCNF: relationship status is time-varying, so it lives in its own history table, not on organizations.
--   * 5NF: request x aircraft x airstrip would be a three-way relation if stored as one table. Because every
--     requested aircraft is evaluated at every requested airstrip, that relation is the join of two binary
--     relations (request-aircraft and request-airstrip). It is therefore stored as two tables and the results
--     (which differ per pair) live in evaluations. A single ternary table would repeat facts and allow
--     update anomalies.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. organizations: first-contact facts (they depend on the company, not on a status change)
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS first_contact_on           DATE,
  ADD COLUMN IF NOT EXISTS first_contact_initiated_by TEXT;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_first_contact_initiator') THEN
    ALTER TABLE organizations ADD CONSTRAINT chk_org_first_contact_initiator
      CHECK (first_contact_initiated_by IS NULL OR first_contact_initiated_by IN ('them', 'us'));
  END IF;
END
$mig$;

-- ---------------------------------------------------------------------------
-- 2. pipeline history: who approached us, who joined hands, who paused or left
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_relationships (
  id             SERIAL PRIMARY KEY,
  organization_id INT  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status         TEXT NOT NULL CHECK (status IN
                   ('researching', 'approached', 'in_discussion', 'pilot', 'partner', 'paused', 'declined', 'ended')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  owner_user_id  INT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_org_rel_dates CHECK (effective_to IS NULL OR effective_to >= effective_from),
  -- a company has exactly one status at any moment: periods may not overlap (an open period runs to infinity)
  CONSTRAINT excl_org_rel_no_overlap EXCLUDE USING gist (
    organization_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&)
);
CREATE INDEX IF NOT EXISTS idx_org_rel_owner ON organization_relationships (owner_user_id);

-- one row per company with its current status
CREATE OR REPLACE VIEW v_organization_pipeline AS
SELECT o.id AS organization_id, o.name, o.org_type, o.country_code,
       o.first_contact_on, o.first_contact_initiated_by,
       r.status AS current_status, r.effective_from AS status_since, r.owner_user_id
FROM organizations o
LEFT JOIN organization_relationships r
       ON r.organization_id = o.id AND r.effective_to IS NULL;

-- ---------------------------------------------------------------------------
-- 3. services we provide, and who receives which
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL CHECK (code ~ '^[a-z0-9_]+$'),
  name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_services_code UNIQUE (code)
);

-- starting catalogue taken from the product concept; edit freely to match what you actually offer
INSERT INTO services (code, name, description) VALUES
  ('site_feasibility',   'Airstrip feasibility assessment', 'Verdict, score, gate results and factor breakdown for an aircraft at an airstrip.'),
  ('fleet_deployment',   'Fleet deployment analysis',       'Ranks candidate airstrips for a fleet and compares the best options.'),
  ('ground_access',      'Last-mile ground access review',  'Distance and condition of road, rail, hospital and city access to each airstrip.'),
  ('site_report_export', 'Site report export',              'Printable report per airstrip and aircraft, including data confidence and caveats.')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_services (
  id              SERIAL PRIMARY KEY,
  organization_id INT  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  service_id      INT  NOT NULL REFERENCES services(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'completed', 'cancelled')),
  started_on      DATE,
  ended_on        DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_org_services_dates CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);
-- at most one open engagement per company and service
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_services_open
  ON organization_services (organization_id, service_id) WHERE status IN ('proposed', 'active');
CREATE INDEX IF NOT EXISTS idx_org_services_service ON organization_services (service_id);

-- ---------------------------------------------------------------------------
-- 4. users belong to a company (operators) or to us (staff)
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INT;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_organization') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$mig$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_role
      CHECK (role IN ('admin', 'analyst', 'viewer', 'operator'));
  END IF;
  -- operator users must belong to a company; our own staff must not
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role_organization') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_role_organization
      CHECK ((role = 'operator') = (organization_id IS NOT NULL));
  END IF;
END
$mig$;
CREATE INDEX IF NOT EXISTS idx_users_organization ON users (organization_id);

-- ---------------------------------------------------------------------------
-- 5. the core run: deployment requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deployment_requests (
  id              BIGSERIAL PRIMARY KEY,
  organization_id INT  NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  requested_by    INT  NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  title           TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'running', 'completed', 'failed', 'cancelled')),
  submitted_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_request_completed_after_submitted
    CHECK (completed_at IS NULL OR (submitted_at IS NOT NULL AND completed_at >= submitted_at)),
  CONSTRAINT chk_request_submitted_has_time
    CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_deployment_requests_org ON deployment_requests (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_requests_user ON deployment_requests (requested_by);

DROP TRIGGER IF EXISTS trg_deployment_requests_updated_at ON deployment_requests;
CREATE TRIGGER trg_deployment_requests_updated_at BEFORE UPDATE ON deployment_requests
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- which aircraft the company wants to deploy, and how many of each
CREATE TABLE IF NOT EXISTS deployment_request_aircraft (
  request_id          BIGINT NOT NULL REFERENCES deployment_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  aircraft_profile_id INT    NOT NULL REFERENCES aircraft_profiles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  quantity            INT    NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (request_id, aircraft_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_dra_aircraft ON deployment_request_aircraft (aircraft_profile_id);

-- which airstrips are candidates
CREATE TABLE IF NOT EXISTS deployment_request_airstrips (
  request_id  BIGINT NOT NULL REFERENCES deployment_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  airstrip_id INT    NOT NULL REFERENCES airstrips(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (request_id, airstrip_id)
);
CREATE INDEX IF NOT EXISTS idx_drs_airstrip ON deployment_request_airstrips (airstrip_id);

-- evaluations may belong to a request. Composite foreign keys guarantee that an evaluation inside a request
-- is only ever for an aircraft AND an airstrip that the request actually asked about.
-- Both columns being NULL-able keeps ad-hoc evaluations (outside any request) possible.
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS deployment_request_id BIGINT;

DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluations_request_aircraft') THEN
    ALTER TABLE evaluations ADD CONSTRAINT fk_evaluations_request_aircraft
      FOREIGN KEY (deployment_request_id, aircraft_profile_id)
      REFERENCES deployment_request_aircraft (request_id, aircraft_profile_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_evaluations_request_airstrip') THEN
    ALTER TABLE evaluations ADD CONSTRAINT fk_evaluations_request_airstrip
      FOREIGN KEY (deployment_request_id, airstrip_id)
      REFERENCES deployment_request_airstrips (request_id, airstrip_id) ON DELETE RESTRICT;
  END IF;
END
$mig$;

CREATE INDEX IF NOT EXISTS idx_evaluations_request_aircraft ON evaluations (deployment_request_id, aircraft_profile_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_request_airstrip ON evaluations (deployment_request_id, airstrip_id);

-- ranked answer for a request: latest evaluation per aircraft and airstrip, ranked by score within each aircraft
CREATE OR REPLACE VIEW v_deployment_request_results AS
WITH latest AS (
  SELECT DISTINCT ON (e.deployment_request_id, e.aircraft_profile_id, e.airstrip_id)
         e.deployment_request_id AS request_id, e.aircraft_profile_id, e.airstrip_id,
         e.id AS evaluation_id, e.score, e.verdict, e.caveat, e.evaluated_at
  FROM evaluations e
  WHERE e.deployment_request_id IS NOT NULL
  ORDER BY e.deployment_request_id, e.aircraft_profile_id, e.airstrip_id, e.evaluated_at DESC, e.id DESC
)
SELECT l.*,
       rank() OVER (PARTITION BY l.request_id, l.aircraft_profile_id ORDER BY l.score DESC) AS rank_for_aircraft
FROM latest l;

COMMENT ON TABLE deployment_requests IS 'The core run: a company asks whether a fleet can be deployed at candidate airstrips.';
COMMENT ON TABLE organization_relationships IS 'Pipeline history. No overlapping periods per company; the open period is the current status.';
COMMENT ON TABLE organization_services IS 'Which of our services each company receives, with status and dates.';
