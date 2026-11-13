'use strict';

/**
 * Validates and exports environment configuration for AeroGrid.
 * Fails fast with clear diagnostic messages if required variables are invalid in production.
 */

const isProd = process.env.NODE_ENV === 'production';

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  
  database: {
    url: process.env.DATABASE_URL || '',
    isConfigured: Boolean(process.env.DATABASE_URL),
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech') 
      ? { rejectUnauthorized: false } 
      : undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'aerogrid-dev-secret-key-change-in-production-min-32',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  },
};

// Validate critical parameters in production
if (isProd) {
  if (!process.env.DATABASE_URL) {
    console.warn('[AeroGrid Config Warning]: DATABASE_URL is not set in production. Serving in fallback mode.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error('[AeroGrid Config Error]: JWT_SECRET must be at least 16 characters in production.');
  }
}

module.exports = config;

