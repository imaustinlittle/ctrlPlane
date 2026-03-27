import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'
import { ENV } from '../lib/env.js'

export const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL })

export const db = drizzle(pool, { schema })

/**
 * Create all tables if they don't exist yet.
 * Idempotent — safe to call on every startup.
 */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer',
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboards (
      id              TEXT PRIMARY KEY,
      user_id         TEXT REFERENCES users(id),
      name            TEXT NOT NULL,
      theme_overrides TEXT,
      is_default      BOOLEAN DEFAULT false,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_pages (
      id           TEXT PRIMARY KEY,
      dashboard_id TEXT REFERENCES dashboards(id),
      name         TEXT NOT NULL,
      icon         TEXT,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      layout_json  TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS widgets (
      id             TEXT PRIMARY KEY,
      page_id        TEXT REFERENCES dashboard_pages(id),
      integration_id TEXT,
      widget_type    TEXT NOT NULL,
      config_json    TEXT NOT NULL DEFAULT '{}',
      position_json  TEXT NOT NULL DEFAULT '{}',
      created_at     TEXT NOT NULL,
      last_data_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      adapter_key      TEXT NOT NULL,
      credentials_enc  TEXT NOT NULL,
      poll_interval_sec INTEGER NOT NULL DEFAULT 30,
      enabled          BOOLEAN DEFAULT true,
      last_status      TEXT DEFAULT 'unknown',
      last_polled_at   TEXT,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id             TEXT PRIMARY KEY,
      integration_id TEXT REFERENCES integrations(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      condition_expr TEXT NOT NULL,
      severity       TEXT NOT NULL DEFAULT 'warning',
      cooldown_sec   INTEGER NOT NULL DEFAULT 300,
      enabled        BOOLEAN DEFAULT true,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id            TEXT PRIMARY KEY,
      rule_id       TEXT REFERENCES alert_rules(id) ON DELETE CASCADE,
      rule_name     TEXT NOT NULL,
      severity      TEXT NOT NULL DEFAULT 'warning',
      status        TEXT NOT NULL DEFAULT 'firing',
      message       TEXT,
      context_json  TEXT,
      fired_at      TEXT NOT NULL,
      resolved_at   TEXT,
      acked_at      TEXT,
      snoozed_until TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled     BOOLEAN DEFAULT true,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id           TEXT PRIMARY KEY,
      action       TEXT NOT NULL,
      target_type  TEXT,
      target_id    TEXT,
      payload_json TEXT,
      ip           TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id             TEXT PRIMARY KEY,
      integration_id TEXT REFERENCES integrations(id) ON DELETE CASCADE,
      widget_type    TEXT NOT NULL,
      data_json      TEXT NOT NULL,
      captured_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_alert_events_status   ON alert_events(status);
    CREATE INDEX IF NOT EXISTS idx_alert_events_fired_at ON alert_events(fired_at DESC);
    CREATE INDEX IF NOT EXISTS idx_integrations_enabled  ON integrations(enabled);
  `)
}
