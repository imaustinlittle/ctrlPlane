import type { FastifyInstance } from 'fastify'
import https from 'https'
import http  from 'http'
import { isBlockedUrl } from '../lib/ssrf.js'

/**
 * Proxy ping endpoint — checks if a URL is reachable from the server.
 * Used by the Services widget to check internal/self-hosted service health.
 *
 * GET /api/ping?url=<encoded-url>
 *
 * Design decisions:
 * - Bare hostnames/IPs default to http:// — most homelab services use HTTP
 *   or non-standard ports. Users can prefix https:// explicitly.
 * - TLS verification is disabled so self-signed certs (OPNsense, Proxmox,
 *   etc.) don't produce false offline readings.
 * - 3xx redirects (e.g. HTTP→HTTPS) are treated as "reachable".
 */

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false })

export async function pingRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/', async (req, reply) => {
    const { url } = req.query
    if (!url) return reply.status(400).send({ error: 'url query param required' })

    // Default to http:// for bare hosts/IPs
    const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`

    let parsed: URL
    try {
      parsed = new URL(normalized)
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.status(400).send({ error: 'Only http/https URLs are supported' })
    }
    if (isBlockedUrl(normalized)) {
      return reply.status(403).send({ error: 'Target host is not allowed' })
    }

    const isHttps  = parsed.protocol === 'https:'
    const reqModule = isHttps ? https : http
    const start    = Date.now()

    return new Promise<object>(resolve => {
      const options: http.RequestOptions = {
        method:   'HEAD',
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        agent:    isHttps ? insecureHttpsAgent : undefined,
      }

      const request = reqModule.request(options, res => {
        res.resume() // drain the socket
        const latencyMs = Date.now() - start
        const status    = res.statusCode ?? 0
        // 3xx → redirect → reachable; 4xx → degraded; 5xx/0 → down
        const reachable = status >= 100 && status < 500
        const warn      = status >= 400 && status < 500
        resolve({ ok: reachable, warn, status, latencyMs })
      })

      request.setTimeout(5_000, () => {
        request.destroy()
        resolve({ ok: false, warn: false, latencyMs: Date.now() - start, error: 'timeout' })
      })

      request.on('error', () => {
        resolve({ ok: false, warn: false, latencyMs: Date.now() - start })
      })

      request.end()
    })
  })
}
