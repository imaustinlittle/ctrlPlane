import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import os from 'os'
import { db } from '../db/index.js'
import { notificationChannels } from '../db/schema.js'
import { sendNotification } from '../notifications/index.js'

export async function systemRoutes(app: FastifyInstance) {

  // ── System health / info ──────────────────────────────────────────────────

  app.get('/health', async () => {
    const cpus     = os.cpus()
    const totalMem = os.totalmem()
    const freeMem  = os.freemem()
    const usedMem  = totalMem - freeMem

    const cpuUsage = cpus.reduce((sum, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
      return sum + ((total - cpu.times.idle) / total) * 100
    }, 0) / cpus.length

    return {
      cpu:      { usage: parseFloat(cpuUsage.toFixed(1)), cores: cpus.length, model: cpus[0]?.model ?? 'Unknown' },
      memory:   {
        totalGb: parseFloat((totalMem / 1073741824).toFixed(1)),
        usedGb:  parseFloat((usedMem  / 1073741824).toFixed(1)),
        freeGb:  parseFloat((freeMem  / 1073741824).toFixed(1)),
        percent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
      },
      uptime:   os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
      loadAvg:  os.loadavg().map(v => parseFloat(v.toFixed(2))),
      ts:       new Date().toISOString(),
    }
  })

  app.get('/info', async () => ({
    version:     '0.1.0',
    buildDate:   new Date().toISOString(),
    nodeVersion: process.version,
    uptime:      process.uptime(),
  }))

  // ── Notification channels ─────────────────────────────────────────────────

  // GET /api/system/notifications
  app.get('/notifications', async () => {
    const channels = await db.select().from(notificationChannels)
    // Redact sensitive config values in the response
    return {
      channels: channels.map(ch => {
        let config: Record<string, unknown> = {}
        try { config = JSON.parse(ch.configJson) } catch { /* ignore */ }
        // Redact secrets
        const REDACT = ['webhookUrl', 'botToken', 'password', 'apiKey', 'url']
        const safe   = Object.fromEntries(
          Object.entries(config).map(([k, v]) =>
            REDACT.includes(k) ? [k, '••••••••'] : [k, v]
          )
        )
        return { id: ch.id, name: ch.name, type: ch.type, enabled: ch.enabled, config: safe, createdAt: ch.createdAt }
      }),
    }
  })

  // POST /api/system/notifications — add channel
  app.post<{
    Body: {
      name:   string
      type:   'discord' | 'telegram' | 'email' | 'webhook' | 'ntfy'
      config: Record<string, unknown>
    }
  }>('/notifications', async (req, reply) => {
    const { type, config, name } = req.body

    const REQUIRED: Record<string, string[]> = {
      discord:  ['webhookUrl'],
      telegram: ['botToken', 'chatId'],
      email:    ['smtpHost', 'smtpPort', 'from', 'to'],
      webhook:  ['url'],
      ntfy:     ['topic'],
    }

    const missing = (REQUIRED[type] ?? []).filter(k => !config[k])
    if (missing.length > 0) {
      return reply.status(400).send({ error: `Missing required fields: ${missing.join(', ')}` })
    }

    const channel = {
      id:         randomUUID(),
      name,
      type,
      configJson: JSON.stringify(config),
      enabled:    true,
      createdAt:  new Date().toISOString(),
    }

    await db.insert(notificationChannels).values(channel)
    return { id: channel.id, name, type, enabled: true, createdAt: channel.createdAt }
  })

  // PUT /api/system/notifications/:id — update channel
  app.put<{
    Params: { id: string }
    Body:   { name?: string; enabled?: boolean; config?: Record<string, unknown> }
  }>('/notifications/:id', async (req, reply) => {
    const rows = await db.select().from(notificationChannels).where(eq(notificationChannels.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Channel not found' })

    const updates: Partial<typeof notificationChannels.$inferInsert> = {}
    if (req.body.name    !== undefined) updates.name       = req.body.name
    if (req.body.enabled !== undefined) updates.enabled    = req.body.enabled
    if (req.body.config  !== undefined) updates.configJson = JSON.stringify(req.body.config)

    await db.update(notificationChannels).set(updates).where(eq(notificationChannels.id, req.params.id))
    return { ok: true, id: req.params.id }
  })

  // DELETE /api/system/notifications/:id
  app.delete<{ Params: { id: string } }>('/notifications/:id', async (req, reply) => {
    const rows = await db.select().from(notificationChannels).where(eq(notificationChannels.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Channel not found' })
    await db.delete(notificationChannels).where(eq(notificationChannels.id, req.params.id))
    return { ok: true }
  })

  // POST /api/system/notifications/:id/test — send a real test message
  app.post<{ Params: { id: string } }>('/notifications/:id/test', async (req, reply) => {
    const rows = await db.select().from(notificationChannels).where(eq(notificationChannels.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Channel not found' })

    const result = await sendNotification(
      rows[0],
      'This is a test notification from ctrlPlane. If you received this, the channel is configured correctly.',
      'ctrlPlane — Test Notification',
    )

    if (!result.ok) {
      return reply.status(502).send({ ok: false, error: result.error })
    }
    return { ok: true, channel: req.params.id, sentAt: new Date().toISOString() }
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  app.get('/settings', async () => ({
    pollIntervalDefault:  30,
    alertCooldownDefault: 300,
    retentionDays:        30,
    timezone:             Intl.DateTimeFormat().resolvedOptions().timeZone,
  }))

  app.put<{ Body: Record<string, unknown> }>('/settings', async (req) => ({
    ok: true, settings: req.body, updatedAt: new Date().toISOString(),
  }))
}
