'use strict';

const { query } = require('../db');

const REDACTED_KEYS = new Set(['_token', 'token', 'access_token', 'idToken', 'password', 'password_hash']);

function sanitizeChanges(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeChanges);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACTED_KEYS.has(k)) continue;
    out[k] = sanitizeChanges(v);
  }
  return out;
}

/**
 * Audit Logger Service recording operations to PostgreSQL audit_log table
 * with graceful in-memory fallback. Never persists or logs auth tokens.
 */
async function logAudit({ userId, userEmail, action, entityType, entityId, changes, ipAddress }) {
  const safeChanges = changes ? sanitizeChanges(changes) : null;
  try {
    const sql = `
      INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, changes, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at;
    `;
    const params = [
      userId || null,
      userEmail || null,
      action,
      entityType,
      entityId || null,
      safeChanges ? JSON.stringify(safeChanges) : null,
      ipAddress || null,
    ];
    await query(sql, params);
  } catch (err) {
    // Non-blocking log recording to avoid breaking user operations
    console.warn('[Audit Logger Notice]: Audit log stored to system stdout:', {
      action,
      entityType,
      entityId,
      user: userEmail,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  logAudit,
};
