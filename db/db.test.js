'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { discoverMigrations, validateMigrationSet } = require('./migrate');
const seedModule = require('./seed');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

test('numbered migrations 001 through 009 exist in sequential order without gaps', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  const versions = migrations.map((m) => m.version);
  assert.deepEqual(versions, ['001', '002', '003', '004', '005', '006', '007', '008', '009']);
  for (const m of migrations) {
    assert.ok(m.checksum.length === 64, `Expected SHA-256 checksum for ${m.filename}`);
  }
});

test('001_init.sql core tables are not duplicated in subsequent CREATE TABLE statements', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  const core001Tables = ['surface_types', 'ownership_types', 'states', 'airstrips', 'airports', 'access_points', 'aircraft_profiles', 'users'];

  for (const m of migrations.filter((x) => x.version !== '001')) {
    for (const tbl of core001Tables) {
      const dupPattern = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${tbl}\\b`, 'i');
      assert.equal(
        dupPattern.test(m.sql),
        false,
        `${m.filename} should not duplicate CREATE TABLE ${tbl} from 001_init.sql`
      );
    }
  }
});

test('migration set defines all required 3NF tables, SRID 4326 geometries, GiST indexes, and CHECK constraints', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  const report = validateMigrationSet(migrations);
  assert.equal(report.passed, true, `Failed schema checks: ${report.failures.join(', ')}`);

  const m006 = fs.readFileSync(path.join(MIGRATIONS_DIR, '006_schema_enhancements.sql'), 'utf8');
  assert.match(m006, /ON DELETE CASCADE/i);
  assert.match(m006, /ON DELETE RESTRICT/i);
  assert.match(m006, /ON DELETE SET NULL/i);
  assert.match(m006, /uq_airstrips_name_state/i);
  assert.match(m006, /uq_airstrip_airport_pair/i);
  assert.match(m006, /chk_airstrip_lat_lng/i);
  assert.match(m006, /chk_airport_lat_lng/i);
  assert.match(m006, /chk_access_point_lat_lng/i);
  assert.match(m006, /chk_fleets_base_lat_lng/i);
});

test('seed dataset contains >= 15 realistic Indian micro-airstrips and >= 5 airports passing all integrity rules', () => {
  assert.ok(seedModule.AIRSTRIPS.length >= 15, `Expected >= 15 airstrips, got ${seedModule.AIRSTRIPS.length}`);
  assert.ok(seedModule.AIRPORTS.length >= 5, `Expected >= 5 airports, got ${seedModule.AIRPORTS.length}`);
  assert.ok(seedModule.ACCESS_POINTS.length >= 20, `Expected >= 20 access points, got ${seedModule.ACCESS_POINTS.length}`);
  assert.ok(seedModule.FLEETS.length >= 5, `Expected >= 5 fleets, got ${seedModule.FLEETS.length}`);

  const result = seedModule.validateSeedData();
  assert.equal(result.valid, true, `Seed validation errors: ${result.errors.join('; ')}`);
});

test('CLI migrate.js --dry-run and seed.js --dry-run execute cleanly with exit code 0', () => {
  const migrateOut = execFileSync(process.execPath, [path.join(__dirname, 'migrate.js'), '--dry-run'], {
    encoding: 'utf8',
  });
  assert.match(migrateOut, /All migration sequence and schema contract checks passed/i);

  const seedOut = execFileSync(process.execPath, [path.join(__dirname, 'seed.js'), '--dry-run'], {
    encoding: 'utf8',
  });
  assert.match(seedOut, /AeroGrid Seed Data Validation \(DRY-RUN\)/i);
});

test('008_aircraft_and_decision_fields.sql defines aircraft decision columns, allowed_surfaces, and nullable airstrip confidence fields', () => {
  const m008 = fs.readFileSync(path.join(MIGRATIONS_DIR, '008_aircraft_and_decision_fields.sql'), 'utf8');

  for (const col of ['takeoff_distance_m', 'landing_distance_m', 'mtow_kg', 'seats', 'allowed_surfaces', 'source', 'notes']) {
    assert.match(m008, new RegExp(`\\b${col}\\b`, 'i'), `Expected aircraft_profiles column ${col} in 008`);
  }
  assert.match(m008, /chk_aircraft_category_valid/i);
  assert.match(m008, /'evtol',\s*'stol',\s*'light_fixed_wing',\s*'turboprop'/i);

  for (const col of ['terrain_risk', 'catchment_population', 'last_mile_access_km', 'data_confidence', 'source', 'verified_at']) {
    assert.match(m008, new RegExp(`\\b${col}\\b`, 'i'), `Expected airstrips column ${col} in 008`);
  }
  assert.match(m008, /chk_airstrip_terrain_risk/i);
  assert.match(m008, /chk_airstrip_data_confidence/i);
  assert.match(m008, /PLACEHOLDER - verify against manufacturer data/);
});

test('seed aircraft profiles are explicitly marked as PLACEHOLDER and missing airstrip fields are NULL with source/confidence', () => {
  assert.equal(seedModule.AIRCRAFT_PROFILES.length, 5);
  const validCategories = new Set(['evtol', 'stol', 'light_fixed_wing', 'turboprop']);
  const surfaceTypeNames = new Set(seedModule.SURFACE_TYPES.map((s) => (typeof s === 'string' ? s : s.name)));

  for (const profile of seedModule.AIRCRAFT_PROFILES) {
    assert.equal(profile.source, 'PLACEHOLDER - verify against manufacturer data');
    assert.ok(validCategories.has(profile.category), `Invalid aircraft category: ${profile.category}`);
    assert.ok(profile.takeoff_distance_m > 0, `Expected positive takeoff_distance_m for ${profile.name}`);
    assert.ok(profile.landing_distance_m > 0, `Expected positive landing_distance_m for ${profile.name}`);
    assert.ok(profile.mtow_kg > 0, `Expected positive mtow_kg for ${profile.name}`);
    assert.ok(profile.payload_kg > 0, `Expected positive payload_kg for ${profile.name}`);
    assert.ok(Number.isInteger(profile.seats) && profile.seats >= 0, `Expected integer seats for ${profile.name}`);
    assert.ok(profile.range_km > 0, `Expected positive range_km for ${profile.name}`);
    assert.ok(Array.isArray(profile.allowed_surfaces) && profile.allowed_surfaces.length > 0, `Expected allowed_surfaces for ${profile.name}`);
    for (const surface of profile.allowed_surfaces) {
      assert.ok(
        surfaceTypeNames.has(surface),
        `Aircraft ${profile.name} allowed_surface '${surface}' does not exist in surface_types (${[...surfaceTypeNames].join(', ')})`
      );
    }
  }

  for (const strip of seedModule.AIRSTRIPS) {
    assert.equal(strip.terrain_risk, null, `Expected NULL terrain_risk for unverified seed strip ${strip.name}`);
    assert.equal(strip.catchment_population, null, `Expected NULL catchment_population for unverified seed strip ${strip.name}`);
    assert.equal(strip.last_mile_access_km, null, `Expected NULL last_mile_access_km for unverified seed strip ${strip.name}`);
    assert.equal(strip.data_confidence, 'low');
    assert.match(strip.source, /PLACEHOLDER/);
  }
});

test('009_integrity_and_indexes.sql defines GiST geography indexes, FK indexes, unique lower(email), and CHECK constraints idempotently', () => {
  const m009 = fs.readFileSync(path.join(MIGRATIONS_DIR, '009_integrity_and_indexes.sql'), 'utf8');

  assert.match(m009, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_airstrips_location_geog\s+ON\s+airstrips\s+USING\s+GIST\s*\(\(location::geography\)\)/i);
  assert.match(m009, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_airports_location\s+ON\s+airports\s+USING\s+GIST\s*\(location\)/i);
  assert.match(m009, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_assets_airstrip_id\s+ON\s+assets\s*\(airstrip_id\)/i);
  assert.match(m009, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_airstrip_access_points_airstrip_id\s+ON\s+airstrip_access_points\s*\(airstrip_id\)/i);
  assert.match(m009, /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uq_users_email_lower\s+ON\s+users\s*\(LOWER\(email\)\)/i);
  assert.match(m009, /chk_assets_status_valid/i);
  assert.match(m009, /chk_assets_condition_grade_valid/i);
  assert.match(m009, /chk_users_role_valid/i);
});

