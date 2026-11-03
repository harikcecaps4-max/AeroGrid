'use strict';

const express = require('express');
const { query } = require('../db');
const fallbackGeo = require('../data/indiaGeo.json');

const router = express.Router();

/**
 * GET /api/states
 * Returns all 28 states and 8 union territories with capitals and summary count of cities.
 */
router.get('/states', async (req, res, next) => {
  try {
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

    if (result && result.rows && result.rows.length > 0) {
      return res.status(200).json({
        total: result.rows.length,
        states: result.rows,
      });
    }

    // Fallback using bundled geo dataset
    const formatted = fallbackGeo.map((s, idx) => ({
      id: idx + 1,
      name: s.name,
      type: s.type,
      capital: s.capital,
      capital_coords: s.capital_coords,
      city_count: s.cities.length,
    }));

    return res.status(200).json({
      total: formatted.length,
      states: formatted,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cities?state=StateName
 * Returns cities for a given state or all cities across India
 */
router.get('/cities', async (req, res, next) => {
  try {
    const { state } = req.query;

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
      if (state) {
        sql += ` WHERE LOWER(s.name) = LOWER($1)`;
        params.push(state);
      }
      sql += ` ORDER BY s.name ASC, c.is_capital DESC, c.name ASC;`;

      result = await query(sql, params);
    } catch {
      // Database might not have cities table yet
    }

    if (result && result.rows && result.rows.length > 0) {
      return res.status(200).json({
        count: result.rows.length,
        cities: result.rows,
      });
    }

    // Fallback using bundled geo dataset
    let list = [];
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

    return res.status(200).json({
      count: list.length,
      cities: list,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

