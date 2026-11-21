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

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./src/config/env');
const healthRoutes = require('../functions/aerogrid_api/src/routes/health');
const airstripsRoutes = require('../functions/aerogrid_api/src/routes/airstrips');
const geoRoutes = require('../functions/aerogrid_api/src/routes/geo');
const authRoutes = require('./src/routes/authRoutes');
const assetRoutes = require('./src/routes/assetRoutes');
const spatialRoutes = require('./src/routes/spatialRoutes');
const decisionRoutes = require('./src/routes/decisionRoutes');

const app = express();

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Leaflet tiles from ArcGIS / OSM / Carto
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS Allowlist
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || config.security.corsOrigins.includes(origin) || config.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin '${origin}' not allowed by AeroGrid security policy.`));
      }
    },
    credentials: true,
  })
);

// 3. Body Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Rate Limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please wait before making further requests.',
  },
});
app.use('/api', limiter);

// 5. Structured JSON Request Logger with Request ID tracking
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 10);
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
    };
    if (res.statusCode >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });
  next();
});

// 6. Mount REST Routes
app.use(healthRoutes);
app.use('/api', authRoutes);
app.use('/api', decisionRoutes);
app.use('/api', spatialRoutes);
app.use('/api', airstripsRoutes);
app.use('/api', geoRoutes);
app.use('/api', assetRoutes);

// Direct root fallbacks for Catalyst serverless routing
app.use(authRoutes);
app.use(decisionRoutes);
app.use(spatialRoutes);
app.use(airstripsRoutes);
app.use(geoRoutes);
app.use(assetRoutes);

// 7. Central 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint Not Found',
    path: req.originalUrl || req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// 8. Central Error-Handling Middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('Unhandled Server Error:', {
    requestId: req.id,
    message: err.message,
    path: req.originalUrl || req.url,
    method: req.method,
  });

  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (err.error || err.message),
    message: err.message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

// Start HTTP server when executed directly (kept lazy when required by tests or Catalyst)
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
