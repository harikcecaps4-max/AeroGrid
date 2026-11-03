'use strict';

const express = require('express');
const { query } = require('../db');
const { calculateFeasibilityScore } = require('../scoring');

const router = express.Router();

router.get('/airstrips', async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        a.id,
        a.name,
        s.name AS state_name,
        o.name AS ownership_name,
        f.name AS surface_name,
        ST_X(a.location) AS longitude,
        ST_Y(a.location) AS latitude,
        a.elevation_m,
        a.runway_length_m,
        a.runway_width_m,
        a.night_landing,
        a.fuel_available,
        a.charging_available,
        nearest.code AS nearest_airport_code,
        nearest.name AS nearest_airport_name,
        ROUND((nearest.distance_m / 1000.0)::numeric, 1) AS nearest_airport_distance_km
      FROM airstrips a
      LEFT JOIN states s ON a.state_id = s.id
      LEFT JOIN ownership_types o ON a.ownership_id = o.id
      LEFT JOIN surface_types f ON a.surface_id = f.id
      LEFT JOIN LATERAL (
        SELECT 
          ap.code,
          ap.name,
          ST_Distance(a.location::geography, ap.location::geography) AS distance_m
        FROM airports ap
        ORDER BY a.location <-> ap.location
        LIMIT 1
      ) nearest ON true
      ORDER BY a.name ASC;
    `;

    const { rows } = await query(sql);

    const features = rows.map((row) => {
      const scoring = calculateFeasibilityScore({
        runway_length_m: row.runway_length_m,
        surface_name: row.surface_name,
        night_landing: row.night_landing,
        fuel_available: row.fuel_available,
        charging_available: row.charging_available,
        nearest_airport_distance_km: row.nearest_airport_distance_km,
        nearest_airport_name: row.nearest_airport_name,
      });

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(row.longitude), Number(row.latitude)],
        },
        properties: {
          id: row.id,
          name: row.name,
          state: row.state_name,
          ownership: row.ownership_name,
          surface: row.surface_name,
          elevation_m: Number(row.elevation_m),
          runway_length_m: Number(row.runway_length_m),
          runway_width_m: Number(row.runway_width_m),
          night_landing: Boolean(row.night_landing),
          fuel_available: Boolean(row.fuel_available),
          charging_available: Boolean(row.charging_available),
          nearest_airport: {
            code: row.nearest_airport_code,
            name: row.nearest_airport_name,
            distance_km: Number(row.nearest_airport_distance_km),
          },
          feasibility: scoring,
        },
      };
    });

    const geoJson = {
      type: 'FeatureCollection',
      count: features.length,
      features,
    };

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(geoJson);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
