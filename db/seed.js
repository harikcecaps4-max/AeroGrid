#!/usr/bin/env node
'use strict';

/**
 * AeroGrid Idempotent Database Seed Script
 *
 * NOTE: All runway specifications, access-point timings, fleet allocations, and
 * political influence annotations below are ILLUSTRATIVE synthetic/public-reference
 * seed data for development, spatial testing, and decision-support demonstrations.
 *
 * Usage:
 *   node db/seed.js             # Populate Neon PostgreSQL cleanly (idempotent)
 *   node db/seed.js --dry-run   # Validate all seed rows against DB CHECK & FK constraints offline
 */

const fs = require('fs');
const path = require('path');
const { computeAirstripChecksum } = require('../server/src/utils/integrity');

function loadPg() {
  const candidates = [
    'pg',
    path.resolve(__dirname, '../server/node_modules/pg'),
    path.resolve(__dirname, '../functions/aerogrid_api/node_modules/pg'),
  ];
  for (const modPath of candidates) {
    try {
      return require(modPath);
    } catch {
      // try next path
    }
  }
  return null;
}

function loadEnvFiles() {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../server/.env'),
    path.resolve(__dirname, '../functions/aerogrid_api/.env'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const {
  SURFACE_TYPES,
  OWNERSHIP_TYPES,
  ACCESS_TYPES,
  FLEET_CATEGORIES,
  AIRCRAFT_CATEGORIES,
  TERRAIN_RISK_LEVELS,
  DATA_CONFIDENCE_LEVELS,
  PLACEHOLDER_AIRCRAFT_SOURCE,
  PLACEHOLDER_AIRSTRIP_SOURCE,
  STATES,
  AIRPORTS,
  AIRSTRIPS,
  ACCESS_POINTS,
  AIRCRAFT_PROFILES,
  FLEETS,
} = require('./data/seedData');

/**
 * Validates every seed row against DB-level CHECK, UNIQUE, NOT NULL, and FK constraints.
 */
function validateSeedData() {
  const errors = [];
  const stateNames = new Set(STATES.map((s) => s.name));
  const airportCodes = new Set();
  const airstripPairs = new Set();
  const airstripNames = new Set();
  const aircraftProfileNames = new Set();
  const fleetNames = new Set();

  if (AIRSTRIPS.length < 15) {
    errors.push(`Expected at least 15 airstrips, got ${AIRSTRIPS.length}`);
  }
  if (AIRPORTS.length < 5) {
    errors.push(`Expected at least 5 airports, got ${AIRPORTS.length}`);
  }
  if (AIRCRAFT_PROFILES.length < 4) {
    errors.push(`Expected at least 4 aircraft profiles, got ${AIRCRAFT_PROFILES.length}`);
  }

  for (const ap of AIRPORTS) {
    if (!ap.code || ap.code !== ap.code.toUpperCase() || ap.code.length < 3 || ap.code.length > 4) {
      errors.push(`Invalid airport code: ${ap.code}`);
    }
    if (airportCodes.has(ap.code)) errors.push(`Duplicate airport code: ${ap.code}`);
    airportCodes.add(ap.code);
    if (!stateNames.has(ap.state)) errors.push(`Airport ${ap.code} references unknown state: ${ap.state}`);
    if (ap.lat < -90 || ap.lat > 90 || ap.lon < -180 || ap.lon > 180) {
      errors.push(`Airport ${ap.code} has out-of-range coordinates (${ap.lat}, ${ap.lon})`);
    }
  }

  for (const a of AIRSTRIPS) {
    if (!a.name) errors.push('Airstrip missing name');
    if (!stateNames.has(a.state)) errors.push(`Airstrip "${a.name}" references unknown state: ${a.state}`);
    if (!SURFACE_TYPES.includes(a.surface)) errors.push(`Airstrip "${a.name}" invalid surface: ${a.surface}`);
    if (!OWNERSHIP_TYPES.includes(a.ownership)) errors.push(`Airstrip "${a.name}" invalid ownership: ${a.ownership}`);
    if (!(a.runway_length_m > 0 && a.runway_length_m <= 6000)) errors.push(`Airstrip "${a.name}" invalid runway_length_m: ${a.runway_length_m}`);
    if (a.runway_width_m != null && !(a.runway_width_m > 0 && a.runway_width_m <= 200)) errors.push(`Airstrip "${a.name}" invalid runway_width_m: ${a.runway_width_m}`);
    if (a.elevation_m != null && (a.elevation_m < -500 || a.elevation_m > 9000)) errors.push(`Airstrip "${a.name}" invalid elevation_m: ${a.elevation_m}`);
    if (a.lat < -90 || a.lat > 90 || a.lon < -180 || a.lon > 180) {
      errors.push(`Airstrip "${a.name}" out-of-range coordinates (${a.lat}, ${a.lon})`);
    }
    if (a.terrain_risk !== null && !TERRAIN_RISK_LEVELS.includes(a.terrain_risk)) {
      errors.push(`Airstrip "${a.name}" invalid terrain_risk: ${a.terrain_risk}`);
    }
    if (a.catchment_population !== null && (!(Number.isInteger(a.catchment_population)) || a.catchment_population < 0)) {
      errors.push(`Airstrip "${a.name}" invalid catchment_population: ${a.catchment_population}`);
    }
    if (a.last_mile_access_km !== null && (a.last_mile_access_km < 0 || a.last_mile_access_km > 500)) {
      errors.push(`Airstrip "${a.name}" invalid last_mile_access_km: ${a.last_mile_access_km}`);
    }
    if (!DATA_CONFIDENCE_LEVELS.includes(a.data_confidence)) {
      errors.push(`Airstrip "${a.name}" invalid data_confidence: ${a.data_confidence}`);
    }
    if (!a.source || typeof a.source !== 'string' || !a.source.trim()) {
      errors.push(`Airstrip "${a.name}" missing source`);
    }
    const pairKey = `${a.name}::${a.state}`;
    if (airstripPairs.has(pairKey)) errors.push(`Duplicate airstrip/state pair: ${pairKey}`);
    airstripPairs.add(pairKey);
    airstripNames.add(a.name);
  }

  for (const p of AIRCRAFT_PROFILES) {
    if (!p.name) errors.push('Aircraft profile missing name');
    if (aircraftProfileNames.has(p.name)) errors.push(`Duplicate aircraft profile name: ${p.name}`);
    aircraftProfileNames.add(p.name);
    if (!AIRCRAFT_CATEGORIES.includes(p.category)) {
      errors.push(`Aircraft "${p.name}" invalid category: ${p.category}`);
    }
    if (!(p.takeoff_distance_m > 0 && p.takeoff_distance_m <= 5000)) {
      errors.push(`Aircraft "${p.name}" invalid takeoff_distance_m: ${p.takeoff_distance_m}`);
    }
    if (!(p.landing_distance_m > 0 && p.landing_distance_m <= 5000)) {
      errors.push(`Aircraft "${p.name}" invalid landing_distance_m: ${p.landing_distance_m}`);
    }
    if (!(p.mtow_kg > 0 && p.mtow_kg <= 100000)) {
      errors.push(`Aircraft "${p.name}" invalid mtow_kg: ${p.mtow_kg}`);
    }
    if (!(p.payload_kg > 0 && p.payload_kg <= 50000)) {
      errors.push(`Aircraft "${p.name}" invalid payload_kg: ${p.payload_kg}`);
    }
    if (!Number.isInteger(p.seats) || p.seats < 0 || p.seats > 500) {
      errors.push(`Aircraft "${p.name}" invalid seats: ${p.seats}`);
    }
    if (!(p.range_km > 0 && p.range_km <= 20000)) {
      errors.push(`Aircraft "${p.name}" invalid range_km: ${p.range_km}`);
    }
    if (!Array.isArray(p.allowed_surfaces) || p.allowed_surfaces.length === 0) {
      errors.push(`Aircraft "${p.name}" must specify at least one allowed surface`);
    } else {
      for (const s of p.allowed_surfaces) {
        if (!SURFACE_TYPES.includes(s)) {
          errors.push(`Aircraft "${p.name}" invalid allowed_surface: ${s}`);
        }
      }
    }
    if (p.source !== PLACEHOLDER_AIRCRAFT_SOURCE) {
      errors.push(`Aircraft "${p.name}" source must equal "${PLACEHOLDER_AIRCRAFT_SOURCE}"`);
    }
    if (!p.notes || typeof p.notes !== 'string' || !p.notes.trim()) {
      errors.push(`Aircraft "${p.name}" missing notes`);
    }
  }

  for (const acc of ACCESS_POINTS) {
    if (!airstripNames.has(acc.airstrip)) errors.push(`Access point "${acc.name}" references missing airstrip "${acc.airstrip}"`);
    if (!ACCESS_TYPES.includes(acc.access_type)) errors.push(`Access point "${acc.name}" invalid type: ${acc.access_type}`);
    if (acc.distance_km < 0 || acc.distance_km > 500) errors.push(`Access point "${acc.name}" invalid distance_km: ${acc.distance_km}`);
    if (acc.lat < -90 || acc.lat > 90 || acc.lon < -180 || acc.lon > 180) {
      errors.push(`Access point "${acc.name}" invalid coordinates (${acc.lat}, ${acc.lon})`);
    }
  }

  for (const f of FLEETS) {
    if (fleetNames.has(f.name)) errors.push(`Duplicate fleet name: ${f.name}`);
    fleetNames.add(f.name);
    if (!aircraftProfileNames.has(f.profile)) errors.push(`Fleet "${f.name}" references unknown aircraft profile: ${f.profile}`);
    if (!FLEET_CATEGORIES.includes(f.category)) errors.push(`Fleet "${f.name}" invalid category: ${f.category}`);
    if (!airstripNames.has(f.home_airstrip)) errors.push(`Fleet "${f.name}" references missing airstrip: ${f.home_airstrip}`);
    if (!airportCodes.has(f.target_airport)) errors.push(`Fleet "${f.name}" references missing airport: ${f.target_airport}`);
    if (!(f.tail_count > 0 && f.min_runway_m > 0 && f.range_km > 0)) errors.push(`Fleet "${f.name}" fails positive constraints`);
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      surface_types: SURFACE_TYPES.length,
      ownership_types: OWNERSHIP_TYPES.length,
      states: STATES.length,
      airports: AIRPORTS.length,
      airstrips: AIRSTRIPS.length,
      access_points: ACCESS_POINTS.length,
      aircraft_profiles: AIRCRAFT_PROFILES.length,
      fleets: FLEETS.length,
    },
  };
}

async function runSeed({ dryRun = false } = {}) {
  loadEnvFiles();
  const validation = validateSeedData();

  if (!validation.valid) {
    console.error('[ERROR] Seed validation failed:');
    for (const err of validation.errors) console.error('  -', err);
    process.exitCode = 1;
    return validation;
  }

  if (dryRun || !process.env.DATABASE_URL) {
    if (!dryRun) {
      console.warn('[WARN] DATABASE_URL is not set. Running seed integrity validation (--dry-run) instead.\n');
    }
    console.log('=== AeroGrid Seed Data Validation (DRY-RUN) ===');
    console.log('All illustrative Indian micro-airstrips, airports, access points, and fleets satisfy schema rules.');
    console.table(validation.counts);
    return validation;
  }

  const pg = loadPg();
  if (!pg) {
    throw new Error('Could not resolve `pg` package. Install dependencies first.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN');

    // 1. Lookup tables
    for (const s of SURFACE_TYPES) {
      await client.query('INSERT INTO surface_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [s]);
    }
    for (const o of OWNERSHIP_TYPES) {
      await client.query('INSERT INTO ownership_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [o]);
    }
    for (const st of STATES) {
      await client.query(
        `INSERT INTO states (name, type, capital) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, capital = EXCLUDED.capital`,
        [st.name, st.type, st.capital]
      );
    }

    // 2. Airports
    const airportIdByCode = new Map();
    for (const ap of AIRPORTS) {
      const { rows } = await client.query(
        `INSERT INTO airports (code, name, state_id, location)
         SELECT $1, $2, s.id, ST_SetSRID(ST_MakePoint($3, $4), 4326)
         FROM states s WHERE s.name = $5
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           state_id = EXCLUDED.state_id,
           location = EXCLUDED.location
         RETURNING id`,
        [ap.code, ap.name, ap.lon, ap.lat, ap.state]
      );
      airportIdByCode.set(ap.code, rows[0].id);
    }

    // 3. Airstrips + tamper-detection checksum
    const airstripIdByName = new Map();
    const airstripLocByName = new Map();
    for (const a of AIRSTRIPS) {
      const { rows } = await client.query(
        `INSERT INTO airstrips (
           name, state_id, ownership_id, surface_id, location,
           elevation_m, runway_length_m, runway_width_m,
           night_landing, fuel_available, charging_available,
           political_severity, disruption_type,
           terrain_risk, catchment_population, last_mile_access_km,
           data_confidence, source, verified_at, updated_at
         )
         SELECT $1, s.id, o.id, f.id, ST_SetSRID(ST_MakePoint($2, $3), 4326),
                $4, $5, $6, $7, $8, $9, $10, $11,
                $15, $16, $17, $18, $19, $20, now()
         FROM states s, ownership_types o, surface_types f
         WHERE s.name = $12 AND o.name = $13 AND f.name = $14
         ON CONFLICT (name, state_id) DO UPDATE SET
           ownership_id = EXCLUDED.ownership_id,
           surface_id = EXCLUDED.surface_id,
           location = EXCLUDED.location,
           elevation_m = EXCLUDED.elevation_m,
           runway_length_m = EXCLUDED.runway_length_m,
           runway_width_m = EXCLUDED.runway_width_m,
           night_landing = EXCLUDED.night_landing,
           fuel_available = EXCLUDED.fuel_available,
           charging_available = EXCLUDED.charging_available,
           political_severity = EXCLUDED.political_severity,
           disruption_type = EXCLUDED.disruption_type,
           terrain_risk = EXCLUDED.terrain_risk,
           catchment_population = EXCLUDED.catchment_population,
           last_mile_access_km = EXCLUDED.last_mile_access_km,
           data_confidence = EXCLUDED.data_confidence,
           source = EXCLUDED.source,
           verified_at = EXCLUDED.verified_at,
           updated_at = now()
         RETURNING id`,
        [
          a.name, a.lon, a.lat, a.elevation_m, a.runway_length_m, a.runway_width_m,
          a.night_landing, a.fuel_available, a.charging_available,
          a.political_severity, a.disruption_type, a.state, a.ownership, a.surface,
          a.terrain_risk, a.catchment_population, a.last_mile_access_km,
          a.data_confidence, a.source, a.verified_at,
        ]
      );

      const stripId = rows[0].id;
      airstripIdByName.set(a.name, stripId);
      airstripLocByName.set(a.name, { lon: a.lon, lat: a.lat });

      const checksum = computeAirstripChecksum({
        id: stripId,
        name: a.name,
        runway_length_m: a.runway_length_m,
        runway_width_m: a.runway_width_m,
        surface_name: a.surface,
        longitude: a.lon,
        latitude: a.lat,
        political_severity: a.political_severity,
      });
      await client.query('UPDATE airstrips SET checksum = $1 WHERE id = $2', [checksum, stripId]);
    }

    // 4. Last-mile Airstrip Access Points
    for (const acc of ACCESS_POINTS) {
      const stripId = airstripIdByName.get(acc.airstrip);
      await client.query(
        `INSERT INTO airstrip_access_points (
           airstrip_id, access_type, name, distance_km, drive_time_mins, road_condition, location
         )
         VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
         ON CONFLICT (airstrip_id, access_type, name) DO UPDATE SET
           distance_km = EXCLUDED.distance_km,
           drive_time_mins = EXCLUDED.drive_time_mins,
           road_condition = EXCLUDED.road_condition,
           location = EXCLUDED.location`,
        [stripId, acc.access_type, acc.name, acc.distance_km, acc.drive_time_mins, acc.road_condition, acc.lon, acc.lat]
      );
    }

    // 5. PostGIS-computed Airstrip <-> Airport distances
    const { rowCount: distanceRows } = await client.query(`
      WITH computed AS (
        SELECT
          a.id AS airstrip_id,
          ap.id AS airport_id,
          GREATEST(ROUND((ST_Distance(a.location::geography, ap.location::geography) / 1000.0)::numeric, 2), 0.10) AS distance_km,
          CASE
            WHEN ROUND(MOD((DEGREES(ST_Azimuth(a.location::geography, ap.location::geography))::numeric + 360.0), 360.0), 2) >= 360.0 THEN 0.00
            ELSE COALESCE(ROUND(MOD((DEGREES(ST_Azimuth(a.location::geography, ap.location::geography))::numeric + 360.0), 360.0), 2), 0.00)
          END AS bearing_deg,
          GREATEST(1, CEIL((ST_Distance(a.location::geography, ap.location::geography) / 1000.0) / 240.0 * 60.0)::int) AS flight_time_evtol_mins,
          ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY a.location <-> ap.location) AS rn
        FROM airstrips a
        CROSS JOIN airports ap
      )
      INSERT INTO airstrip_airport_distances (
        airstrip_id, airport_id, distance_km, bearing_deg, flight_time_evtol_mins, is_nearest, calculated_at
      )
      SELECT airstrip_id, airport_id, distance_km, bearing_deg, flight_time_evtol_mins, (rn = 1), now()
      FROM computed
      WHERE rn = 1 OR distance_km <= 600.0
      ON CONFLICT (airstrip_id, airport_id) DO UPDATE SET
        distance_km = EXCLUDED.distance_km,
        bearing_deg = EXCLUDED.bearing_deg,
        flight_time_evtol_mins = EXCLUDED.flight_time_evtol_mins,
        is_nearest = EXCLUDED.is_nearest,
        calculated_at = now()
    `);

    // 6. Aircraft Profiles & Fleets
    const profileIdByName = new Map();
    for (const p of AIRCRAFT_PROFILES) {
      const { rows } = await client.query(
        `INSERT INTO aircraft_profiles (
           name, category, min_runway_m, takeoff_distance_m, landing_distance_m,
           mtow_kg, payload_kg, seats, passengers, range_km, needs_charging,
           allowed_surfaces, source, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (name) DO UPDATE SET
           category = EXCLUDED.category,
           min_runway_m = EXCLUDED.min_runway_m,
           takeoff_distance_m = EXCLUDED.takeoff_distance_m,
           landing_distance_m = EXCLUDED.landing_distance_m,
           mtow_kg = EXCLUDED.mtow_kg,
           payload_kg = EXCLUDED.payload_kg,
           seats = EXCLUDED.seats,
           passengers = EXCLUDED.passengers,
           range_km = EXCLUDED.range_km,
           needs_charging = EXCLUDED.needs_charging,
           allowed_surfaces = EXCLUDED.allowed_surfaces,
           source = EXCLUDED.source,
           notes = EXCLUDED.notes
         RETURNING id`,
        [
          p.name, p.category, p.min_runway_m, p.takeoff_distance_m, p.landing_distance_m,
          p.mtow_kg, p.payload_kg, p.seats, p.passengers, p.range_km, p.needs_charging,
          p.allowed_surfaces, p.source, p.notes,
        ]
      );
      profileIdByName.set(p.name, rows[0].id);
    }

    for (const f of FLEETS) {
      const homeId = airstripIdByName.get(f.home_airstrip);
      const targetId = airportIdByCode.get(f.target_airport);
      const profileId = profileIdByName.get(f.profile);
      const loc = airstripLocByName.get(f.home_airstrip);
      await client.query(
        `INSERT INTO fleets (
           name, operator_name, aircraft_profile_id, category, aircraft_model, tail_count,
           min_runway_m, requires_paved, range_km, cruise_speed_kmh, payload_kg,
           home_airstrip_id, target_airport_id, base_location, status, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ST_SetSRID(ST_MakePoint($14, $15), 4326), $16, now())
         ON CONFLICT (name) DO UPDATE SET
           operator_name = EXCLUDED.operator_name,
           aircraft_profile_id = EXCLUDED.aircraft_profile_id,
           category = EXCLUDED.category,
           aircraft_model = EXCLUDED.aircraft_model,
           tail_count = EXCLUDED.tail_count,
           min_runway_m = EXCLUDED.min_runway_m,
           requires_paved = EXCLUDED.requires_paved,
           range_km = EXCLUDED.range_km,
           cruise_speed_kmh = EXCLUDED.cruise_speed_kmh,
           payload_kg = EXCLUDED.payload_kg,
           home_airstrip_id = EXCLUDED.home_airstrip_id,
           target_airport_id = EXCLUDED.target_airport_id,
           base_location = EXCLUDED.base_location,
           status = EXCLUDED.status,
           updated_at = now()`,
        [
          f.name, f.operator_name, profileId, f.category, f.aircraft_model, f.tail_count,
          f.min_runway_m, f.requires_paved, f.range_km, f.cruise_speed_kmh, f.payload_kg,
          homeId, targetId, loc.lon, loc.lat, f.status,
        ]
      );
    }

    await client.query('COMMIT');
    console.log('=== AeroGrid Database Seed Complete ===');
    console.table({ ...validation.counts, airstrip_airport_distances: distanceRows });
    return { ...validation, distanceRows };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Database seed failed; transaction rolled back:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--validate');
  runSeed({ dryRun }).catch(() => process.exit(1));
}

module.exports = {
  SURFACE_TYPES,
  OWNERSHIP_TYPES,
  ACCESS_TYPES,
  FLEET_CATEGORIES,
  AIRCRAFT_CATEGORIES,
  TERRAIN_RISK_LEVELS,
  DATA_CONFIDENCE_LEVELS,
  PLACEHOLDER_AIRCRAFT_SOURCE,
  PLACEHOLDER_AIRSTRIP_SOURCE,
  STATES,
  AIRPORTS,
  AIRSTRIPS,
  ACCESS_POINTS,
  AIRCRAFT_PROFILES,
  FLEETS,
  validateSeedData,
  runSeed,
};

