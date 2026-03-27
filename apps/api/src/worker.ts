/**
 * ctrlPlane Background Worker
 * Handles scheduled integration polling, alert evaluation, and notification dispatch.
 * Powered by BullMQ (Redis-backed job queue).
 */

import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db, initDb } from './db/index.js'
import { integrations, alertRules, alertEvents, notificationChannels } from './db/schema.js'
import { decrypt } from './lib/crypto.js'
import { ENV } from './lib/env.js'
import { getAdapter } from './integrations/adapters/index.js'
import { sendNotification } from './notifications/index.js'

// ── Redis clients ─────────────────────────────────────────────────────────────

// BullMQ and general cache both use ioredis
const bullConnection = {
  host: new URL(ENV.REDIS_URL.replace('redis://', 'http://')).hostname,
  port: parseInt(new URL(ENV.REDIS_URL.replace('redis://', 'http://')).port || '6379'),
}

const redis = new IORedis(bullConnection)
redis.on('error', err => console.error('[worker] Redis error:', err))

// ── Queue ─────────────────────────────────────────────────────────────────────

const POLL_QUEUE = 'integration-poll'

export const pollQueue = new Queue(POLL_QUEUE, { connection: bullConnection })

// ── Job processor ─────────────────────────────────────────────────────────────

interface PollJobData {
  integrationId: string
}

const worker = new Worker<PollJobData>(
  POLL_QUEUE,
  async (job: Job<PollJobData>) => {
    const { integrationId } = job.data

    // Load integration from DB
    const rows = await db.select().from(integrations).where(eq(integrations.id, integrationId))
    const row  = rows[0]
    if (!row || !row.enabled) {
      console.log(`[worker] Skipping disabled/missing integration: ${integrationId}`)
      return
    }

    // Decrypt credentials
    let creds: unknown
    try {
      creds = JSON.parse(decrypt(row.credentialsEnc, ENV.MASTER_SECRET))
    } catch (err) {
      console.error(`[worker] Failed to decrypt credentials for ${row.name}:`, err)
      await db.update(integrations).set({ lastStatus: 'error' }).where(eq(integrations.id, integrationId))
      return
    }

    // Get adapter
    const adapter = getAdapter(row.adapterKey)
    if (!adapter) {
      console.warn(`[worker] No adapter found for key: ${row.adapterKey}`)
      return
    }

    // Fetch data for each supported widget type
    const now = new Date().toISOString()
    let anySuccess = false

    for (const widgetType of adapter.supportedWidgets) {
      try {
        const result = await adapter.fetchData(widgetType, {}, creds)
        const cacheKey = `widget:${integrationId}:${widgetType}`
        await redis.set(cacheKey, JSON.stringify({ data: result.data, lastUpdated: now }), 'EX', 120)
        anySuccess = true
        console.log(`[worker] Cached ${cacheKey}`)
      } catch (err) {
        console.error(`[worker] fetchData failed for ${row.name}/${widgetType}:`, err)
      }
    }

    // Update integration status
    await db.update(integrations).set({
      lastStatus:   anySuccess ? 'ok' : 'error',
      lastPolledAt: now,
    }).where(eq(integrations.id, integrationId))

    // Evaluate alert rules for this integration
    if (anySuccess) {
      await evaluateAlertRules(integrationId)
    }
  },
  { connection: bullConnection, concurrency: 5 },
)

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message)
})

// ── Alert evaluation ──────────────────────────────────────────────────────────

async function evaluateAlertRules(integrationId: string): Promise<void> {
  const rules = await db.select().from(alertRules)
    .where(eq(alertRules.integrationId, integrationId))

  for (const rule of rules) {
    if (!rule.enabled) continue

    // Check cooldown — don't re-fire within cooldown window
    const recentEvents = await db.select().from(alertEvents)
      .where(eq(alertEvents.ruleId, rule.id))
      .limit(1)

    const lastEvent = recentEvents[0]
    if (lastEvent && lastEvent.status === 'firing') {
      const firedAt  = new Date(lastEvent.firedAt).getTime()
      const cooldown = (rule.cooldownSec ?? 300) * 1000
      if (Date.now() - firedAt < cooldown) continue
    }

    // Evaluate the condition expression against cached data
    // For now, expressions like "cpu > 80" are evaluated against the widget data
    const widgetTypes = await getWidgetTypesForIntegration(integrationId)
    let fired = false
    let matchedData: unknown

    for (const widgetType of widgetTypes) {
      const cacheKey = `widget:${integrationId}:${widgetType}`
      const cached   = await redis.get(cacheKey)
      if (!cached) continue

      const { data } = JSON.parse(cached) as { data: unknown }
      try {
        fired = evalExpression(rule.conditionExpr, data as Record<string, unknown>)
        if (fired) { matchedData = data; break }
      } catch { /* expression errors are silent */ }
    }

    if (fired) {
      await fireAlert(rule, matchedData)
    }
  }
}

async function getWidgetTypesForIntegration(integrationId: string): Promise<string[]> {
  const rows = await db.select().from(integrations).where(eq(integrations.id, integrationId))
  const adapter = rows[0] ? getAdapter(rows[0].adapterKey) : null
  return adapter?.supportedWidgets ?? []
}

/**
 * Safely evaluate a simple expression like "cpu > 80" or "ram >= 90"
 * against a flat data object. Only supports basic comparisons.
 */
function evalExpression(expr: string, data: Record<string, unknown>): boolean {
  // Only allow: identifier op number (e.g. "cpu > 80", "ram >= 90.5")
  const match = expr.trim().match(/^(\w+)\s*(>=|<=|>|<|===?|!==?)?\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return false

  const [, field, op = '>', threshold] = match
  const val = data[field]
  if (typeof val !== 'number') return false

  const t = parseFloat(threshold)
  switch (op) {
    case '>':   return val >  t
    case '>=':  return val >= t
    case '<':   return val <  t
    case '<=':  return val <= t
    case '==':
    case '===': return val === t
    case '!=':
    case '!==': return val !== t
    default:    return false
  }
}

async function fireAlert(
  rule: typeof alertRules.$inferSelect,
  context: unknown,
): Promise<void> {
  const event = {
    id:          randomUUID(),
    ruleId:      rule.id,
    ruleName:    rule.name,
    severity:    rule.severity,
    status:      'firing',
    message:     `Alert rule "${rule.name}" fired`,
    contextJson: context ? JSON.stringify(context) : null,
    firedAt:     new Date().toISOString(),
  }

  await db.insert(alertEvents).values(event)
  console.log(`[worker] Alert fired: ${rule.name} (${rule.severity})`)

  // Dispatch to all enabled notification channels
  const channels = await db.select().from(notificationChannels)
    .where(eq(notificationChannels.enabled, true))

  for (const channel of channels) {
    const result = await sendNotification(
      channel,
      event.message,
      `ctrlPlane — ${rule.severity.toUpperCase()} alert`,
    )
    if (!result.ok) {
      console.warn(`[worker] Notification to ${channel.name} failed: ${result.error}`)
    }
  }
}

// ── Job scheduling ────────────────────────────────────────────────────────────

export async function scheduleIntegration(
  integrationId: string,
  pollIntervalSec: number,
): Promise<void> {
  const jobId = `poll:${integrationId}`
  await pollQueue.add(
    'poll',
    { integrationId },
    {
      jobId,
      repeat: { every: pollIntervalSec * 1000 },
      removeOnComplete: { count: 10 },
      removeOnFail:     { count: 5 },
    },
  )
  console.log(`[worker] Scheduled polling for ${integrationId} every ${pollIntervalSec}s`)
}

export async function unscheduleIntegration(integrationId: string): Promise<void> {
  const jobId = `poll:${integrationId}`
  const repeatKey = `repeat:poll:${integrationId}:*`
  const repeatableJobs = await pollQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.id === jobId) {
      await pollQueue.removeRepeatableByKey(job.key)
      console.log(`[worker] Removed polling job for ${integrationId}`)
    }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  console.log('🔧  ctrlPlane worker starting...')
  console.log('   Redis:', ENV.REDIS_URL)
  console.log('   DB:   ', ENV.DATABASE_URL ? '[set]' : '[not set]')

  await initDb()

  // Schedule polling jobs for all enabled integrations
  const enabled = await db.select().from(integrations).where(eq(integrations.enabled, true))
  for (const integration of enabled) {
    await scheduleIntegration(integration.id, integration.pollIntervalSec)
  }

  console.log(`✅  Worker running — scheduled ${enabled.length} integration(s)`)
}

bootstrap().catch(err => {
  console.error('[worker] Fatal startup error:', err)
  process.exit(1)
})
