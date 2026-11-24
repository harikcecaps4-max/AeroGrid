'use strict';

/**
 * Validates and exports environment configuration for AeroGrid.
 * Fails fast with clear diagnostic messages if required variables are invalid in production.
 */

const SAFE_ENVIRONMENTS = ['test', 'development'];

/**
 * Only an explicit NODE_ENV of 'test' or 'development' relaxes secret checks.
 * Unset or any other value (including 'production', 'staging', typos) is treated as production-like.
 */
function isRelaxedEnv(env = process.env) {
  return SAFE_ENVIRONMENTS.includes(env.NODE_ENV);
}

function validateProductionEnv(env = process.env) {
  if (isRelaxedEnv(env)) return;

  if (!env.JWT_SECRET || typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) {
    throw new Error(
      '[AeroGrid Config Error]: JWT_SECRET is required and must be at least 32 characters ' +
        `unless NODE_ENV is explicitly 'test' or 'development' (got NODE_ENV=${env.NODE_ENV === undefined ? '<unset>' : `'${env.NODE_ENV}'`}).`
    );
  }
  if (!env.GOOGLE_CLIENT_ID || typeof env.GOOGLE_CLIENT_ID !== 'string' || !env.GOOGLE_CLIENT_ID.trim()) {
    throw new Error(
      '[AeroGrid Config Error]: GOOGLE_CLIENT_ID is required ' +
        `unless NODE_ENV is explicitly 'test' or 'development' (got NODE_ENV=${env.NODE_ENV === undefined ? '<unset>' : `'${env.NODE_ENV}'`}).`
    );
  }
  if (!env.DATABASE_URL) {
    console.warn('[AeroGrid Config Warning]: DATABASE_URL is not set.');
  }
}

function parseEmailList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

validateProductionEnv(process.env);

const config = {
  get port() {
    return parseInt(process.env.PORT || '3000', 10);
  },
  get nodeEnv() {
    return process.env.NODE_ENV;
  },
  get isProd() {
    return !isRelaxedEnv(process.env);
  },
  get allowFallback() {
    if (process.env.ALLOW_FALLBACK !== undefined) {
      return process.env.ALLOW_FALLBACK === 'true';
    }
    return isRelaxedEnv(process.env);
  },

  database: {
    get url() {
      return process.env.DATABASE_URL || '';
    },
    get isConfigured() {
      return Boolean(process.env.DATABASE_URL);
    },
    get ssl() {
      return process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined;
    },
  },

  jwt: {
    get secret() {
      return process.env.JWT_SECRET;
    },
    get expiresIn() {
      return process.env.JWT_EXPIRES_IN || '24h';
    },
  },

  google: {
    get clientId() {
      return (process.env.GOOGLE_CLIENT_ID || '').trim();
    },
  },

  auth: {
    get adminEmails() {
      return parseEmailList(process.env.ADMIN_EMAILS);
    },
    get analystEmails() {
      return parseEmailList(process.env.ANALYST_EMAILS);
    },
  },

  security: {
    get bcryptSaltRounds() {
      return parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    },
    get corsOrigins() {
      const combined = [
        process.env.CORS_ORIGIN || '',
        process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000',
      ]
        .join(',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return [...new Set(combined)];
    },
    get rateLimitWindowMs() {
      return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 min
    },
    get rateLimitMax() {
      return parseInt(process.env.RATE_LIMIT_MAX || '500', 10);
    },
  },

  validateProductionEnv,
  isRelaxedEnv,
};

module.exports = config;


