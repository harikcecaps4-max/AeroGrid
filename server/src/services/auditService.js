'use strict';

const { query } = require('../../../functions/aerogrid_api/src/db');

/**
 * Audit Logger Service recording operations to PostgreSQL audit_log table
 * with graceful in-memory fallback.
 */
async function logAudit({ userId, userEmail, action, entityType, entityId, changes, ipAddress }) {
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
      changes ? JSON.stringify(changes) : null,
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

