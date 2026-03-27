import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR   = process.env.DATA_DIR ?? '/data'
const CONFIG_FILE = path.join(DATA_DIR, 'integrations.json')

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IntegrationConfig {
  enabled: boolean
  [key: string]: unknown
}

export type IntegrationsConfig = Record<string, IntegrationConfig>

// ── Persistence ───────────────────────────────────────────────────────────────
let cache: IntegrationsConfig | null = null

async function read(): Promise<IntegrationsConfig> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    cache = JSON.parse(raw) as IntegrationsConfig
    return cache
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}

async function write(config: IntegrationsConfig): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = `${CONFIG_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf-8')
  await fs.rename(tmp, CONFIG_FILE)
  cache = config
}

// ── Integration proxy helpers ─────────────────────────────────────────────────
// These fetch from real services using stored credentials.
// Widgets call /api/integrations/:name/... and never deal with auth/CORS.

async function proxmoxFetch(cfg: IntegrationConfig, endpoint: string) {
  const { url, tokenId, tokenSecret, verifySsl } = cfg as unknown as {
    url: string; tokenId: string; tokenSecret: string; verifySsl?: boolean
  }
  const res = await fetch(`${url}/api2/json${endpoint}`, {
    headers: { Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}` },
    // @ts-ignore — node-fetch flag
    ...(verifySsl === false ? { rejectUnauthorized: false } : {}),
  })
  if (!res.ok) throw new Error(`Proxmox: ${res.status} ${res.statusText}`)
  return res.json()
}

async function hass_fetch(cfg: IntegrationConfig, endpoint: string) {
  const { url, token } = cfg as unknown as { url: string; token: string }
  const res = await fetch(`${url}/api${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`HomeAssistant: ${res.status} ${res.statusText}`)
  return res.json()
}

async function dockerFetch(cfg: IntegrationConfig, endpoint: string) {
  const { url } = cfg as unknown as { url: string }
  // url is either http://dockerhost:2375 or unix socket path
  const res = await fetch(`${url}/v1.41${endpoint}`)
  if (!res.ok) throw new Error(`Docker: ${res.status} ${res.statusText}`)
  return res.json()
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function integrationRoutes(app: FastifyInstance) {

  // Warm cache
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    cache = await read()
  } catch { /* ignore */ }

  // GET /api/integrations — list all integration configs (secrets redacted)
  app.get('/', async () => {
    const config = await read()
    // Redact secrets before sending to frontend
    const redacted: IntegrationsConfig = {}
    for (const [name, cfg] of Object.entries(config)) {
      redacted[name] = { ...cfg }
      for (const key of ['token', 'tokenSecret', 'password', 'apiKey', 'secret']) {
        if (key in redacted[name]) redacted[name][key] = '••••••••'
      }
    }
    return redacted
  })

  // GET /api/integrations/:name — get one integration config (secrets redacted)
  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const config = await read()
    const cfg = config[req.params.name]
    if (!cfg) return reply.status(404).send({ error: 'Integration not configured' })
    const redacted = { ...cfg }
    for (const key of ['token', 'tokenSecret', 'password', 'apiKey', 'secret']) {
      if (key in redacted) redacted[key] = '••••••••'
    }
    return redacted
  })

  // PUT /api/integrations/:name — save integration config
  app.put<{ Params: { name: string }; Body: IntegrationConfig }>('/:name', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    const config = await read()
    // Merge — preserve existing secrets if frontend sends back '••••••••'
    const existing = config[req.params.name] ?? {}
    const merged: IntegrationConfig = { ...existing, ...req.body }
    for (const key of ['token', 'tokenSecret', 'password', 'apiKey', 'secret']) {
      if (merged[key] === '••••••••' && existing[key]) {
        merged[key] = existing[key] // keep existing secret
      }
    }
    config[req.params.name] = merged
    await write(config)
    return { ok: true }
  })

  // DELETE /api/integrations/:name — remove integration
  app.delete<{ Params: { name: string } }>('/:name', async (req) => {
    const config = await read()
    delete config[req.params.name]
    await write(config)
    return { ok: true }
  })

  // ── Proxmox data endpoints ────────────────────────────────────────────────
  app.get('/proxmox/nodes', async (_req, reply) => {
    const config = await read()
    const cfg = config['proxmox']
    if (!cfg?.enabled) return reply.status(503).send({ error: 'Proxmox not configured' })
    try {
      return await proxmoxFetch(cfg, '/nodes')
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  app.get('/proxmox/resources', async (_req, reply) => {
    const config = await read()
    const cfg = config['proxmox']
    if (!cfg?.enabled) return reply.status(503).send({ error: 'Proxmox not configured' })
    try {
      return await proxmoxFetch(cfg, '/cluster/resources')
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  // ── Docker data endpoints ─────────────────────────────────────────────────
  app.get('/docker/containers', async (_req, reply) => {
    const config = await read()
    const cfg = config['docker']
    if (!cfg?.enabled) return reply.status(503).send({ error: 'Docker not configured' })
    try {
      return await dockerFetch(cfg, '/containers/json?all=true')
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  app.get('/docker/stats', async (_req, reply) => {
    const config = await read()
    const cfg = config['docker']
    if (!cfg?.enabled) return reply.status(503).send({ error: 'Docker not configured' })
    try {
      return await dockerFetch(cfg, '/containers/json?all=true')
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  // ── Home Assistant data endpoints ─────────────────────────────────────────
  app.get('/homeassistant/states', async (_req, reply) => {
    const config = await read()
    const cfg = config['homeassistant']
    if (!cfg?.enabled) return reply.status(503).send({ error: 'Home Assistant not configured' })
    try {
      return await hass_fetch(cfg, '/states')
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })

  // ── System metrics (reads from host via /proc) ────────────────────────────
  // Enabled by default — no credentials needed
  app.get('/system/metrics', async (_req, reply) => {
    try {
      const [cpuStat, memInfo] = await Promise.all([
        fs.readFile('/proc/stat', 'utf-8').catch(() => null),
        fs.readFile('/proc/meminfo', 'utf-8').catch(() => null),
      ])

      // Parse CPU usage
      let cpuPercent = null
      if (cpuStat) {
        const line = cpuStat.split('\n')[0]
        const parts = line.split(/\s+/).slice(1).map(Number)
        const idle  = parts[3] + (parts[4] ?? 0)
        const total = parts.reduce((a, b) => a + b, 0)
        cpuPercent  = Math.round((1 - idle / total) * 100)
      }

      // Parse memory
      let memData = null
      if (memInfo) {
        const get = (key: string) => {
          const m = memInfo.match(new RegExp(`${key}:\\s+(\\d+)`))
          return m ? parseInt(m[1]) * 1024 : 0  // kB → bytes
        }
        const total     = get('MemTotal')
        const available = get('MemAvailable')
        const used      = total - available
        memData = {
          totalGb:    parseFloat((total / 1e9).toFixed(1)),
          usedGb:     parseFloat((used  / 1e9).toFixed(1)),
          usedPercent: Math.round((used / total) * 100),
        }
      }

      return { cpu: cpuPercent, memory: memData }
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message })
    }
  })
}
