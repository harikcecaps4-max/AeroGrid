'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../db');
const config = require('../config/env');
const { validateRequest } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditService');

const router = express.Router();

const DEV_USER_SPECS = [
  {
    id: 1,
    email: 'admin@aerogrid.dev',
    role: 'admin',
    name: 'Chief Aviation Ops',
    envKey: 'DEV_ADMIN_PASSWORD',
  },
  {
    id: 2,
    email: 'analyst@aerogrid.dev',
    role: 'analyst',
    name: 'Fleet Route Planner',
    envKey: 'DEV_ANALYST_PASSWORD',
  },
  {
    id: 3,
    email: 'viewer@aerogrid.dev',
    role: 'viewer',
    name: 'Guest Viewer',
    envKey: 'DEV_VIEWER_PASSWORD',
  },
];

let inMemoryUsers = [];

/**
 * Generates real bcrypt password hashes at startup from env-provided dev passwords
 * ONLY when ALLOW_FALLBACK=true and never in production.
 */
function initInMemoryUsers(env = process.env) {
  const isProd = !config.isRelaxedEnv(env);
  const allowFallback =
    env.ALLOW_FALLBACK !== undefined ? env.ALLOW_FALLBACK === 'true' : !isProd;

  if (isProd || !allowFallback) {
    inMemoryUsers = [];
    return inMemoryUsers;
  }

  const rounds = parseInt(env.BCRYPT_SALT_ROUNDS || '10', 10);
  const users = [];

  for (const spec of DEV_USER_SPECS) {
    const rawPassword = env[spec.envKey] || env.DEV_USER_PASSWORD;
    if (typeof rawPassword === 'string' && rawPassword.length >= 6) {
      users.push({
        id: spec.id,
        email: spec.email.toLowerCase().trim(),
        password_hash: bcrypt.hashSync(rawPassword, rounds),
        role: spec.role,
        name: spec.name,
      });
    }
  }

  inMemoryUsers = users;
  return inMemoryUsers;
}

initInMemoryUsers();

const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please wait before retrying.',
  },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(10, 'Google ID token is required'),
});

let oauthClientCache = { clientId: null, client: null };
let customGoogleVerifier = null;

async function verifyGoogleIdToken(idToken, audience) {
  if (typeof customGoogleVerifier === 'function') {
    return customGoogleVerifier({ idToken, audience });
  }
  if (!oauthClientCache.client || oauthClientCache.clientId !== audience) {
    oauthClientCache = { clientId: audience, client: new OAuth2Client(audience) };
  }
  const ticket = await oauthClientCache.client.verifyIdToken({ idToken, audience });
  return ticket ? ticket.getPayload() : null;
}

function resolveGoogleUserRole(normalizedEmail, existingRole = null) {
  if (config.auth.adminEmails.includes(normalizedEmail)) return 'admin';
  if (config.auth.analystEmails.includes(normalizedEmail)) {
    return existingRole === 'admin' ? 'admin' : 'analyst';
  }
  return existingRole || 'viewer';
}

const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive('User ID must be a positive integer'),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'analyst', 'viewer']),
});

function createDbUnavailableError(reqId, context, err) {
  console.error('[AeroGrid Auth Database Error]:', {
    requestId: reqId || null,
    context,
    message: err ? err.message : 'Database is not configured and fallback is disabled.',
  });
  const serviceErr = new Error('Authentication database service unavailable.');
  serviceErr.status = 503;
  serviceErr.error = 'Service Unavailable';
  return serviceErr;
}

/**
 * POST /api/auth/login
 */
router.post(
  '/auth/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const normalizedEmail = req.body.email.trim().toLowerCase();
      const { password } = req.body;
      let user = null;

      if (config.database.isConfigured) {
        try {
          const sql = 'SELECT id, email, password_hash, role, is_active FROM users WHERE LOWER(email) = $1 LIMIT 1';
          const result = await query(sql, [normalizedEmail]);
          if (result && result.rows && result.rows.length > 0) {
            user = result.rows[0];
          }
        } catch (dbErr) {
          return next(createDbUnavailableError(req.id, 'POST /auth/login', dbErr));
        }
      } else if (!config.isProd && config.allowFallback) {
        user = inMemoryUsers.find((u) => u.email.toLowerCase() === normalizedEmail) || null;
      } else {
        return next(createDbUnavailableError(req.id, 'POST /auth/login (fallback disabled)'));
      }

      // users.is_active (migration 009) disables accounts without deleting them;
      // Google-only accounts have password_hash = NULL and cannot log in via password.
      if (!user || user.is_active === false || !user.password_hash) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid email or password.',
        });
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid email or password.',
        });
      }

      const normalizedUserEmail = user.email.trim().toLowerCase();
      const token = jwt.sign(
        {
          id: user.id,
          email: normalizedUserEmail,
          role: user.role || 'viewer',
          name: user.name || normalizedUserEmail.split('@')[0],
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiresIn,
        }
      );

      await logAudit({
        userId: user.id,
        userEmail: normalizedUserEmail,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
      });

      return res.status(200).json({
        message: 'Authentication successful',
        token,
        user: {
          id: user.id,
          email: normalizedUserEmail,
          role: user.role,
          name: user.name || normalizedUserEmail.split('@')[0],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/register
 * New users are always assigned the 'viewer' role.
 */
router.post(
  '/auth/register',
  authRateLimiter,
  validateRequest({ body: registerSchema }),
  async (req, res, next) => {
    try {
      const normalizedEmail = req.body.email.trim().toLowerCase();
      const { password, name } = req.body;
      const role = 'viewer';

      const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
      const passwordHash = await bcrypt.hash(password, salt);

      let newUser = null;

      if (config.database.isConfigured) {
        try {
          const dupCheck = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail]);
          if (dupCheck && dupCheck.rows && dupCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Conflict', message: 'User already exists.' });
          }

          const sql = `
            INSERT INTO users (email, password_hash, role)
            VALUES ($1, $2, $3)
            RETURNING id, email, role, created_at;
          `;
          const result = await query(sql, [normalizedEmail, passwordHash, role]);
          if (result && result.rows && result.rows.length > 0) {
            newUser = result.rows[0];
          }
        } catch (dbErr) {
          if (dbErr && dbErr.code === '23505') {
            return res.status(409).json({ error: 'Conflict', message: 'User already exists.' });
          }
          return next(createDbUnavailableError(req.id, 'POST /auth/register', dbErr));
        }
      } else if (!config.isProd && config.allowFallback) {
        const exists = inMemoryUsers.some((u) => u.email.toLowerCase() === normalizedEmail);
        if (exists) {
          return res.status(409).json({ error: 'Conflict', message: 'User already exists.' });
        }
        const maxId = inMemoryUsers.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
        newUser = {
          id: maxId + 1,
          email: normalizedEmail,
          role,
          name: name || normalizedEmail.split('@')[0],
          password_hash: passwordHash,
        };
        inMemoryUsers.push(newUser);
      } else {
        return next(createDbUnavailableError(req.id, 'POST /auth/register (fallback disabled)'));
      }

      const displayName = name || newUser.email.split('@')[0];
      const token = jwt.sign(
        {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          name: displayName,
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiresIn,
        }
      );

      await logAudit({
        userId: newUser.id,
        userEmail: newUser.email,
        action: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        changes: { email: newUser.email, role: newUser.role },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          name: displayName,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/google
 * Verifies a Google ID token via OAuth2Client.verifyIdToken, finds or creates the user,
 * applies env-allowlisted role upgrades only, and issues the existing HS256 JWT.
 */
router.post(
  '/auth/google',
  authRateLimiter,
  validateRequest({ body: googleLoginSchema }),
  async (req, res, next) => {
    try {
      const clientId = config.google.clientId;
      if (!clientId) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Google sign-in is not configured on this server.',
        });
      }

      const { idToken } = req.body;
      let payload = null;
      try {
        payload = await verifyGoogleIdToken(idToken, clientId);
      } catch {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid or expired Google ID token.',
        });
      }

      if (!payload || !payload.email || !payload.sub) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid Google ID token payload.',
        });
      }

      if (payload.aud && payload.aud !== clientId) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Google ID token audience mismatch.',
        });
      }

      if (payload.email_verified !== true) {
        return res.status(401).json({
          error: 'Authentication Failed',
          message: 'Google account email address is not verified.',
        });
      }

      const normalizedEmail = String(payload.email).trim().toLowerCase();
      const googleSub = String(payload.sub);
      const displayName =
        typeof payload.name === 'string' && payload.name.trim()
          ? payload.name.trim()
          : normalizedEmail.split('@')[0];

      let user = null;

      if (config.database.isConfigured) {
        try {
          const existingRes = await query(
            'SELECT id, email, role, is_active, google_sub FROM users WHERE google_sub = $1 OR LOWER(email) = $2 LIMIT 1',
            [googleSub, normalizedEmail]
          );
          const existing = existingRes && existingRes.rows && existingRes.rows[0];

          if (existing) {
            if (existing.is_active === false) {
              return res.status(401).json({
                error: 'Authentication Failed',
                message: 'Account is disabled.',
              });
            }
            const nextRole = resolveGoogleUserRole(normalizedEmail, existing.role);
            if (existing.google_sub !== googleSub || existing.role !== nextRole) {
              const upd = await query(
                'UPDATE users SET google_sub = COALESCE(google_sub, $1), role = $2, last_login_at = now() WHERE id = $3 RETURNING id, email, role',
                [googleSub, nextRole, existing.id]
              );
              user = upd.rows[0];
            } else {
              await query('UPDATE users SET last_login_at = now() WHERE id = $1', [existing.id]);
              user = existing;
            }
          } else {
            const role = resolveGoogleUserRole(normalizedEmail, 'viewer');
            const ins = await query(
              `INSERT INTO users (email, password_hash, role, google_sub, last_login_at)
               VALUES ($1, NULL, $2, $3, now())
               RETURNING id, email, role`,
              [normalizedEmail, role, googleSub]
            );
            user = ins.rows[0];
          }
        } catch (dbErr) {
          return next(createDbUnavailableError(req.id, 'POST /auth/google', dbErr));
        }
      } else if (!config.isProd && config.allowFallback) {
        const existing = inMemoryUsers.find(
          (u) => (u.google_sub && u.google_sub === googleSub) || u.email.toLowerCase() === normalizedEmail
        );
        if (existing) {
          if (existing.is_active === false) {
            return res.status(401).json({
              error: 'Authentication Failed',
              message: 'Account is disabled.',
            });
          }
          existing.google_sub = existing.google_sub || googleSub;
          existing.role = resolveGoogleUserRole(normalizedEmail, existing.role);
          existing.name = existing.name || displayName;
          user = existing;
        } else {
          const maxId = inMemoryUsers.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
          user = {
            id: maxId + 1,
            email: normalizedEmail,
            password_hash: null,
            google_sub: googleSub,
            role: resolveGoogleUserRole(normalizedEmail, 'viewer'),
            name: displayName,
          };
          inMemoryUsers.push(user);
        }
      } else {
        return next(createDbUnavailableError(req.id, 'POST /auth/google (fallback disabled)'));
      }

      const normalizedUserEmail = user.email.trim().toLowerCase();
      const token = jwt.sign(
        {
          id: user.id,
          email: normalizedUserEmail,
          role: user.role || 'viewer',
          name: user.name || displayName,
        },
        config.jwt.secret,
        {
          algorithm: 'HS256',
          expiresIn: config.jwt.expiresIn,
        }
      );

      await logAudit({
        userId: user.id,
        userEmail: normalizedUserEmail,
        action: 'LOGIN_GOOGLE',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: req.ip,
      });

      return res.status(200).json({
        message: 'Authentication successful',
        token,
        user: {
          id: user.id,
          email: normalizedUserEmail,
          role: user.role || 'viewer',
          name: user.name || displayName,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/users/:id/role
 * Admin-only endpoint to update a user's RBAC role with audit logging.
 */
router.patch(
  '/users/:id/role',
  authenticateToken,
  requireRole('admin'),
  validateRequest({ params: userIdParamSchema, body: updateUserRoleSchema }),
  async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const { role } = req.body;
      let updatedUser = null;
      let previousRole = null;

      if (config.database.isConfigured) {
        try {
          const existing = await query('SELECT id, email, role FROM users WHERE id = $1 LIMIT 1', [targetId]);
          if (!existing || !existing.rows || existing.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: `User #${targetId} not found.` });
          }
          previousRole = existing.rows[0].role;

          const updateResult = await query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
            [role, targetId]
          );
          updatedUser = updateResult.rows[0];
        } catch (dbErr) {
          return next(createDbUnavailableError(req.id, 'PATCH /users/:id/role', dbErr));
        }
      } else if (!config.isProd && config.allowFallback) {
        const memUser = inMemoryUsers.find((u) => Number(u.id) === targetId);
        if (!memUser) {
          return res.status(404).json({ error: 'Not Found', message: `User #${targetId} not found.` });
        }
        previousRole = memUser.role;
        memUser.role = role;
        updatedUser = {
          id: memUser.id,
          email: memUser.email,
          role: memUser.role,
        };
      } else {
        return next(createDbUnavailableError(req.id, 'PATCH /users/:id/role (fallback disabled)'));
      }

      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: updatedUser.id,
        changes: { previousRole, newRole: updatedUser.role },
        ipAddress: req.ip,
      });

      return res.status(200).json({
        message: 'User role updated successfully',
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.initInMemoryUsers = initInMemoryUsers;
router.getInMemoryUsers = () => inMemoryUsers;
router.setGoogleVerifier = (fn) => {
  customGoogleVerifier = fn;
};
router.resetGoogleVerifier = () => {
  customGoogleVerifier = null;
};

module.exports = router;


