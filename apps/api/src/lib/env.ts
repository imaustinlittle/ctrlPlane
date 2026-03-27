/**
 * Centralised, validated environment configuration.
 * Import `ENV` instead of reading `process.env` directly throughout the codebase.
 * Throws at startup if required variables are missing or invalid.
 */

function require(name: string, minLen = 1): string {
  const val = process.env[name]
  if (!val || val.length < minLen) {
    throw new Error(
      `[env] Missing or invalid environment variable: ${name}` +
      (minLen > 1 ? ` (must be at least ${minLen} characters)` : '')
    )
  }
  return val
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export const ENV = {
  NODE_ENV:        optional('NODE_ENV', 'development'),
  PORT:            parseInt(optional('PORT', '3001')),
  HOST:            optional('HOST', '0.0.0.0'),
  DATABASE_URL:    require('DATABASE_URL'),
  REDIS_URL:       optional('REDIS_URL', 'redis://redis:6379'),
  MASTER_SECRET:   require('MASTER_SECRET', 32),
  CORS_ORIGIN:     optional('CORS_ORIGIN', '*'),
  LOG_LEVEL:       optional('LOG_LEVEL', 'info'),
  DATA_DIR:        optional('DATA_DIR', '/data'),
} as const
