import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { integrations } from '../db/schema.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import { ENV } from '../lib/env.js'
import { getIntegration } from '../integrations/loader.js'

// ── Secrets redaction ─────────────────────────────────────────────────────────
const SECRET_KEYS = ['token', 'tokenSecret', 'password', 'apiKey', 'secret', 'tokenId']

function redactSecrets(creds: Record<string, unknown>): Record<string, unknown> {
  const out = { ...creds }
  for (const key of SECRET_KEYS) {
    if (key in out) out[key] = '••••••••'
  }
  return out
}

// ── Integration proxy helpers ─────────────────────────────────────────────────

async function proxmoxFetch(creds: Record<string, unknown>, endpoint: string) {
  const { host: rawHost, tokenId, tokenSecret, verifySsl } = creds as {
    host: string; tokenId: string; tokenSecret: string; verifySsl?: boolean
  }
  const host = normalizeUrl(rawHost)
  const res = await fetch(`${host}/api2/json${endpoint}`, {
    headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
    ...(verifySsl === false ? { signal: AbortSignal.timeout(10_000) } : {}),
  })
  if (!res.ok) throw new Error(`Proxmox: ${res.status} ${res.statusText}`)
  return res.json()
}

function normalizeUrl(raw: string): string {
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

async function hassFetch(creds: Record<string, unknown>, endpoint: string) {
  const { host: rawHost, token } = creds as { host: string; token: string }
  const host = normalizeUrl(rawHost)
  let res: Response
  try {
    res = await fetch(`${host}/api${endpoint}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new Error(`Cannot reach ${host} — ${(err as Error).message}`)
  }
  if (!res.ok) throw new Error(`Home Assistant returned ${res.status} ${res.statusText}`)
  return res.json()
}

async function dockerFetch(creds: Record<string, unknown>, endpoint: string) {
  const { url } = creds as { url: string }
  const res = await fetch(`${url}/v1.41${endpoint}`)
  if (!res.ok) throw new Error(`Docker: ${res.status} ${res.statusText}`)
  return res.json()
}

// ── Helper: load + decrypt creds ─────────────────────────────────────────────
// Looks up by adapterKey (first enabled instance). Optionally filter to a
// specific instance by name (for users with multiple instances of one type).

async function loadCreds(
  adapterKey: string,
  instanceName?: string,
): Promise<Record<string, unknown> | null> {
  const rows = await db.select().from(integrations).where(eq(integrations.adapterKey, adapterKey))
  const row  = instanceName
    ? rows.find(r => r.name === instanceName && r.enabled)
    : rows.find(r => r.enabled)
  if (!row) return null
  return JSON.parse(decrypt(row.credentialsEnc, ENV.MASTER_SECRET)) as Record<string, unknown>
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function integrationRoutes(app: FastifyInstance) {

  // GET /api/integrations — list all (secrets redacted)
  app.get('/', async () => {
    const rows = await db.select().from(integrations)
    return rows.map(row => {
      let creds: Record<string, unknown> = {}
      try { creds = JSON.parse(decrypt(row.credentialsEnc, ENV.MASTER_SECRET)) } catch { /* ignore */ }
      return {
        id:              row.id,
        name:            row.name,
        adapterKey:      row.adapterKey,
        enabled:         row.enabled,
        pollIntervalSec: row.pollIntervalSec,
        lastStatus:      row.lastStatus,
        lastPolledAt:    row.lastPolledAt,
        credentials:     redactSecrets(creds),
      }
    })
  })

  // GET /api/integrations/:name
  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const rows = await db.select().from(integrations).where(eq(integrations.name, req.params.name))
    const row  = rows[0]
    if (!row) return reply.status(404).send({ error: 'Integration not configured' })

    let creds: Record<string, unknown> = {}
    try { creds = JSON.parse(decrypt(row.credentialsEnc, ENV.MASTER_SECRET)) } catch { /* ignore */ }

    return {
      id:              row.id,
      name:            row.name,
      adapterKey:      row.adapterKey,
      enabled:         row.enabled,
      pollIntervalSec: row.pollIntervalSec,
      lastStatus:      row.lastStatus,
      lastPolledAt:    row.lastPolledAt,
      credentials:     redactSecrets(creds),
    }
  })

  // PUT /api/integrations/:name — upsert integration config
  app.put<{
    Params: { name: string }
    Body: { adapterKey?: string; enabled?: boolean; pollIntervalSec?: number; credentials?: Record<string, unknown> }
  }>('/:name', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' })
    }

    const { name } = req.params
    const { adapterKey, enabled = true, pollIntervalSec = 30, credentials = {} } = req.body

    const key       = adapterKey ?? name
    let mergedCreds = credentials

    // Load existing row to preserve secrets the frontend sent back as '••••••••'
    const existing = await db.select().from(integrations).where(eq(integrations.name, name))
    if (existing[0]) {
      let existingCreds: Record<string, unknown> = {}
      try { existingCreds = JSON.parse(decrypt(existing[0].credentialsEnc, ENV.MASTER_SECRET)) } catch { /* ignore */ }
      mergedCreds = { ...existingCreds, ...credentials }
      for (const k of SECRET_KEYS) {
        if (mergedCreds[k] === '••••••••' && existingCreds[k]) {
          mergedCreds[k] = existingCreds[k]
        }
      }
    }

    // Warn if no integration definition is registered for this key
    if (!getIntegration(key)) {
      console.warn(`[integrations] No integration file found for key "${key}" — saving credentials as-is`)
    }

    const credentialsEnc = encrypt(JSON.stringify(mergedCreds), ENV.MASTER_SECRET)
    const now = new Date().toISOString()

    if (existing[0]) {
      await db.update(integrations)
        .set({ adapterKey: key, credentialsEnc, enabled, pollIntervalSec })
        .where(eq(integrations.name, name))
    } else {
      await db.insert(integrations).values({
        id: randomUUID(), name, adapterKey: key, credentialsEnc,
        enabled, pollIntervalSec, createdAt: now,
      })
    }

    return { ok: true }
  })

  // DELETE /api/integrations/:name
  app.delete<{ Params: { name: string } }>('/:name', async (req) => {
    await db.delete(integrations).where(eq(integrations.name, req.params.name))
    return { ok: true }
  })

  // ── Proxmox proxy endpoints ───────────────────────────────────────────────

  app.get<{ Querystring: { name?: string } }>('/proxmox/nodes', async (req, reply) => {
    const creds = await loadCreds('proxmox', req.query.name)
    if (!creds) return reply.status(503).send({ error: 'Proxmox not configured or disabled' })
    try { return await proxmoxFetch(creds, '/nodes') }
    catch (err) { return reply.status(502).send({ error: (err as Error).message }) }
  })

  app.get<{ Querystring: { name?: string } }>('/proxmox/resources', async (req, reply) => {
    const creds = await loadCreds('proxmox', req.query.name)
    if (!creds) return reply.status(503).send({ error: 'Proxmox not configured or disabled' })
    try { return await proxmoxFetch(creds, '/cluster/resources') }
    catch (err) { return reply.status(502).send({ error: (err as Error).message }) }
  })

  // ── Docker proxy endpoints ────────────────────────────────────────────────

  app.get<{ Querystring: { name?: string } }>('/docker/containers', async (req, reply) => {
    const creds = await loadCreds('docker', req.query.name)
    if (!creds) return reply.status(503).send({ error: 'Docker not configured or disabled' })
    try { return await dockerFetch(creds, '/containers/json?all=true') }
    catch (err) { return reply.status(502).send({ error: (err as Error).message }) }
  })

  app.get<{ Querystring: { name?: string } }>('/docker/stats', async (req, reply) => {
    const creds = await loadCreds('docker', req.query.name)
    if (!creds) return reply.status(503).send({ error: 'Docker not configured or disabled' })
    try { return await dockerFetch(creds, '/containers/json?all=true') }
    catch (err) { return reply.status(502).send({ error: (err as Error).message }) }
  })

  // ── Home Assistant proxy endpoints ────────────────────────────────────────

  app.get<{ Querystring: { name?: string } }>('/homeassistant/states', async (req, reply) => {
    const creds = await loadCreds('homeassistant', req.query.name)
    if (!creds) return reply.status(503).send({ error: 'Home Assistant not configured or disabled' })
    try { return await hassFetch(creds, '/states') }
    catch (err) { return reply.status(502).send({ error: (err as Error).message }) }
  })

  // ── System metrics (host /proc) ───────────────────────────────────────────
  // No credentials needed — reads from the container's /proc filesystem

  app.get('/system/metrics', async (_req, reply) => {
    try {
      const { promises: fs } = await import('fs')
      const [cpuStat, memInfo] = await Promise.all([
        fs.readFile('/proc/stat',    'utf-8').catch(() => null),
        fs.readFile('/proc/meminfo', 'utf-8').catch(() => null),
      ])

      let cpuPercent = null
      if (cpuStat) {
        const line  = cpuStat.split('\n')[0]
        const parts = line.split(/\s+/).slice(1).map(Number)
        const idle  = parts[3] + (parts[4] ?? 0)
        const total = parts.reduce((a, b) => a + b, 0)
        cpuPercent  = Math.round((1 - idle / total) * 100)
      }

      let memData = null
      if (memInfo) {
        const get = (key: string) => {
          const m = memInfo.match(new RegExp(`${key}:\\s+(\\d+)`))
          return m ? parseInt(m[1]) * 1024 : 0
        }
        const total     = get('MemTotal')
        const available = get('MemAvailable')
        const used      = total - available
        memData = {
          totalGb:     parseFloat((total / 1e9).toFixed(1)),
          usedGb:      parseFloat((used  / 1e9).toFixed(1)),
          usedPercent: Math.round((used / total) * 100),
        }
      }

      return { cpu: cpuPercent, memory: memData }
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })
}
