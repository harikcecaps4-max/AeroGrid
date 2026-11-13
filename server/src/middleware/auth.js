'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Authentication middleware verifying Bearer JWT tokens.
 * Populates req.user with decoded identity (id, email, role).
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please sign in.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      error: 'Forbidden',
      message: err.name === 'TokenExpiredError' ? 'Token expired. Please sign in again.' : 'Invalid token.',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware.
 * Enforces minimum role clearance (e.g. 'admin' or 'analyst').
 * Role Hierarchy: admin > analyst > viewer
 */
const ROLE_RANKS = {
  admin: 3,
  analyst: 2,
  viewer: 1,
};

function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const userRank = ROLE_RANKS[req.user.role.toLowerCase()] || 0;
    const requiredRank = ROLE_RANKS[minimumRole.toLowerCase()] || 1;

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
  authenticateToken,
  requireRole,
};

