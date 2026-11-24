'use strict';

const fs = require('fs');
const path = require('path');

// Load root .env when present for local dev (never during test runs, never overwrite existing env vars)
if (process.env.NODE_ENV !== 'test') {
  const rootEnvPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(rootEnvPath)) {
    try {
      require('dotenv').config({ path: rootEnvPath, quiet: true });
    } catch {
      const lines = fs.readFileSync(rootEnvPath, 'utf8').split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
}

const config = require('./src/config/env');
const app = require('../functions/aerogrid_api/index');

if (require.main === module) {
  const port = config.port;
  const server = app.listen(port, (err) => {
    if (err) {
      console.error(
        `[AeroGrid Server]: Failed to bind port ${port}: ${err.code || err.message}`
      );
      process.exit(1);
    }
    console.log(`[AeroGrid Server]: Listening on http://localhost:${port} in ${config.nodeEnv} mode`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
