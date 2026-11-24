'use strict';

const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const config = require('../config/env');
const fallbackAirstrips = require('../data/airstripsFallback.json');
const { validateRequest } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const router = express.Router();

function createAssetDbError(requestId, context, err) {
  console.error('[AeroGrid Asset Route DB Error]:', {
    requestId: requestId || null,
    context,
    message: err ? err.message : 'Database is not configured and ALLOW_FALLBACK is false.',
  });
  const serviceErr = new Error(
    err
      ? 'Database query failed while processing asset request.'
      : 'Database is not configured and fallback mode is disabled.'
  );
  serviceErr.status = 503;
  serviceErr.error = 'Service Unavailable';
  if (err) serviceErr.cause = err;
  return serviceErr;
}

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

const ASSET_STATUS_ENUM = [
  'operational',
  'maintenance_required',
  'under_repair',
  'decommissioned',
  'planned',
];

const CONDITION_GRADE_ENUM = ['excellent', 'good', 'fair', 'poor', 'critical'];

const positiveIntParam = (fieldName) =>
  z.preprocess(
    (val) => (typeof val === 'string' && /^\d+$/.test(val.trim()) ? Number(val.trim()) : val),
    z.number({ message: `Invalid ${fieldName}` }).int().positive(`Invalid ${fieldName}`)
  );

const airstripIdParamSchema = z.object({
  airstripId: positiveIntParam('airstrip ID'),
});

const assetIdParamSchema = z.object({
  id: positiveIntParam('asset ID'),
});

const assetCreateSchema = z.object({
  name: z.string().trim().min(2, 'Asset name is required'),
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
  status: z.enum(ASSET_STATUS_ENUM).default('operational'),
  condition_grade: z.enum(CONDITION_GRADE_ENUM).default('good'),
  quantity: z.number().int().positive().default(1),
  capacity_spec: z.string().max(255, 'capacity_spec cannot exceed 255 characters').optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

const assetStatusPatchSchema = z
  .object({
    status: z.enum(ASSET_STATUS_ENUM).optional(),
    condition_grade: z.enum(CONDITION_GRADE_ENUM).optional(),
    notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.condition_grade !== undefined ||
      data.notes !== undefined,
    {
      message: 'At least one field (status, condition_grade, notes) is required.',
    }
  );

/**
 * GET /api/airstrips/:airstripId/assets
 * Lists all assets linked to an airstrip
 */
router.get(
  '/airstrips/:airstripId/assets',
  authenticateToken,
  requireRole('viewer'),
  validateRequest({ params: airstripIdParamSchema }),
  async (req, res, next) => {
    try {
      const airstripId = Number(req.params.airstripId);

      let rows = null;
      let dataSource = null;

      if (config.database.isConfigured) {
        try {
          const sql = `
            SELECT id, airstrip_id, name, asset_type, status, condition_grade, quantity, capacity_spec, notes,
                   installed_on, last_inspected_on, next_inspection_due, created_at, updated_at
            FROM assets
            WHERE airstrip_id = $1
            ORDER BY created_at ASC;
          `;
          const result = await query(sql, [airstripId]);
          rows = (result && result.rows) || [];
          dataSource = 'database';
        } catch (err) {
          return next(createAssetDbError(req.id, 'GET /airstrips/:airstripId/assets', err));
        }
      } else if (config.allowFallback) {
        rows = inMemoryAssets.filter((a) => a.airstrip_id === airstripId);
        dataSource = 'fallback';
      } else {
        return next(createAssetDbError(req.id, 'GET /airstrips/:airstripId/assets (fallback disabled)'));
      }

      return res.status(200).json({
        airstrip_id: airstripId,
        count: rows.length,
        assets: rows,
        data_source: dataSource,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/airstrips/:airstripId/assets
 * Add a new asset to an airstrip (Requires 'analyst' or 'admin' role)
 */
router.post(
  '/airstrips/:airstripId/assets',
  authenticateToken,
  requireRole('analyst'),
  validateRequest({ params: airstripIdParamSchema, body: assetCreateSchema }),
  async (req, res, next) => {
    try {
      const airstripId = Number(req.params.airstripId);
      const data = req.body;

      let createdAsset = null;
      let dataSource = null;

      if (config.database.isConfigured) {
        try {
          const stripCheck = await query("SELECT id FROM airstrips WHERE id = $1 AND data_status <> 'archived' LIMIT 1", [airstripId]);
          if (!stripCheck || !stripCheck.rows || stripCheck.rows.length === 0) {
            return res.status(404).json({
              error: 'Not Found',
              message: `Airstrip #${airstripId} not found.`,
              data_source: 'database',
            });
          }

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
            dataSource = 'database';
          }
        } catch (err) {
          return next(createAssetDbError(req.id, 'POST /airstrips/:airstripId/assets', err));
        }

        if (!createdAsset) {
          return next(
            createAssetDbError(
              req.id,
              'POST /airstrips/:airstripId/assets',
              new Error('Asset insert returned no persisted row.')
            )
          );
        }
      } else if (config.allowFallback) {
        const stripExists = fallbackAirstrips.some((s) => Number(s.id) === airstripId);
        if (!stripExists) {
          return res.status(404).json({
            error: 'Not Found',
            message: `Airstrip #${airstripId} not found.`,
            data_source: 'fallback',
          });
        }

        const maxId = inMemoryAssets.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0);
        createdAsset = {
          id: maxId + 1,
          airstrip_id: airstripId,
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryAssets.push(createdAsset);
        dataSource = 'fallback';
      } else {
        return next(createAssetDbError(req.id, 'POST /airstrips/:airstripId/assets (fallback disabled)'));
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
        data_source: dataSource,
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
  validateRequest({ params: assetIdParamSchema, body: assetStatusPatchSchema }),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { status, condition_grade, notes } = req.body;

      let updated = null;
      let dataSource = null;

      if (config.database.isConfigured) {
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
          const result = await query(sql, [status ?? null, condition_grade ?? null, notes ?? null, id]);
          if (result && result.rows && result.rows.length > 0) {
            updated = result.rows[0];
          }
          dataSource = 'database';
        } catch (err) {
          return next(createAssetDbError(req.id, 'PATCH /assets/:id/status', err));
        }
      } else if (config.allowFallback) {
        const item = inMemoryAssets.find((a) => a.id === id);
        if (item) {
          if (status !== undefined) item.status = status;
          if (condition_grade !== undefined) item.condition_grade = condition_grade;
          if (notes !== undefined) item.notes = notes;
          item.updated_at = new Date().toISOString();
          updated = item;
        }
        dataSource = 'fallback';
      } else {
        return next(createAssetDbError(req.id, 'PATCH /assets/:id/status (fallback disabled)'));
      }

      if (!updated) {
        return res.status(404).json({ error: 'Asset not found', data_source: dataSource });
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'ASSET_CHANGE',
        entityType: 'ASSET',
        entityId: updated.id,
        changes: { status, condition_grade, notes, updated },
        ipAddress: req.ip,
      });

      return res.status(200).json({
        message: 'Asset status updated successfully',
        asset: updated,
        data_source: dataSource,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

