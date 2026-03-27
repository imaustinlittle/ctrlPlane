import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('viewer'),  // 'admin' | 'viewer'
  createdAt:    text('created_at').notNull(),
})

// ── Dashboards ────────────────────────────────────────────────────────────────
export const dashboards = sqliteTable('dashboards', {
  id:             text('id').primaryKey(),
  userId:         text('user_id').references(() => users.id),
  name:           text('name').notNull(),
  themeOverrides: text('theme_overrides'),   // JSON
  isDefault:      integer('is_default', { mode: 'boolean' }).default(false),
  createdAt:      text('created_at').notNull(),
  updatedAt:      text('updated_at').notNull(),
})

// ── Dashboard pages ───────────────────────────────────────────────────────────
export const dashboardPages = sqliteTable('dashboard_pages', {
  id:          text('id').primaryKey(),
  dashboardId: text('dashboard_id').references(() => dashboards.id),
  name:        text('name').notNull(),
  icon:        text('icon'),
  sortOrder:   integer('sort_order').notNull().default(0),
  layoutJson:  text('layout_json').notNull().default('[]'),  // WidgetLayout[]
})

// ── Widgets ───────────────────────────────────────────────────────────────────
export const widgets = sqliteTable('widgets', {
  id:            text('id').primaryKey(),
  pageId:        text('page_id').references(() => dashboardPages.id),
  integrationId: text('integration_id'),
  widgetType:    text('widget_type').notNull(),
  configJson:    text('config_json').notNull().default('{}'),
  positionJson:  text('position_json').notNull().default('{}'),
  createdAt:     text('created_at').notNull(),
  lastDataAt:    text('last_data_at'),
})

// ── Integrations ──────────────────────────────────────────────────────────────
export const integrations = sqliteTable('integrations', {
  id:              text('id').primaryKey(),
  userId:          text('user_id').references(() => users.id),
  name:            text('name').notNull(),
  adapterKey:      text('adapter_key').notNull(),
  credentialsEnc:  text('credentials_enc').notNull(),  // AES-256-GCM encrypted JSON
  pollIntervalSec: integer('poll_interval_sec').notNull().default(30),
  enabled:         integer('enabled', { mode: 'boolean' }).default(true),
  lastStatus:      text('last_status').default('unknown'),
  lastPolledAt:    text('last_polled_at'),
  createdAt:       text('created_at').notNull(),
})

// ── Alert rules ───────────────────────────────────────────────────────────────
export const alertRules = sqliteTable('alert_rules', {
  id:              text('id').primaryKey(),
  widgetId:        text('widget_id').references(() => widgets.id),
  name:            text('name').notNull(),
  conditionExpr:   text('condition_expr').notNull(),
  severity:        text('severity').notNull().default('warning'),  // critical|warning|info
  cooldownSec:     integer('cooldown_sec').notNull().default(300),
  enabled:         integer('enabled', { mode: 'boolean' }).default(true),
  createdAt:       text('created_at').notNull(),
})

// ── Alert events ──────────────────────────────────────────────────────────────
export const alertEvents = sqliteTable('alert_events', {
  id:          text('id').primaryKey(),
  ruleId:      text('rule_id').references(() => alertRules.id),
  status:      text('status').notNull().default('firing'),  // firing|resolved|acknowledged|snoozed
  contextJson: text('context_json'),
  firedAt:     text('fired_at').notNull(),
  resolvedAt:  text('resolved_at'),
  ackedAt:     text('acked_at'),
  snoozedUntil:text('snoozed_until'),
})

// ── Notification channels ─────────────────────────────────────────────────────
export const notificationChannels = sqliteTable('notification_channels', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  type:       text('type').notNull(),   // discord|telegram|email|webhook|ntfy
  configJson: text('config_json').notNull(),
  enabled:    integer('enabled', { mode: 'boolean' }).default(true),
  createdAt:  text('created_at').notNull(),
})

// ── Audit log ─────────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),
  userId:      text('user_id'),
  action:      text('action').notNull(),
  targetType:  text('target_type'),
  targetId:    text('target_id'),
  payloadJson: text('payload_json'),
  ip:          text('ip'),
  createdAt:   text('created_at').notNull(),
})

// ── Cached metric snapshots ───────────────────────────────────────────────────
export const metricSnapshots = sqliteTable('metric_snapshots', {
  id:           text('id').primaryKey(),
  integrationId:text('integration_id').references(() => integrations.id),
  widgetType:   text('widget_type').notNull(),
  dataJson:     text('data_json').notNull(),
  capturedAt:   text('captured_at').notNull(),
})
