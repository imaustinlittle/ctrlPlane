import type { FastifyInstance } from 'fastify'

interface ProxyBody {
  url:      string
  method?:  string
  headers?: Record<string, string>
  body?:    string
}

// ── SSRF protection ────────────────────────────────────────────────────────────
// Block loopback and cloud-metadata endpoints. Private LAN IPs (192.168.x.x,
// 10.x.x.x, etc.) are intentionally allowed — this is a homelab dashboard and
// users need to reach their local services.
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  '169.254.169.254',  // AWS / GCP / Azure metadata
  '169.254.170.2',    // ECS task metadata
  // Internal Docker service names that should never be reachable from widgets
  'redis',
  'postgres',
  'ctrlplane-redis',
  'ctrlplane-postgres',
  'ctrlplane-api',
])

function isBlockedUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw)
    return BLOCKED_HOSTNAMES.has(hostname.toLowerCase())
  } catch {
    return true   // unparseable URL → block
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function proxyRoutes(app: FastifyInstance) {
  app.post<{ Body: ProxyBody }>('/', async (req, reply) => {
    const { url, method = 'GET', headers = {}, body } = req.body ?? {}

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return reply.status(400).send({ error: 'Only http/https URLs are allowed' })
    }

    if (isBlockedUrl(url)) {
      return reply.status(403).send({ error: 'Target host is not allowed' })
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        signal: AbortSignal.timeout(12_000),
      })

      const text = await res.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { data = text }

      const setCookie = res.headers.get('set-cookie') ?? undefined
      return reply.status(200).send({ status: res.status, data, ...(setCookie ? { setCookie } : {}) })

    } catch (err) {
      const e    = err as NodeJS.ErrnoException
      const code = e.code ?? ''
      const msg  = e.message ?? String(err)

      // Classify network errors into meaningful categories
      if (['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) {
        return reply.status(502).send({ error: `Service unreachable (${code}): check that the host/port is correct and the service is running` })
      }
      if (e.name === 'TimeoutError' || code === 'ETIMEDOUT') {
        return reply.status(504).send({ error: 'Request timed out after 12 s — service may be slow or unreachable' })
      }
      if (code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'CERT_HAS_EXPIRED') {
        return reply.status(502).send({ error: `TLS certificate error (${code}) — try using http:// or fix the certificate` })
      }

      return reply.status(502).send({ error: msg })
    }
  })
}
