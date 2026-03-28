import type { FastifyInstance } from 'fastify'
import { Agent } from 'undici'

/**
 * Proxy ping endpoint — checks if a URL is reachable from the server.
 * Used by the Services widget to check internal/self-hosted service health.
 *
 * GET /api/ping?url=<encoded-url>
 *
 * Design decisions:
 * - Bare hostnames/IPs default to http:// (most homelab services use HTTP or
 *   non-standard ports like :8080). Users can prefix https:// explicitly.
 * - TLS verification is disabled so self-signed certificates (very common in
 *   homelabs) don't produce false "offline" results.
 * - redirect:'manual' + treating status 0 as "ok" means services that redirect
 *   HTTP→HTTPS are correctly reported as online.
 */

// Shared agent that skips TLS verification — intentional for reachability checks
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } })

export async function pingRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/', async (req, reply) => {
    const { url } = req.query
    if (!url) return reply.status(400).send({ error: 'url query param required' })

    // Default to http:// for bare hosts/IPs; users can explicitly prefix https://
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

    const start = Date.now()
    try {
      const res = await fetch(normalized, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
        redirect: 'manual',
        // @ts-expect-error — undici dispatcher extension to Node.js fetch
        dispatcher: insecureAgent,
      })
      const latencyMs = Date.now() - start
      // status 0 = opaque redirect (service is up, just redirecting HTTP→HTTPS)
      const reachable = res.status === 0 || res.status < 500
      const warn      = res.status >= 400 && res.status < 500
      return { ok: reachable, warn, status: res.status, latencyMs }
    } catch (err) {
      return { ok: false, warn: false, latencyMs: Date.now() - start, error: String(err) }
    }
  })
}
