'use strict';

const express = require('express');
const { z } = require('zod');
const { query } = require('../../../functions/aerogrid_api/src/db');
const { validateRequest } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const router = express.Router();

// Fallback in-memory assets store
let inMemoryAssets = [
  {
    id: 1,
    airstrip_id: 1,
    name: 'Flight Training Hangar A',
    asset_type: 'hangar',
    status: 'operational',
    condition_grade: 'good',
    quantity: 2,
    capacity_spec: 'Accommodates up to 6 light aircraft',
    notes: 'Active maintenance hangar with 3-phase power',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    airstrip_id: 1,
    name: '100LL Avgas Fuel Depot',
    asset_type: 'fuel_point',
    status: 'operational',
    condition_grade: 'excellent',
    quantity: 1,
    capacity_spec: '5000 Liters Capacity',
    notes: 'Regularly certified underground storage tank',
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    airstrip_id: 1,
    name: 'Runway Boundary Solar Lighting',
    asset_type: 'lighting',
    status: 'operational',
    condition_grade: 'good',
    quantity: 1,
    capacity_spec: 'LED edge lights',
    notes: 'Visual approach illumination',
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    airstrip_id: 2,
    name: 'Dual 350kW DC Fast Vertiport Charger',
    asset_type: 'charging_station',
    status: 'operational',
    condition_grade: 'excellent',
    quantity: 2,
    capacity_spec: '700 kW Combined Capacity',
    notes: 'CCS2 compliant eVTOL fast charger pad',
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    airstrip_id: 3,
    name: 'Industrial Prototype Hangar',
    asset_type: 'hangar',
    status: 'operational',
    condition_grade: 'good',
    quantity: 1,
    capacity_spec: 'Spans 1200 sq meters',
    notes: 'Supports cargo payload integration',
    created_at: new Date().toISOString(),
  },
];

const assetCreateSchema = z.object({
  name: z.string().min(2, 'Asset name is required'),
  asset_type: z.enum([
    'hangar',
    'fuel_point',
    'charging_station',
    'lighting',
    'terminal',
    'ground_vehicle',
    'weather_station',
    'security_fence',
  ]),
  status: z.enum(['operational', 'maintenance_required', 'under_repair', 'decommissioned', 'planned']).default('operational'),
  condition_grade: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']).default('good'),
  quantity: z.number().int().positive().default(1),
  capacity_spec: z.string().optional(),
  notes: z.string().optional(),
});

const assetUpdateSchema = assetCreateSchema.partial();

/**
 * GET /api/airstrips/:airstripId/assets
 * Lists all assets linked to an airstrip
 */
router.get('/airstrips/:airstripId/assets', async (req, res, next) => {
  try {
    const airstripId = parseInt(req.params.airstripId, 10);
    if (isNaN(airstripId)) {
      return res.status(400).json({ error: 'Invalid airstrip ID' });
    }

    let rows = null;
    try {
      const sql = `
        SELECT id, airstrip_id, name, asset_type, status, condition_grade, quantity, capacity_spec, notes, created_at, updated_at
        FROM assets
        WHERE airstrip_id = $1
        ORDER BY created_at ASC;
      `;
      const result = await query(sql, [airstripId]);
      if (result && result.rows) {
        rows = result.rows;
      }
    } catch {
      // In-memory fallback
    }

    if (!rows) {
      rows = inMemoryAssets.filter((a) => a.airstrip_id === airstripId);
    }

    return res.status(200).json({
      airstrip_id: airstripId,
      count: rows.length,
      assets: rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/airstrips/:airstripId/assets
 * Add a new asset to an airstrip (Requires 'analyst' or 'admin' role)
 */
router.post(
  '/airstrips/:airstripId/assets',
  authenticateToken,
  requireRole('analyst'),
  validateRequest({ body: assetCreateSchema }),
  async (req, res, next) => {
    try {
      const airstripId = parseInt(req.params.airstripId, 10);
      const data = req.body;

      let createdAsset = null;
      try {
        const sql = `
          INSERT INTO assets (airstrip_id, name, asset_type, status, condition_grade, quantity, capacity_spec, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *;
        `;
        const result = await query(sql, [
          airstripId,
          data.name,
          data.asset_type,
          data.status,
          data.condition_grade,
          data.quantity,
          data.capacity_spec || null,
          data.notes || null,
        ]);
        if (result && result.rows && result.rows.length > 0) {
          createdAsset = result.rows[0];
        }
      } catch {
        // In-memory fallback
      }

      if (!createdAsset) {
        createdAsset = {
          id: inMemoryAssets.length + 1,
          airstrip_id: airstripId,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryAssets.push(createdAsset);
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'ASSET_CHANGE',
        entityType: 'ASSET',
        entityId: createdAsset.id,
        changes: { created: createdAsset },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        message: 'Asset recorded successfully',
        asset: createdAsset,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/assets/:id/status
 * Update asset operational status or retire it (Requires 'analyst' or 'admin')
 */
router.patch(
  '/assets/:id/status',
  authenticateToken,
  requireRole('analyst'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status, condition_grade, notes } = req.body;

      if (!status && !condition_grade && !notes) {
        return res.status(400).json({ error: 'At least one field (status, condition_grade, notes) required.' });
      }

      let updated = null;
      try {
        const sql = `
          UPDATE assets
          SET status = COALESCE($1, status),
              condition_grade = COALESCE($2, condition_grade),
              notes = COALESCE($3, notes),
              updated_at = now()
          WHERE id = $4
          RETURNING *;
        `;
        const result = await query(sql, [status, condition_grade, notes, id]);
        if (result && result.rows && result.rows.length > 0) {
          updated = result.rows[0];
        }
      } catch {
        // In-memory fallback
      }

      if (!updated) {
        const item = inMemoryAssets.find((a) => a.id === id);
        if (item) {
          if (status) item.status = status;
          if (condition_grade) item.condition_grade = condition_grade;
          if (notes) item.notes = notes;
          item.updated_at = new Date().toISOString();
          updated = item;
        }
      }

      if (!updated) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      return res.status(200).json({
        message: 'Asset status updated successfully',
        asset: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

