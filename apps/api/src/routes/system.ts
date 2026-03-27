import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import os from 'os'

export async function systemRoutes(app: FastifyInstance) {

  // GET /api/system/health — detailed host metrics (served from the API host itself)
  app.get('/health', async () => {
    const cpus      = os.cpus()
    const totalMem  = os.totalmem()
    const freeMem   = os.freemem()
    const usedMem   = totalMem - freeMem

    // Calculate aggregate CPU usage across all cores
    const cpuUsage = cpus.reduce((sum, cpu) => {
      const total  = Object.values(cpu.times).reduce((a, b) => a + b, 0)
      const idle   = cpu.times.idle
      return sum + ((total - idle) / total) * 100
    }, 0) / cpus.length

    return {
      cpu: {
        usage:   parseFloat(cpuUsage.toFixed(1)),
        cores:   cpus.length,
        model:   cpus[0]?.model ?? 'Unknown',
      },
      memory: {
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

  // GET /api/system/info — static info about the dashboard installation
  app.get('/info', async () => {
    return {
      version:   '0.1.0',
      buildDate: new Date().toISOString(),
      nodeVersion: process.version,
      uptime:    process.uptime(),
    }
  })

  // ── Notification channels ───────────────────────────────────────────────

  // GET /api/system/notifications
  app.get('/notifications', async () => {
    // In production: query notification_channels from DB
    return { channels: [] }
  })

  // POST /api/system/notifications — add notification channel
  app.post<{
    Body: {
      name:   string
      type:   'discord' | 'telegram' | 'email' | 'webhook' | 'ntfy'
      config: Record<string, unknown>
    }
  }>('/notifications', async (req, reply) => {
    const { type, config } = req.body

    // Validate required fields per channel type
    const REQUIRED: Record<string, string[]> = {
      discord:  ['webhookUrl'],
      telegram: ['botToken', 'chatId'],
      email:    ['smtpHost', 'smtpPort', 'from', 'to'],
      webhook:  ['url'],
      ntfy:     ['topic'],
    }

    const required = REQUIRED[type] ?? []
    const missing  = required.filter(k => !config[k])
    if (missing.length > 0) {
      return reply.status(400).send({ error: `Missing required fields: ${missing.join(', ')}` })
    }

    return {
      id:      randomUUID(),
      name:    req.body.name,
      type,
      enabled: true,
      createdAt: new Date().toISOString(),
    }
  })

  // POST /api/system/notifications/:id/test — send test notification
  app.post<{
    Params: { id: string }
  }>('/notifications/:id/test', async (req) => {
    // In production: load channel config, call provider.send()
    return {
      ok:      true,
      channel: req.params.id,
      message: 'Test notification dispatched',
      sentAt:  new Date().toISOString(),
    }
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  // GET /api/system/settings
  app.get('/settings', async () => {
    return {
      pollIntervalDefault: 30,
      alertCooldownDefault: 300,
      retentionDays: 30,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  })

  // PUT /api/system/settings
  app.put<{ Body: Record<string, unknown> }>('/settings', async (req) => {
    // In production: persist to DB
    return { ok: true, settings: req.body, updatedAt: new Date().toISOString() }
  })
}
