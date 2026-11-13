#!/usr/bin/env node
'use strict';

/**
 * AeroGrid Database Migration Runner
 *
 * Runs numbered SQL migrations in /db/migrations in strict sequential order,
 * tracks applied versions in `schema_migrations` with SHA-256 checksums,
 * executes each pending migration inside a transaction, and skips any migration
 * already recorded as applied.
 *
 * Usage:
 *   node db/migrate.js             # Apply pending migrations against DATABASE_URL
 *   node db/migrate.js --dry-run   # Validate migration order, SQL checksums & rules offline
 *   node db/migrate.js --status    # Show applied vs pending status
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Resolve `pg` from standard resolution paths or functions/aerogrid_api/node_modules.
 */
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

/**
 * Load environment variables from root or server .env files without printing values.
 */
function loadEnvFiles() {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../server/.env'),
    path.resolve(__dirname, '../functions/aerogrid_api/.env'),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

/**
 * Discover and validate numbered SQL migration files in /db/migrations.
 */
function discoverMigrations(migrationsDir = MIGRATIONS_DIR) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const migrations = [];
  const seenVersions = new Set();

  for (const filename of sqlFiles) {
    const match = filename.match(/^(\d+)_([a-zA-Z0-9_-]+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename format: "${filename}". Expected <NNN>_<name>.sql`);
    }
    const version = match[1].padStart(3, '0');
    if (seenVersions.has(version)) {
      throw new Error(`Duplicate migration version prefix "${version}" found at "${filename}"`);
    }
    seenVersions.add(version);

    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    if (!sql.trim()) {
      throw new Error(`Migration file "${filename}" is empty.`);
    }

    const checksum = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
    migrations.push({
      version,
      filename,
      fullPath,
      sql,
      checksum,
      bytes: Buffer.byteLength(sql, 'utf8'),
    });
  }

  return migrations;
}

/**
 * Validate expected schema invariants across the migration set for offline verification.
 */
function validateMigrationSet(migrations) {
  const combinedSql = migrations.map((m) => m.sql).join('\n');
  const checks = [
    { name: 'Table: airstrips', pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+airstrips\b/i },
    { name: 'Table: airstrip_access_points', pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+airstrip_access_points\b/i },
    { name: 'Table: airports', pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+airports\b/i },
    { name: 'Table: airstrip_airport_distances', pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+airstrip_airport_distances\b/i },
    { name: 'Table: fleets', pattern: /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+fleets\b/i },
    { name: 'GiST index on airstrips(location)', pattern: /USING\s+GIST\s*\(\s*location\s*\)/i },
    { name: 'GiST index on airstrip_access_points(location)', pattern: /idx_airstrip_access_points_location\s+ON\s+airstrip_access_points\s+USING\s+GIST\s*\(\s*location\s*\)/i },
    { name: 'GiST index on fleets(base_location)', pattern: /idx_fleets_base_location\s+ON\s+fleets\s+USING\s+GIST\s*\(\s*base_location\s*\)/i },
    { name: 'CHECK: runway_length_m > 0', pattern: /runway_length_m\s*>\s*0/i },
    { name: 'CHECK: lat/lng SRID 4326 bounds', pattern: /ST_Y\([^)]+\)\s+BETWEEN\s+-90\s+AND\s+90/i },
    { name: 'CHECK: surface type enum', pattern: /chk_surface_type_valid/i },
    { name: 'CHECK: ownership type enum', pattern: /chk_ownership_type_valid/i },
  ];

  const failures = checks.filter((c) => !c.pattern.test(combinedSql)).map((c) => c.name);
  return {
    passed: failures.length === 0,
    totalChecks: checks.length,
    failures,
  };
}

function runDryRun(migrations) {
  console.log('=== AeroGrid Migration Runner (DRY-RUN / VALIDATION) ===');
  console.log(`Directory : ${MIGRATIONS_DIR}`);
  console.log(`Discovered: ${migrations.length} migration file(s)\n`);

  for (const m of migrations) {
    console.log(`  [${m.version}] ${m.filename.padEnd(40)} sha256:${m.checksum.slice(0, 12)} (${m.bytes} B)`);
  }

  const report = validateMigrationSet(migrations);
  console.log(`\nSchema Integrity Checks: ${report.totalChecks - report.failures.length}/${report.totalChecks} passed`);
  if (!report.passed) {
    console.error('Failed checks:', report.failures.join(', '));
    process.exitCode = 1;
    return report;
  }

  console.log('All migration sequence and schema contract checks passed.');
  return report;
}

/**
 * Baseline already-applied initial migrations if schema_migrations is newly created
 * against a pre-initialized Neon database where 001/002 were run manually.
 */
async function baselinePreExistingIfNeeded(client, migrations) {
  const { rows: existingCountRows } = await client.query('SELECT COUNT(*)::int AS cnt FROM schema_migrations');
  if (existingCountRows[0].cnt > 0) return;

  const { rows: tableRows } = await client.query(
    `SELECT to_regclass('public.airstrips') AS airstrips_tbl,
            to_regclass('public.airports') AS airports_tbl`
  );
  if (!tableRows[0].airstrips_tbl) return;

  const m001 = migrations.find((m) => m.version === '001');
  if (m001) {
    await client.query(
      `INSERT INTO schema_migrations (version, filename, checksum, execution_ms)
       VALUES ($1, $2, $3, 0) ON CONFLICT (version) DO NOTHING`,
      [m001.version, m001.filename, m001.checksum]
    );
    console.log(`[BASELINE] ${m001.filename} (core tables already present in DB)`);
  }

  if (tableRows[0].airports_tbl) {
    const { rows: apRows } = await client.query('SELECT COUNT(*)::int AS cnt FROM airports');
    const m002 = migrations.find((m) => m.version === '002');
    if (apRows[0].cnt >= 7 && m002) {
      await client.query(
        `INSERT INTO schema_migrations (version, filename, checksum, execution_ms)
         VALUES ($1, $2, $3, 0) ON CONFLICT (version) DO NOTHING`,
        [m002.version, m002.filename, m002.checksum]
      );
      console.log(`[BASELINE] ${m002.filename} (initial seed data already present in DB)`);
    }
  }
}

async function runMigrations({ dryRun = false, statusOnly = false } = {}) {
  loadEnvFiles();
  const migrations = discoverMigrations();

  if (dryRun) {
    return runDryRun(migrations);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[WARN] DATABASE_URL is not set. Switching to --dry-run offline validation.\n');
    return runDryRun(migrations);
  }

  const pg = loadPg();
  if (!pg) {
    throw new Error('Could not resolve `pg` package. Install dependencies in functions/aerogrid_api or root.');
  }

  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version      TEXT PRIMARY KEY,
        filename     TEXT NOT NULL,
        checksum     TEXT NOT NULL,
        applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        execution_ms INT NOT NULL DEFAULT 0
      );
    `);

    await baselinePreExistingIfNeeded(client, migrations);

    const { rows: appliedRows } = await client.query(
      'SELECT version, filename, checksum, applied_at FROM schema_migrations ORDER BY version ASC'
    );
    const appliedMap = new Map(appliedRows.map((r) => [r.version, r]));

    if (statusOnly) {
      console.log('=== AeroGrid Migration Status ===');
      for (const m of migrations) {
        const applied = appliedMap.get(m.version);
        const state = applied ? `APPLIED (${new Date(applied.applied_at).toISOString()})` : 'PENDING';
        console.log(`  [${m.version}] ${m.filename.padEnd(40)} ${state}`);
      }
      return { applied: appliedRows.length, pending: migrations.length - appliedRows.length };
    }

    let appliedCount = 0;
    let skippedCount = 0;

    for (const m of migrations) {
      const existing = appliedMap.get(m.version);
      if (existing) {
        if (existing.checksum !== m.checksum) {
          console.warn(`[WARN] Checksum mismatch for already-applied migration ${m.filename}; skipping as immutable.`);
        } else {
          console.log(`[SKIP]    ${m.filename} (already applied)`);
        }
        skippedCount++;
        continue;
      }

      const start = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        const elapsedMs = Date.now() - start;
        await client.query(
          `INSERT INTO schema_migrations (version, filename, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [m.version, m.filename, m.checksum, elapsedMs]
        );
        await client.query('COMMIT');
        console.log(`[APPLIED] ${m.filename} (${elapsedMs}ms)`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[FAILED]  ${m.filename}: ${err.message}`);
        throw err;
      }
    }

    console.log(`\nMigration complete. Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${migrations.length}`);
    return { applied: appliedCount, skipped: skippedCount, total: migrations.length };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run') || args.has('--validate');
  const statusOnly = args.has('--status');

  runMigrations({ dryRun, statusOnly }).catch((err) => {
    console.error('[ERROR] Migration runner failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  discoverMigrations,
  validateMigrationSet,
  runMigrations,
};

