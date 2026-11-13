'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { discoverMigrations, validateMigrationSet } = require('./migrate');
const seedModule = require('./seed');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

test('numbered migrations 001 through 007 exist in sequential order without gaps', () => {
  const migrations = discoverMigrations(MIGRATIONS_DIR);
  const versions = migrations.map((m) => m.version);
  assert.deepEqual(versions, ['001', '002', '003', '004', '005', '006', '007']);
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

