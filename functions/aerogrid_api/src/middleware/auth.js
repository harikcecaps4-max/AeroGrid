'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Authentication middleware verifying Bearer JWT tokens (HS256).
 * Populates req.user with decoded identity (id, email, role).
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please sign in.',
    });
  }

  if (!config.jwt.secret) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'JWT secret is not configured.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.name === 'TokenExpiredError' ? 'Token expired. Please sign in again.' : 'Invalid token.',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Enforces minimum role clearance (e.g. 'admin', 'analyst', 'viewer').
 * Role Hierarchy: admin > analyst > viewer
 */
const ROLE_RANKS = Object.freeze({
  admin: 3,
  analyst: 2,
  viewer: 1,
});

function requireRole(minimumRole) {
  if (
    typeof minimumRole !== 'string' ||
    !Object.prototype.hasOwnProperty.call(ROLE_RANKS, minimumRole.toLowerCase())
  ) {
    throw new Error(
      `Invalid role "${minimumRole}" passed to requireRole. Allowed roles: ${Object.keys(ROLE_RANKS).join(', ')}`
    );
  }

  const requiredRank = ROLE_RANKS[minimumRole.toLowerCase()];

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const userRank = ROLE_RANKS[String(req.user.role).toLowerCase()] || 0;

    if (userRank < requiredRank) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient privileges. '${minimumRole}' role required. Your role: '${req.user.role}'`,
      });
    }

    next();
  };
}

module.exports = {
  ROLE_RANKS,
  authenticateToken,
  requireRole,
};


