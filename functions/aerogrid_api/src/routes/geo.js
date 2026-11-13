'use strict';

const express = require('express');
const { query } = require('../db');
const fallbackGeo = require('../data/indiaGeo.json');

const router = express.Router();

/**
 * GET /api/states
 * Returns all 28 states and 8 union territories with capitals, city counts, and coordinates.
 */
router.get('/states', async (req, res, next) => {
  try {
    const { type } = req.query; // 'State' or 'Union Territory'
    let result = null;

    try {
      result = await query(`
        SELECT 
          s.id,
          s.name,
          COALESCE(s.type, 'State') as type,
          s.capital,
          COUNT(c.id)::int as city_count
        FROM states s
        LEFT JOIN cities c ON s.id = c.state_id
        GROUP BY s.id, s.name, s.type, s.capital
        ORDER BY s.type ASC, s.name ASC;
      `);
    } catch {
      // Database table might not have 003 migration applied yet
    }

    let statesList = [];

    if (result && result.rows && result.rows.length > 0) {
      statesList = result.rows;
    } else {
      // High-precision bundled fallback dataset
      statesList = fallbackGeo.map((s, idx) => ({
        id: idx + 1,
        name: s.name,
        type: s.type,
        capital: s.capital,
        capital_coords: s.capital_coords,
        city_count: s.cities ? s.cities.length : 0,
      }));
    }

    if (type && type !== 'all') {
      const qType = type.toLowerCase();
      statesList = statesList.filter((s) => s.type && s.type.toLowerCase() === qType);
    }

    return res.status(200).json({
      total: statesList.length,
      states: statesList,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cities
 * Query parameters supported:
 *   - state: filter by state name (case-insensitive)
 *   - is_capital: boolean (true/false)
 *   - search: text search by city name
 */
router.get('/cities', async (req, res, next) => {
  try {
    const { state, is_capital, search } = req.query;
    let list = [];

    let result = null;
    try {
      let sql = `
        SELECT 
          c.id,
          c.name,
          c.is_capital,
          s.name as state_name,
          s.type as state_type,
          ST_X(c.location) as longitude,
          ST_Y(c.location) as latitude
        FROM cities c
        JOIN states s ON c.state_id = s.id
      `;
      const params = [];
      const whereClauses = [];

      if (state) {
        params.push(state);
        whereClauses.push(`LOWER(s.name) = LOWER($${params.length})`);
      }

      if (is_capital !== undefined) {
        const isCap = is_capital === 'true' || is_capital === '1';
        params.push(isCap);
        whereClauses.push(`c.is_capital = $${params.length}`);
      }

      if (whereClauses.length > 0) {
        sql += ` WHERE ` + whereClauses.join(' AND ');
      }

      sql += ` ORDER BY s.name ASC, c.is_capital DESC, c.name ASC;`;

      result = await query(sql, params);
    } catch {
      // Database not connected; fallback gracefully
    }

    if (result && result.rows && result.rows.length > 0) {
      list = result.rows;
    } else {
      // Extract from bundled high-precision dataset
      fallbackGeo.forEach((s) => {
        if (!state || s.name.toLowerCase() === state.toLowerCase()) {
          s.cities.forEach((c) => {
            list.push({
              name: c.name,
              is_capital: Boolean(c.is_capital),
              state_name: s.name,
              state_type: s.type,
              longitude: c.coords[0],
              latitude: c.coords[1],
            });
          });
        }
      });
    }

    if (is_capital !== undefined && (!result || !result.rows)) {
      const isCap = is_capital === 'true' || is_capital === '1';
      list = list.filter((c) => Boolean(c.is_capital) === isCap);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.state_name.toLowerCase().includes(q));
    }

    return res.status(200).json({
      count: list.length,
      cities: list,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
