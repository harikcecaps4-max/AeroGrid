'use strict';

const express = require('express');
const { query } = require('../../../functions/aerogrid_api/src/db');
const fallbackAirstrips = require('../../../functions/aerogrid_api/src/data/airstripsFallback.json');

const router = express.Router();

/**
 * Calculates Great-Circle distance in kilometers between two lat/lng pairs (Haversine)
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * GET /api/airstrips/radius
 * Spatial query returning airstrips within a given radius in kilometers from a center point.
 * Query Parameters:
 *   - lat: latitude (required)
 *   - lng: longitude (required)
 *   - radius_km: radius in kilometers (default: 150 km)
 */
router.get('/airstrips/radius', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius_km || '150');

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid `lat` and `lng` query parameters are required.',
      });
    }

    let results = [];

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
        WHERE ST_DWithin(a.location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY distance_km ASC;
      `;
      const dbResult = await query(sql, [lng, lat, radiusMeters]);
      if (dbResult && dbResult.rows) {
        results = dbResult.rows;
      }
    } catch {
      // Memory spatial radius calculation
    }

    if (results.length === 0) {
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
    }

    return res.status(200).json({
      center: { latitude: lat, longitude: lng },
      radius_km: radiusKm,
      count: results.length,
      airstrips: results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

