import type { FastifyInstance } from 'fastify'
import { isBlockedUrl } from '../lib/ssrf'

interface ProxyBody {
  url:      string
  method?:  string
  headers?: Record<string, string>
  body?:    string
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

// Headers that must not be forwarded — they affect connection/framing semantics
// and could enable HTTP request smuggling or fingerprinting.
const BLOCKED_HEADERS = new Set([
  'host', 'connection', 'transfer-encoding', 'content-length',
  'keep-alive', 'upgrade', 'proxy-authorization', 'te', 'trailer',
])

function sanitizeHeaders(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!BLOCKED_HEADERS.has(k.toLowerCase())) out[k] = v
  }
  return out
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function proxyRoutes(app: FastifyInstance) {
  app.post<{ Body: ProxyBody }>('/', async (req, reply) => {
    const { url, method = 'GET', headers = {}, body } = req.body ?? {}

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return reply.status(400).send({ error: 'Only http/https URLs are allowed' })
    }

    const upperMethod = method.toUpperCase()
    if (!ALLOWED_METHODS.has(upperMethod)) {
      return reply.status(400).send({ error: `HTTP method '${method}' is not allowed` })
    }

    if (isBlockedUrl(url)) {
      return reply.status(403).send({ error: 'Target host is not allowed' })
    }

    try {
      const res = await fetch(url, {
        method:  upperMethod,
        headers: sanitizeHeaders(headers),
        body:    body ?? undefined,
        signal:  AbortSignal.timeout(12_000),
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
