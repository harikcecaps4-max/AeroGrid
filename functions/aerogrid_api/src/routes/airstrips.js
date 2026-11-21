'use strict';

const express = require('express');
const { query } = require('../db');
const config = require('../../../../server/src/config/env');
const { calculateFeasibilityScore } = require('../scoring');
const fallbackAirstrips = require('../data/airstripsFallback.json');
const {
  CAVEAT_TEXT,
  evaluateAirstrip,
  getAircraftProfileById,
  normalizeAirstripRow,
  AIRSTRIP_DECISION_SQL,
} = require('../decision');

const router = express.Router();

function createAirstripsDbError(requestId, context, err) {
  console.error('[AeroGrid Airstrips Route DB Error]:', {
    requestId: requestId || null,
    context,
    message: err ? err.message : 'Database is not configured and ALLOW_FALLBACK is false.',
  });
  const serviceErr = new Error(
    err
      ? 'Database query failed while loading airstrips.'
      : 'Database is not configured and fallback mode is disabled.'
  );
  serviceErr.status = 503;
  serviceErr.error = 'Service Unavailable';
  if (err) serviceErr.cause = err;
  return serviceErr;
}

/**
 * Validates and loads an optional `?aircraft_id=<id>` query parameter so callers
 * can request per-airstrip decision verdicts directly on GeoJSON feature endpoints.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<{ aircraft: Object|null, handled: boolean }>}
 */
async function resolveOptionalAircraftQuery(req, res) {
  const rawAircraftId = req.query.aircraft_id;
  if (rawAircraftId === undefined || rawAircraftId === '') {
    return { aircraft: null, handled: false };
  }

  const trimmed = String(rawAircraftId).trim();
  const parsed = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isInteger(parsed) || parsed <= 0) {
    res.status(400).json({
      error: 'Invalid aircraft_id query parameter',
      caveat: CAVEAT_TEXT,
    });
    return { aircraft: null, handled: true };
  }

  const { aircraft, source } = await getAircraftProfileById(parsed, { requestId: req.id });
  if (!aircraft) {
    res.status(404).json({
      error: `Aircraft profile #${parsed} not found`,
      data_source: source,
      caveat: CAVEAT_TEXT,
    });
    return { aircraft: null, handled: true };
  }

  return { aircraft, handled: false };
}

/**
 * Attaches shared decision-engine evaluation to a GeoJSON feature when an aircraft is selected.
 *
 * @param {Object} feature
 * @param {Object} rawRow
 * @param {Object|null} aircraft
 * @returns {Object}
 */
function attachOptionalDecision(feature, rawRow, aircraft) {
  if (!aircraft) return feature;
  return {
    ...feature,
    properties: {
      ...feature.properties,
      decision: evaluateAirstrip(aircraft, normalizeAirstripRow(rawRow)),
    },
  };
}

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
      access_points: Array.isArray(row.access_points) ? row.access_points : [],
      data_status: row.data_status ?? null,
      data_confidence: row.data_confidence ?? null,
      source: row.source ?? null,
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
    const { aircraft, handled } = await resolveOptionalAircraftQuery(req, res);
    if (handled) return;

    const { state, surface, min_score, political_severity, search } = req.query;
    let rows = null;
    let dataSource = null;

    if (config.database.isConfigured) {
      try {
        // Shared live-schema query (primary runway, capabilities view, data_status confidence)
        const sql = `${AIRSTRIP_DECISION_SQL} ORDER BY a.name ASC`;

        const result = await query(sql);
        rows = (result && result.rows) || [];
        dataSource = 'database';
      } catch (err) {
        return next(createAirstripsDbError(req.id, 'GET /airstrips', err));
      }
    } else if (config.allowFallback) {
      rows = fallbackAirstrips;
      dataSource = 'fallback';
    } else {
      return next(createAirstripsDbError(req.id, 'GET /airstrips (fallback disabled)'));
    }

    let features = rows.map((row) =>
      attachOptionalDecision(rowToFeature(row), row, aircraft),
    );

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
      data_source: dataSource,
      caveat: CAVEAT_TEXT,
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
      return res.status(400).json({
        error: 'Invalid airstrip ID',
        caveat: CAVEAT_TEXT,
      });
    }

    const { aircraft, handled } = await resolveOptionalAircraftQuery(req, res);
    if (handled) return;

    let row = null;
    let dataSource = null;

    if (config.database.isConfigured) {
      try {
        // Shared live-schema query (primary runway, capabilities view, data_status confidence)
        const sql = `${AIRSTRIP_DECISION_SQL} WHERE a.id = $1 LIMIT 1`;
        const result = await query(sql, [id]);
        if (result && result.rows && result.rows.length > 0) {
          row = result.rows[0];
        }
        dataSource = 'database';
      } catch (err) {
        return next(createAirstripsDbError(req.id, 'GET /airstrips/:id', err));
      }
    } else if (config.allowFallback) {
      row = fallbackAirstrips.find((item) => Number(item.id) === id) || null;
      dataSource = 'fallback';
    } else {
      return next(createAirstripsDbError(req.id, 'GET /airstrips/:id (fallback disabled)'));
    }

    if (!row) {
      return res.status(404).json({
        error: `Airstrip #${id} not found`,
        data_source: dataSource,
        caveat: CAVEAT_TEXT,
      });
    }

    const feature = attachOptionalDecision(rowToFeature(row), row, aircraft);
    return res.status(200).json({
      ...feature,
      data_source: dataSource,
      caveat: CAVEAT_TEXT,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
