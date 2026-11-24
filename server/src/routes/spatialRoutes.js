'use strict';

const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const config = require('../config/env');
const fallbackAirstrips = require('../data/airstripsFallback.json');
const { calculateHaversineKm } = require('../utils/geo');
const { validateRequest } = require('../middleware/validate');
const { CAVEAT_TEXT } = require('../decision/config');

const router = express.Router();

function createSpatialDbError(requestId, context, err) {
  console.error('[AeroGrid Spatial Route DB Error]:', {
    requestId: requestId || null,
    context,
    message: err ? err.message : 'Database is not configured and ALLOW_FALLBACK is false.',
  });
  const serviceErr = new Error(
    err
      ? 'Database query failed while executing spatial radius search.'
      : 'Database is not configured and fallback mode is disabled.'
  );
  serviceErr.status = 503;
  serviceErr.error = 'Service Unavailable';
  if (err) serviceErr.cause = err;
  return serviceErr;
}

const requiredCoord = (name, min, max) =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '' || typeof val === 'boolean') {
        return NaN;
      }
      return Number(val);
    },
    z
      .number({ message: `Query parameter '${name}' must be a valid number.` })
      .min(min, `'${name}' must be at least ${min}.`)
      .max(max, `'${name}' must be at most ${max}.`)
  );

const optionalRadiusKm = z.preprocess(
  (val) => {
    if (val === undefined || val === '') return 150;
    if (val === null || typeof val === 'boolean') return NaN;
    return Number(val);
  },
  z
    .number({ message: `Query parameter 'radius_km' must be a valid number.` })
    .positive(`'radius_km' must be positive.`)
    .max(1000, `'radius_km' cannot exceed 1000 km.`)
);

const radiusQuerySchema = z.object({
  lat: requiredCoord('lat', -90, 90),
  lng: requiredCoord('lng', -180, 180),
  radius_km: optionalRadiusKm,
});

/**
 * GET /api/airstrips/radius
 * Spatial query returning airstrips within a given radius in kilometers from a center point.
 * Query Parameters:
 *   - lat: latitude (-90..90, required)
 *   - lng: longitude (-180..180, required)
 *   - radius_km: radius in kilometers (positive, max 1000, default: 150 km)
 */
router.get(
  '/airstrips/radius',
  validateRequest({ query: radiusQuerySchema }),
  async (req, res, next) => {
    try {
      const { lat, lng, radius_km: radiusKm } = req.validatedQuery;

      let results = [];
      let dataSource = null;

      if (config.database.isConfigured) {
        try {
          const radiusMeters = radiusKm * 1000;
          const sql = `
            SELECT 
              a.id,
              a.name,
              s.name AS state_name,
              f.name AS surface_name,
              ST_X(a.location) AS longitude,
              ST_Y(a.location) AS latitude,
              a.runway_length_m,
              ROUND((ST_Distance(a.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000.0)::numeric, 1) AS distance_km
            FROM airstrips a
            LEFT JOIN states s ON a.state_id = s.id
            LEFT JOIN surface_types f ON a.surface_id = f.id
            WHERE a.data_status <> 'archived'
              AND ST_DWithin(a.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            ORDER BY distance_km ASC;
          `;
          const dbResult = await query(sql, [lng, lat, radiusMeters]);
          results = (dbResult && dbResult.rows) || [];
          dataSource = 'database';
        } catch (err) {
          return next(createSpatialDbError(req.id, 'GET /airstrips/radius', err));
        }
      } else if (config.allowFallback) {
        results = fallbackAirstrips
          .map((strip) => {
            const dist = calculateHaversineKm(lat, lng, strip.latitude, strip.longitude);
            return {
              id: strip.id,
              name: strip.name,
              state_name: strip.state_name,
              surface_name: strip.surface_name,
              longitude: strip.longitude,
              latitude: strip.latitude,
              runway_length_m: strip.runway_length_m,
              distance_km: dist,
            };
          })
          .filter((strip) => strip.distance_km <= radiusKm)
          .sort((a, b) => a.distance_km - b.distance_km);
        dataSource = 'fallback';
      } else {
        return next(createSpatialDbError(req.id, 'GET /airstrips/radius (fallback disabled)'));
      }

      return res.status(200).json({
        center: { latitude: lat, longitude: lng },
        radius_km: radiusKm,
        count: results.length,
        airstrips: results,
        data_source: dataSource,
        caveat: CAVEAT_TEXT,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;


