import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import os from 'os'
import { execSync } from 'child_process'
import { promises as fs } from 'fs'
import { db } from '../db/index.js'
import { notificationChannels } from '../db/schema.js'
import { sendNotification } from '../notifications/index.js'

// ── WMO weather code → condition + emoji ──────────────────────────────────────
function wmoCode(code: number): { condition: string; emoji: string } {
  if (code === 0)  return { condition: 'Clear sky',     emoji: '☀️' }
  if (code <= 2)   return { condition: 'Partly cloudy', emoji: '⛅' }
  if (code === 3)  return { condition: 'Overcast',      emoji: '☁️' }
  if (code <= 48)  return { condition: 'Foggy',         emoji: '🌫️' }
  if (code <= 57)  return { condition: 'Drizzle',       emoji: '🌦️' }
  if (code <= 67)  return { condition: 'Rain',          emoji: '🌧️' }
  if (code <= 77)  return { condition: 'Snow',          emoji: '❄️' }
  if (code <= 82)  return { condition: 'Rain showers',  emoji: '🌦️' }
  if (code <= 86)  return { condition: 'Snow showers',  emoji: '🌨️' }
  return                  { condition: 'Thunderstorm',  emoji: '⛈️' }
}

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

    // Read CPU temperature from thermal zone (Linux only)
    let tempC: number | null = null
    try {
      const raw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8')
      tempC = parseFloat((parseInt(raw.trim()) / 1000).toFixed(1))
    } catch { /* not available on this platform */ }

    return {
      cpu:      { usage: parseFloat(cpuUsage.toFixed(1)), cores: cpus.length, model: cpus[0]?.model ?? 'Unknown' },
      memory:   {
        totalGb: parseFloat((totalMem / 1073741824).toFixed(1)),
        usedGb:  parseFloat((usedMem  / 1073741824).toFixed(1)),
        freeGb:  parseFloat((freeMem  / 1073741824).toFixed(1)),
        percent: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
      },
      tempC,
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

  // ── Storage ───────────────────────────────────────────────────────────────
  // GET /api/system/storage
  app.get('/storage', async (_req, reply) => {
    try {
      const output  = execSync('df -B1 -P 2>/dev/null || df -B1', { timeout: 5000 }).toString()
      const SKIP    = ['/dev', '/sys', '/proc', '/run', '/tmp']
      const mounts  = output.trim().split('\n').slice(1).flatMap(line => {
        const parts = line.trim().split(/\s+/)
        if (parts.length < 6) return []
        const mount  = parts[parts.length - 1]
        const totalB = Number(parts[1])
        const usedB  = Number(parts[2])
        if (SKIP.some(p => mount.startsWith(p))) return []
        if (totalB < 1e8) return []  // skip tiny pseudo-filesystems
        return [{
          mount,
          label:   mount,
          usedGb:  parseFloat((usedB  / 1073741824).toFixed(2)),
          totalGb: parseFloat((totalB / 1073741824).toFixed(2)),
        }]
      })
      return mounts
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  // ── Network throughput ────────────────────────────────────────────────────
  // GET /api/system/network?iface=eth0
  // Takes ~1 second to respond (reads /proc/net/dev twice)
  app.get<{ Querystring: { iface?: string } }>('/network', async (req, reply) => {
    const iface = req.query.iface ?? 'eth0'
    try {
      const readBytes = async () => {
        const content = await fs.readFile('/proc/net/dev', 'utf-8')
        const line    = content.split('\n').find(l => l.trim().startsWith(iface + ':'))
        if (!line) throw new Error(`Interface "${iface}" not found in /proc/net/dev`)
        const parts = line.trim().split(/\s+/)
        // parts: ['iface:', rx_bytes, ...(7 more rx), tx_bytes, ...]
        return { rx: Number(parts[1]), tx: Number(parts[9]) }
      }

      const t1 = await readBytes()
      await new Promise(r => setTimeout(r, 1000))
      const t2 = await readBytes()

      return {
        interface:    iface,
        downloadMbps: parseFloat(((t2.rx - t1.rx) * 8 / 1e6).toFixed(2)),
        uploadMbps:   parseFloat(((t2.tx - t1.tx) * 8 / 1e6).toFixed(2)),
      }
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  // ── Weather (Open-Meteo, no API key needed) ───────────────────────────────
  // GET /api/system/weather?location=Smyrna,GA&units=imperial
  app.get<{ Querystring: { location?: string; units?: string } }>('/weather', async (req, reply) => {
    const { location = 'Smyrna, GA', units = 'imperial' } = req.query
    try {
      interface GeoResult { results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string }> }

      // Try full location string first; fall back to just the city name (before any comma)
      const cityOnly = location.split(',')[0].trim()
      let geo: GeoResult = {}
      for (const q of [location, cityOnly]) {
        const r = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`,
          { signal: AbortSignal.timeout(8_000) },
        )
        geo = await r.json() as GeoResult
        if (geo.results?.length) break
      }
      if (!geo.results?.length) return reply.status(404).send({ error: `Location not found: ${location}` })

      const { latitude, longitude, name, admin1 } = geo.results[0]
      const displayLocation = admin1 ? `${name}, ${admin1}` : name
      const tempUnit = units === 'metric' ? 'celsius'    : 'fahrenheit'
      const windUnit = units === 'metric' ? 'kmh'        : 'mph'

      interface WxResponse {
        current: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number }
        daily:   { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
      }
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=6` +
        `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto`,
        { signal: AbortSignal.timeout(8_000) },
      )
      const wx = await wxRes.json() as WxResponse
      const { condition, emoji } = wmoCode(wx.current.weather_code)

      const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      // Skip index 0 (today); return the next 5 days
      const forecast = wx.daily.time.slice(1, 6).map((date, i) => {
        const idx = i + 1
        const d   = new Date(date + 'T12:00:00')
        return {
          weekday: DAYS[d.getDay()],
          emoji:   wmoCode(wx.daily.weather_code[idx]).emoji,
          high:    Math.round(wx.daily.temperature_2m_max[idx]),
          low:     Math.round(wx.daily.temperature_2m_min[idx]),
        }
      })

      return {
        temp:      Math.round(wx.current.temperature_2m),
        condition,
        emoji,
        humidity:  wx.current.relative_humidity_2m,
        windSpeed: Math.round(wx.current.wind_speed_10m),
        location:  displayLocation,
        units,
        forecast,
      }
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })
}
