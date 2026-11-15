'use strict';

const config = require('../config/env');
const { query } = require('../../../functions/aerogrid_api/src/db');
const fallbackAirstrips = require('../../../functions/aerogrid_api/src/data/airstripsFallback.json');
const {
  AIRCRAFT_PROFILES,
  ACCESS_POINTS,
  PLACEHOLDER_AIRSTRIP_SOURCE,
} = require('../../../db/seed');
const { toFiniteNumber } = require('../decision/gates');

const ACCESS_POINTS_BY_AIRSTRIP = ACCESS_POINTS.reduce((acc, ap) => {
  if (!acc.has(ap.airstrip)) acc.set(ap.airstrip, []);
  acc.get(ap.airstrip).push({
    access_type: ap.access_type,
    name: ap.name,
    distance_km: ap.distance_km,
    drive_time_mins: ap.drive_time_mins,
    road_condition: ap.road_condition,
  });
  return acc;
}, new Map());

/**
 * Normalizes a database or seed aircraft profile record to numeric JS types.
 *
 * @param {Object} row
 * @param {number} [fallbackId]
 * @returns {Object}
 */
function normalizeAircraftRow(row, fallbackId) {
  const takeoff = toFiniteNumber(row.takeoff_distance_m ?? row.min_runway_m);
  const landing = toFiniteNumber(row.landing_distance_m ?? row.min_runway_m);
  const seatsVal = toFiniteNumber(row.seats ?? row.passengers);
  return {
    id: Number(row.id ?? fallbackId),
    name: row.name,
    category: String(row.category || '').toLowerCase(),
    takeoff_distance_m: takeoff,
    landing_distance_m: landing,
    min_runway_m: toFiniteNumber(row.min_runway_m ?? takeoff),
    mtow_kg: toFiniteNumber(row.mtow_kg),
    payload_kg: toFiniteNumber(row.payload_kg),
    seats: seatsVal !== null ? Math.trunc(seatsVal) : null,
    range_km: toFiniteNumber(row.range_km),
    needs_charging: Boolean(row.needs_charging),
    allowed_surfaces: Array.isArray(row.allowed_surfaces)
      ? row.allowed_surfaces.map((s) => String(s).toLowerCase())
      : [],
    source: row.source || 'PLACEHOLDER - verify against manufacturer data',
    notes: row.notes || null,
  };
}

/**
 * Normalizes an airstrip row from PostGIS or the offline fallback JSON,
 * preserving NULL values on unverified decision fields.
 *
 * @param {Object} row
 * @returns {Object}
 */
function normalizeAirstripRow(row) {
  const fallbackAccessPoints = ACCESS_POINTS_BY_AIRSTRIP.get(row.name) || [];
  const accessPoints = Array.isArray(row.access_points)
    ? row.access_points
    : fallbackAccessPoints;

  return {
    id: Number(row.id),
    name: row.name,
    state_name: row.state_name ?? row.state ?? null,
    ownership_name: row.ownership_name ?? row.ownership ?? null,
    surface_name: row.surface_name ?? row.surface ?? null,
    longitude: toFiniteNumber(row.longitude),
    latitude: toFiniteNumber(row.latitude),
    elevation_m: toFiniteNumber(row.elevation_m),
    runway_length_m: toFiniteNumber(row.runway_length_m),
    runway_width_m: toFiniteNumber(row.runway_width_m),
    night_landing: Boolean(row.night_landing),
    fuel_available: Boolean(row.fuel_available),
    charging_available: Boolean(row.charging_available),
    political_severity: row.political_severity || 'none',
    disruption_type: row.disruption_type || 'No Disruption',
    political_details: row.political_details || null,
    nearest_airport_code: row.nearest_airport_code || null,
    nearest_airport_name: row.nearest_airport_name || null,
    nearest_airport_distance_km: toFiniteNumber(row.nearest_airport_distance_km),
    terrain_risk: row.terrain_risk ?? null,
    catchment_population: toFiniteNumber(row.catchment_population),
    last_mile_access_km: toFiniteNumber(row.last_mile_access_km),
    data_confidence: row.data_confidence ?? 'low',
    source: row.source ?? PLACEHOLDER_AIRSTRIP_SOURCE,
    verified_at: row.verified_at ?? null,
    access_points: accessPoints,
  };
}

const AIRSTRIP_DECISION_SQL = `
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
    a.terrain_risk,
    a.catchment_population,
    a.last_mile_access_km,
    a.data_confidence,
    a.source,
    a.verified_at,
    nearest.code AS nearest_airport_code,
    nearest.name AS nearest_airport_name,
    ROUND((nearest.distance_m / 1000.0)::numeric, 1) AS nearest_airport_distance_km,
    COALESCE(ap_agg.access_points, '[]'::json) AS access_points
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
  LEFT JOIN LATERAL (
    SELECT json_agg(
      json_build_object(
        'access_type', acc.access_type,
        'name', acc.name,
        'distance_km', acc.distance_km,
        'drive_time_mins', acc.drive_time_mins,
        'road_condition', acc.road_condition
      ) ORDER BY acc.distance_km ASC
    ) AS access_points
    FROM airstrip_access_points acc
    WHERE acc.airstrip_id = a.id
  ) ap_agg ON true
`;

/**
 * Lists all aircraft performance profiles from PostgreSQL or the seed fallback.
 *
 * @returns {Promise<Array<Object>>}
 */
async function listAircraftProfiles() {
  if (config.database.isConfigured) {
    try {
      const sql = `
        SELECT id, name, category, takeoff_distance_m, landing_distance_m, min_runway_m,
               mtow_kg, payload_kg, seats, passengers, range_km, needs_charging,
               allowed_surfaces, source, notes
        FROM aircraft_profiles
        ORDER BY id ASC
      `;
      const result = await query(sql);
      if (result && result.rows && result.rows.length > 0) {
        return result.rows.map((row) => normalizeAircraftRow(row));
      }
    } catch {
      // Database unavailable or migration 008 not applied yet; use deterministic seed fallback
    }
  }

  return AIRCRAFT_PROFILES.map((row, idx) => normalizeAircraftRow(row, idx + 1));
}

/**
 * Looks up a single aircraft profile by integer ID.
 *
 * @param {number} aircraftId
 * @returns {Promise<Object|null>}
 */
async function getAircraftProfileById(aircraftId) {
  const id = Number(aircraftId);
  const profiles = await listAircraftProfiles();
  return profiles.find((p) => p.id === id) || null;
}

/**
 * Lists all airstrips with full physical, utility, political, access, and confidence fields.
 *
 * @returns {Promise<Array<Object>>}
 */
async function listAirstripsForDecision() {
  if (config.database.isConfigured) {
    try {
      const result = await query(`${AIRSTRIP_DECISION_SQL} ORDER BY a.id ASC`);
      if (result && result.rows && result.rows.length > 0) {
        return result.rows.map(normalizeAirstripRow);
      }
    } catch {
      // Database unavailable or migration 008 not applied yet; use fallback JSON
    }
  }

  return fallbackAirstrips.map(normalizeAirstripRow);
}

/**
 * Retrieves a single airstrip record for decision evaluation by ID.
 *
 * @param {number} airstripId
 * @returns {Promise<Object|null>}
 */
async function getAirstripForDecisionById(airstripId) {
  const id = Number(airstripId);
  if (config.database.isConfigured) {
    try {
      const result = await query(`${AIRSTRIP_DECISION_SQL} WHERE a.id = $1 LIMIT 1`, [id]);
      if (result && result.rows && result.rows.length > 0) {
        return normalizeAirstripRow(result.rows[0]);
      }
    } catch {
      // Fallback lookup below
    }
  }

  const found = fallbackAirstrips.find((s) => Number(s.id) === id);
  return found ? normalizeAirstripRow(found) : null;
}

/**
 * Retrieves multiple airstrips by ID for comparison, reporting any missing IDs.
 *
 * @param {number[]} airstripIds
 * @returns {Promise<{ airstrips: Array<Object>, missingIds: number[] }>}
 */
async function getAirstripsForDecisionByIds(airstripIds) {
  const all = await listAirstripsForDecision();
  const byId = new Map(all.map((s) => [s.id, s]));
  const airstrips = [];
  const missingIds = [];

  for (const id of airstripIds) {
    const strip = byId.get(Number(id));
    if (strip) {
      airstrips.push(strip);
    } else {
      missingIds.push(Number(id));
    }
  }

  return { airstrips, missingIds };
}

module.exports = {
  normalizeAircraftRow,
  normalizeAirstripRow,
  listAircraftProfiles,
  getAircraftProfileById,
  listAirstripsForDecision,
  getAirstripForDecisionById,
  getAirstripsForDecisionByIds,
};
