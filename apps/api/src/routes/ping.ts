import type { FastifyInstance } from 'fastify'

/**
 * Proxy ping endpoint — checks if a URL is reachable from the server.
 * Used by the Services widget to avoid browser CORS restrictions when
 * checking internal/self-hosted service health.
 *
 * GET /api/ping?url=<encoded-url>
 */
export async function pingRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/', async (req, reply) => {
    const { url } = req.query
    if (!url) return reply.status(400).send({ error: 'url query param required' })

    // Basic validation — only allow http/https URLs
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return reply.status(400).send({ error: 'Only http/https URLs are supported' })
    }

    const start = Date.now()
    try {
      const res = await fetch(url, {
        method:  'HEAD',
        signal:  AbortSignal.timeout(5_000),
        // Don't follow redirects — the fact a service responds at all means it's up
        redirect: 'manual',
      })
      const latencyMs = Date.now() - start
      // 2xx/3xx → up, 4xx/5xx → degraded (service is reachable but erroring)
      const ok      = res.status < 500
      const warn    = res.status >= 400 && res.status < 500
      return { ok, warn, status: res.status, latencyMs }
    } catch (err) {
      return { ok: false, warn: false, latencyMs: Date.now() - start, error: String(err) }
    }
  })
}
