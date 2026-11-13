'use strict';

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
app.use('/api', airstripsRoutes);
app.use('/api', geoRoutes);
app.use('/api', assetRoutes);
app.use('/api', spatialRoutes);

// Direct root fallbacks for Catalyst serverless routing
app.use(airstripsRoutes);
app.use(geoRoutes);
app.use(assetRoutes);
app.use(spatialRoutes);

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
    error: status === 500 ? 'Internal Server Error' : err.message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

// For local testing
if (require.main === module) {
  const port = config.port;
  app.listen(port, () => {
    console.log(`[AeroGrid Server]: Listening on http://localhost:${port} in ${config.nodeEnv} mode`);
  });
}

module.exports = app;
