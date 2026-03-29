import type { FastifyInstance } from 'fastify'

interface ProxyBody {
  url:      string
  method?:  string
  headers?: Record<string, string>
  body?:    string
}

export async function proxyRoutes(app: FastifyInstance) {
  app.post<{ Body: ProxyBody }>('/', async (req, reply) => {
    const { url, method = 'GET', headers = {}, body } = req.body ?? {}

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return reply.status(400).send({ error: 'Only http/https URLs are allowed' })
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

      // Expose Set-Cookie so widgets can extract session tokens (e.g. qBittorrent)
      const setCookie = res.headers.get('set-cookie') ?? undefined

      return reply.status(200).send({ status: res.status, data, ...(setCookie ? { setCookie } : {}) })
    } catch (err) {
      const msg = (err as Error).message
      // ECONNREFUSED / ETIMEDOUT → service is down
      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch')) {
        return reply.status(502).send({ error: `Cannot reach service: ${msg}` })
      }
      return reply.status(502).send({ error: msg })
    }
  })
}
