-- Lookup tables (keeps the schema in 3NF)
CREATE TABLE surface_types   (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);   -- asphalt, gravel, grass...
CREATE TABLE ownership_types (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);   -- private, municipal, state...
CREATE TABLE states          (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);

CREATE TABLE airstrips (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  state_id         INT REFERENCES states(id),
  ownership_id     INT REFERENCES ownership_types(id),
  surface_id       INT REFERENCES surface_types(id),
  location         geometry(Point, 4326) NOT NULL,
  elevation_m      NUMERIC,
  runway_length_m  NUMERIC,
  runway_width_m   NUMERIC,
  night_landing    BOOLEAN DEFAULT FALSE,
  fuel_available   BOOLEAN DEFAULT FALSE,
  charging_available BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_airstrips_location ON airstrips USING GIST (location);

CREATE TABLE airports (
  id       SERIAL PRIMARY KEY,
  code     TEXT UNIQUE,
  name     TEXT NOT NULL,
  location geometry(Point, 4326) NOT NULL
);
CREATE INDEX idx_airports_location ON airports USING GIST (location);

CREATE TABLE access_points (
  id          SERIAL PRIMARY KEY,
  airstrip_id INT REFERENCES airstrips(id) ON DELETE CASCADE,
  kind        TEXT CHECK (kind IN ('highway','rail','city_centre','hospital')),
  name        TEXT,
  location    geometry(Point, 4326) NOT NULL
);
CREATE INDEX idx_access_location ON access_points USING GIST (location);

CREATE TABLE aircraft_profiles (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT CHECK (category IN ('eVTOL','STOL','turboprop')),
  min_runway_m    NUMERIC,
  range_km        NUMERIC,
  payload_kg      NUMERIC,
  passengers      INT,
  needs_charging  BOOLEAN DEFAULT FALSE
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','analyst','viewer'))
);