'use strict';

const express = require('express');
const { query } = require('../db');
const { calculateFeasibilityScore } = require('../scoring');
const fallbackAirstrips = require('../data/airstripsFallback.json');

const router = express.Router();

/**
 * Maps raw database/fallback row into a GeoJSON Feature with feasibility scoring
 * and political influence impact assessment.
 */
function rowToFeature(row) {
  const scoring = calculateFeasibilityScore({
    runway_length_m: row.runway_length_m,
    surface_name: row.surface_name,
    night_landing: row.night_landing,
    fuel_available: row.fuel_available,
    charging_available: row.charging_available,
    nearest_airport_distance_km: row.nearest_airport_distance_km,
    nearest_airport_name: row.nearest_airport_name,
    political_severity: row.political_severity,
    disruption_type: row.disruption_type,
    political_details: row.political_details,
  });

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Number(row.longitude), Number(row.latitude)],
    },
    properties: {
      id: Number(row.id),
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
      political_influence: scoring.political_risk,
      feasibility: scoring,
    },
  };
}

/**
 * GET /api/airstrips
 * Query parameters supported:
 *   - state: filter by state name (case-insensitive)
 *   - surface: filter by surface type (asphalt, concrete, gravel, grass)
 *   - min_score: filter by minimum feasibility score (0-100)
 *   - political_severity: filter by political risk level (none, low, moderate, high)
 *   - search: text search matching airstrip name or nearest airport
 */
router.get('/airstrips', async (req, res, next) => {
  try {
    const { state, surface, min_score, political_severity, search } = req.query;
    let rows = null;

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
          COALESCE(a.political_severity, 'none') AS political_severity,
          COALESCE(a.disruption_type, 'No Disruption') AS disruption_type,
          a.political_details,
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

      const result = await query(sql);
      if (result && result.rows && result.rows.length > 0) {
        rows = result.rows;
      }
    } catch {
      // Database not connected or columns not present; fallback gracefully
    }

    if (!rows || rows.length === 0) {
      rows = fallbackAirstrips;
    }

    let features = rows.map(rowToFeature);

    // Filter by political severity tier if requested
    if (political_severity && political_severity !== 'all') {
      const qSev = political_severity.toLowerCase();
      features = features.filter(
        (f) => f.properties.political_influence?.severity === qSev
      );
    }

    // Filter by State
    if (state && state !== 'all') {
      const qState = state.toLowerCase();
      features = features.filter((f) => f.properties.state && f.properties.state.toLowerCase() === qState);
    }

    // Filter by Surface
    if (surface && surface !== 'all') {
      const qSurf = surface.toLowerCase();
      features = features.filter((f) => f.properties.surface && f.properties.surface.toLowerCase() === qSurf);
    }

    // Filter by minimum score
    if (min_score) {
      const minVal = Number(min_score);
      if (!isNaN(minVal)) {
        features = features.filter((f) => (f.properties.feasibility?.score ?? 0) >= minVal);
      }
    }

    // Text search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      features = features.filter(
        (f) =>
          f.properties.name.toLowerCase().includes(q) ||
          f.properties.state.toLowerCase().includes(q) ||
          (f.properties.nearest_airport?.name && f.properties.nearest_airport.name.toLowerCase().includes(q)) ||
          (f.properties.political_influence?.disruption_type &&
            f.properties.political_influence.disruption_type.toLowerCase().includes(q))
      );
    }

    // Sort features by ranking (feasibility score descending)
    features.sort((a, b) => (b.properties.feasibility?.score ?? 0) - (a.properties.feasibility?.score ?? 0));

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      type: 'FeatureCollection',
      count: features.length,
      features,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/airstrips/:id
 * Retrieve a single airstrip with full spatial metrics & feasibility assessment
 */
router.get('/airstrips/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid airstrip ID' });
    }

    let row = null;
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
          COALESCE(a.political_severity, 'none') AS political_severity,
          COALESCE(a.disruption_type, 'No Disruption') AS disruption_type,
          a.political_details,
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
        WHERE a.id = $1
        LIMIT 1;
      `;
      const result = await query(sql, [id]);
      if (result && result.rows && result.rows.length > 0) {
        row = result.rows[0];
      }
    } catch {
      // Fallback lookup
    }

    if (!row) {
      row = fallbackAirstrips.find((item) => Number(item.id) === id);
    }

    if (!row) {
      return res.status(404).json({ error: `Airstrip #${id} not found` });
    }

    const feature = rowToFeature(row);
    return res.status(200).json(feature);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
