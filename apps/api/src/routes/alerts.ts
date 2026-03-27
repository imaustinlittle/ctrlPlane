import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

export async function alertRoutes(app: FastifyInstance) {
  // GET /api/alerts/rules
  app.get('/rules', async () => {
    return { rules: [] }
  })

  // POST /api/alerts/rules — create alert rule
  app.post<{
    Body: {
      widgetId:      string
      name:          string
      conditionExpr: string
      severity:      'critical' | 'warning' | 'info'
      cooldownSec?:  number
    }
  }>('/rules', async (req, reply) => {
    const { conditionExpr } = req.body

    // Validate expression — block dangerous tokens
    const BANNED = ['fetch', 'XMLHttpRequest', 'process', 'require', 'import', 'eval', 'window', 'document']
    const hasBanned = BANNED.some(t => conditionExpr.includes(t))
    if (hasBanned) {
      return reply.status(400).send({ error: 'Expression contains disallowed tokens' })
    }

    return {
      id:            randomUUID(),
      ...req.body,
      cooldownSec:   req.body.cooldownSec ?? 300,
      enabled:       true,
      createdAt:     new Date().toISOString(),
    }
  })

  // PUT /api/alerts/rules/:id
  app.put<{
    Params: { id: string }
    Body: { enabled?: boolean; cooldownSec?: number; severity?: string }
  }>('/rules/:id', async (req) => {
    return { id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }
  })

  // DELETE /api/alerts/rules/:id
  app.delete<{ Params: { id: string } }>('/rules/:id', async (req) => {
    return { ok: true, id: req.params.id }
  })

  // GET /api/alerts/events — alert history with optional filters
  app.get<{
    Querystring: { status?: string; severity?: string; limit?: string }
  }>('/events', async (req) => {
    const limit = parseInt(req.query.limit ?? '50')
    // In production: query DB with filters
    return { events: [], total: 0, limit }
  })

  // POST /api/alerts/events/:id/ack — acknowledge alert
  app.post<{ Params: { id: string } }>('/events/:id/ack', async (req) => {
    return {
      id:     req.params.id,
      status: 'acknowledged',
      ackedAt: new Date().toISOString(),
    }
  })

  // POST /api/alerts/events/:id/snooze — snooze for N minutes
  app.post<{
    Params: { id: string }
    Body: { minutes: number }
  }>('/events/:id/snooze', async (req, reply) => {
    const { minutes } = req.body
    if (!minutes || minutes < 1 || minutes > 1440) {
      return reply.status(400).send({ error: 'minutes must be 1–1440' })
    }
    const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString()
    return {
      id: req.params.id,
      status: 'snoozed',
      snoozedUntil,
    }
  })

  // POST /api/alerts/events/:id/resolve — manually resolve
  app.post<{ Params: { id: string } }>('/events/:id/resolve', async (req) => {
    return {
      id:         req.params.id,
      status:     'resolved',
      resolvedAt: new Date().toISOString(),
    }
  })
}
