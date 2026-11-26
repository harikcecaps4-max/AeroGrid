'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./src/config/env');
const healthRoutes = require('./src/routes/health');
const airstripsRoutes = require('./src/routes/airstrips');
const geoRoutes = require('./src/routes/geo');
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

// 2. CORS Allowlist (CORS_ORIGIN + CORS_ORIGINS)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.security.corsOrigins.includes(origin) || config.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin '${origin}' not allowed by AeroGrid security policy.`));
      }
    },
    credentials: true,
  })
);

// 3. Body Parsing (supports application/json and preflight-free text/plain JSON)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ type: 'text/plain', limit: '1mb' }));

// Strip access_token from URLs before logging or echoing in errors
function redactPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  return rawUrl.replace(/([?&])access_token=[^&]*/gi, '$1access_token=[REDACTED]');
}

// Parse text/plain JSON bodies and map _token / ?access_token= to Authorization header
app.use((req, res, next) => {
  if (typeof req.body === 'string' && req.is('text/plain')) {
    const trimmed = req.body.trim();
    if (!trimmed) {
      req.body = {};
    } else {
      try {
        req.body = JSON.parse(trimmed);
      } catch {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid JSON payload in text/plain request body.',
        });
      }
    }
  }

  let compatToken = null;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && '_token' in req.body) {
    if (typeof req.body._token === 'string' && req.body._token.trim()) {
      compatToken = req.body._token.trim();
    }
    delete req.body._token;
  }

  if (!compatToken && req.query && typeof req.query.access_token === 'string' && req.query.access_token.trim()) {
    compatToken = req.query.access_token.trim();
  }

  if (compatToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${compatToken}`;
  }

  return next();
});

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
      path: redactPath(req.originalUrl || req.url),
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
    path: redactPath(req.originalUrl || req.url),
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
    path: redactPath(req.originalUrl || req.url),
    method: req.method,
  });

  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : (err.error || err.message),
    message: err.message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
