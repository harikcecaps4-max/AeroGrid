'use strict';

const express = require('express');
const cors = require('cors');

const healthRoutes = require('./src/routes/health');
const airstripsRoutes = require('./src/routes/airstrips');
const geoRoutes = require('./src/routes/geo');

const app = express();

app.use(cors());
app.use(express.json());

// Structured JSON request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
    };
    console.log(JSON.stringify(logEntry));
  });
  next();
});

// Route registration
app.use(healthRoutes);
app.use('/api', airstripsRoutes);
app.use('/api', geoRoutes);
app.use(airstripsRoutes); // Direct access fallback
app.use(geoRoutes);

// Central 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl || req.url,
  });
});

// Central error-handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('Unhandled server error:', {
    message: err.message,
    path: req.originalUrl || req.url,
    method: req.method,
  });

  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
});

// For local testing outside of Catalyst runtime
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`AeroGrid API server listening on http://localhost:${port}`);
  });
}

module.exports = app;