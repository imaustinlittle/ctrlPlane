/**
 * ctrlPlane Background Worker
 * Handles scheduled integration polling, alert evaluation, and notification dispatch.
 * Powered by BullMQ (Redis-backed job queue).
 */

import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import os from 'os'
import { promises as fs } from 'fs'
import { db, initDb } from './db/index.js'
import { integrations, alertRules, alertEvents, notificationChannels } from './db/schema.js'
import { decrypt } from './lib/crypto.js'
import { ENV } from './lib/env.js'
import { loadIntegrationRegistry, getIntegration } from './integrations/loader.js'
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

    // Get integration from dynamic registry
    const integration = getIntegration(row.adapterKey)
    if (!integration) {
      console.warn(`[worker] No integration found for key: ${row.adapterKey}`)
      return
    }

    // Fetch data for each widget type that declared this integration
    const now = new Date().toISOString()
    let anySuccess = false

    for (const [widgetType, fetchData] of integration.widgets) {
      try {
        const data     = await fetchData(creds as Record<string, string>)
        const cacheKey = `widget:${integrationId}:${widgetType}`
        await redis.set(cacheKey, JSON.stringify({ data, lastUpdated: now }), 'EX', 120)
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
  const rows        = await db.select().from(integrations).where(eq(integrations.id, integrationId))
  const integration = rows[0] ? getIntegration(rows[0].adapterKey) : null
  return integration ? Array.from(integration.widgets.keys()) : []
}

/**
 * Resolve a dotted path like "cpu.usage" from a nested object.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc !== null && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * Safely evaluate a simple expression like "cpu.usage > 80" or "memory.percent >= 90"
 * against a nested data object. Only supports basic numeric comparisons.
 */
function evalExpression(expr: string, data: Record<string, unknown>): boolean {
  const match = expr.trim().match(/^([\w.]+)\s*(>=|<=|>|<|===?|!==?)\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return false

  const [, field, op, threshold] = match
  const val = getNestedValue(data, field)
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

// ── System metric alert evaluation ───────────────────────────────────────────
// Runs every 30s; evaluates rules with no integrationId against live OS stats.

async function collectSystemMetrics(): Promise<Record<string, unknown>> {
  const cpus     = os.cpus()
  const totalMem = os.totalmem()
  const freeMem  = os.freemem()
  const usedMem  = totalMem - freeMem

  const cpuUsage = cpus.reduce((sum, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    return sum + ((total - cpu.times.idle) / total) * 100
  }, 0) / cpus.length

  let tempC: number | null = null
  try {
    const raw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8')
    tempC = parseFloat((parseInt(raw.trim()) / 1000).toFixed(1))
  } catch { /* not available on this platform */ }

  return {
    cpu: {
      usage:  parseFloat(cpuUsage.toFixed(1)),
      cores:  cpus.length,
    },
    memory: {
      totalGb: parseFloat((totalMem / 1073741824).toFixed(1)),
      usedGb:  parseFloat((usedMem  / 1073741824).toFixed(1)),
      freeGb:  parseFloat((freeMem  / 1073741824).toFixed(1)),
      percent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
    },
    tempC,
    uptime:  os.uptime(),
    loadAvg: os.loadavg().map(v => parseFloat(v.toFixed(2))),
  }
}

async function evaluateSystemAlertRules(): Promise<void> {
  const rules = await db.select().from(alertRules)
    .where(isNull(alertRules.integrationId))

  if (rules.length === 0) return

  let metrics: Record<string, unknown>
  try { metrics = await collectSystemMetrics() }
  catch (err) { console.error('[worker] Failed to collect system metrics:', err); return }

  for (const rule of rules) {
    if (!rule.enabled) continue

    // Cooldown: don't re-fire while already firing within cooldown window
    const recent = await db.select().from(alertEvents)
      .where(eq(alertEvents.ruleId, rule.id))
      .limit(1)

    const last = recent[0]
    if (last && last.status === 'firing') {
      const elapsed = Date.now() - new Date(last.firedAt).getTime()
      if (elapsed < (rule.cooldownSec ?? 300) * 1000) continue
    }

    try {
      if (evalExpression(rule.conditionExpr, metrics)) {
        await fireAlert(rule, metrics)
      }
    } catch { /* expression errors are silent */ }
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

  await loadIntegrationRegistry()
  await initDb()

  // Schedule polling jobs for all enabled integrations
  const enabled = await db.select().from(integrations).where(eq(integrations.enabled, true))
  for (const integration of enabled) {
    await scheduleIntegration(integration.id, integration.pollIntervalSec)
  }

  console.log(`✅  Worker running — scheduled ${enabled.length} integration(s)`)

  // Evaluate system metric alert rules every 30s
  await evaluateSystemAlertRules()
  setInterval(evaluateSystemAlertRules, 30_000)
  console.log('✅  System metric alert evaluator running (30s interval)')
}

bootstrap().catch(err => {
  console.error('[worker] Fatal startup error:', err)
  process.exit(1)
})
