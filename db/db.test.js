'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { discoverMigrations, validateMigrationSet } = require('./migrate');
const seedModule = require('./seed');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

test('numbered migrations 001 through 012 exist in sequential order without gaps', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  const versions = migrations.map((m) => m.version);
  assert.deepEqual(versions, ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012']);
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

test('restored 008-012 migrations define runways, capability views, provenance, and production hardening', () => {
  const read = (f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
  const m008 = read('008_normalize_core.sql');
  assert.match(m008, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+runways/i);
  assert.match(m008, /uq_runways_one_primary/i);
  assert.match(m008, /v_airstrip_primary_runway/i);
  assert.match(m008, /v_airstrip_capabilities/i);
  for (const col of ['needs_paved', 'energy_type', 'spec_status', 'cruise_speed_kmh']) {
    assert.match(m008, new RegExp(`\\b${col}\\b`, 'i'), `Expected aircraft_profiles column ${col} in 008`);
  }
  const m009 = read('009_integrity_and_audit.sql');
  assert.match(m009, /chk_users_password_is_bcrypt/i);
  assert.match(m009, /chk_users_email_format/i);
  assert.match(m009, /fn_audit_row_hash/i);
  assert.match(read('010_provenance_and_decisions.sql'), /chk_airstrips_data_status/i);
  assert.match(read('011_organizations_and_requests.sql'), /organizations/i);
  assert.match(read('012_neon_production_hardening.sql'), /idx_airstrips_location_geog/i);
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
