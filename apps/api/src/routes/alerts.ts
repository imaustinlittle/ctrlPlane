import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { alertRules, alertEvents } from '../db/schema.js'

export async function alertRoutes(app: FastifyInstance) {

  // ── Alert rules ─────────────────────────────────────────────────────────────

  // GET /api/alerts/rules
  app.get('/rules', async () => {
    const rules = await db.select().from(alertRules).orderBy(alertRules.createdAt)
    return { rules }
  })

  // POST /api/alerts/rules — create alert rule
  app.post<{
    Body: {
      integrationId?: string
      name:           string
      conditionExpr:  string
      severity:       'critical' | 'warning' | 'info'
      cooldownSec?:   number
    }
  }>('/rules', async (req, reply) => {
    const { conditionExpr } = req.body

    // Validate expression — allow only: field.path op number (e.g. "cpu.usage > 90")
    if (!/^[\w.]+\s*(>=|<=|>|<|===?|!==?)\s*-?\d+(\.\d+)?$/.test(conditionExpr.trim())) {
      return reply.status(400).send({ error: 'Expression must be in the form: field.path op number (e.g. cpu.usage > 90)' })
    }

    const SEVERITIES = new Set(['critical', 'warning', 'info'])
    if (!req.body.name?.trim()) return reply.status(400).send({ error: 'name is required' })
    if (!SEVERITIES.has(req.body.severity)) return reply.status(400).send({ error: 'severity must be critical, warning, or info' })
    const cooldownSec = req.body.cooldownSec ?? 300
    if (cooldownSec < 1 || cooldownSec > 86400) return reply.status(400).send({ error: 'cooldownSec must be between 1 and 86400' })

    const rule = {
      id:            randomUUID(),
      integrationId: req.body.integrationId ?? null,
      name:          req.body.name.trim(),
      conditionExpr,
      severity:      req.body.severity,
      cooldownSec,
      enabled:       true,
      createdAt:     new Date().toISOString(),
    }

    await db.insert(alertRules).values(rule)
    return rule
  })

  // PUT /api/alerts/rules/:id
  app.put<{
    Params: { id: string }
    Body: { enabled?: boolean; cooldownSec?: number; severity?: string; name?: string }
  }>('/rules/:id', async (req, reply) => {
    const rows = await db.select().from(alertRules).where(eq(alertRules.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Rule not found' })

    const SEVERITIES = new Set(['critical', 'warning', 'info'])
    if (req.body.severity !== undefined && !SEVERITIES.has(req.body.severity)) {
      return reply.status(400).send({ error: 'severity must be critical, warning, or info' })
    }
    if (req.body.cooldownSec !== undefined && (req.body.cooldownSec < 1 || req.body.cooldownSec > 86400)) {
      return reply.status(400).send({ error: 'cooldownSec must be between 1 and 86400' })
    }

    const updates: Partial<typeof alertRules.$inferInsert> = {}
    if (req.body.enabled     !== undefined) updates.enabled     = req.body.enabled
    if (req.body.cooldownSec !== undefined) updates.cooldownSec = req.body.cooldownSec
    if (req.body.severity    !== undefined) updates.severity    = req.body.severity
    if (req.body.name        !== undefined) updates.name        = req.body.name.trim()

    await db.update(alertRules).set(updates).where(eq(alertRules.id, req.params.id))
    return { id: req.params.id, ...updates, updatedAt: new Date().toISOString() }
  })

  // DELETE /api/alerts/rules/:id
  app.delete<{ Params: { id: string } }>('/rules/:id', async (req) => {
    await db.delete(alertRules).where(eq(alertRules.id, req.params.id))
    return { ok: true, id: req.params.id }
  })

  // ── Alert events ─────────────────────────────────────────────────────────────

  // GET /api/alerts/events
  app.get<{
    Querystring: { status?: string; severity?: string; limit?: string }
  }>('/events', async (req) => {
    const limit = Math.min(parseInt(req.query.limit ?? '50'), 200)

    const conditions = []
    if (req.query.status)   conditions.push(eq(alertEvents.status,   req.query.status))
    if (req.query.severity) conditions.push(eq(alertEvents.severity, req.query.severity))

    const events = await db
      .select()
      .from(alertEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertEvents.firedAt))
      .limit(limit)

    return { events, total: events.length, limit }
  })

  // POST /api/alerts/events/:id/ack
  app.post<{ Params: { id: string } }>('/events/:id/ack', async (req, reply) => {
    const rows = await db.select().from(alertEvents).where(eq(alertEvents.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Event not found' })

    const ackedAt = new Date().toISOString()
    await db.update(alertEvents)
      .set({ status: 'acknowledged', ackedAt })
      .where(eq(alertEvents.id, req.params.id))

    return { id: req.params.id, status: 'acknowledged', ackedAt }
  })

  // POST /api/alerts/events/:id/snooze
  app.post<{
    Params: { id: string }
    Body:   { minutes: number }
  }>('/events/:id/snooze', async (req, reply) => {
    const { minutes } = req.body
    if (!minutes || minutes < 1 || minutes > 1440) {
      return reply.status(400).send({ error: 'minutes must be 1–1440' })
    }

    const rows = await db.select().from(alertEvents).where(eq(alertEvents.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Event not found' })

    const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString()
    await db.update(alertEvents)
      .set({ status: 'snoozed', snoozedUntil })
      .where(eq(alertEvents.id, req.params.id))

    return { id: req.params.id, status: 'snoozed', snoozedUntil }
  })

  // POST /api/alerts/events/:id/resolve
  app.post<{ Params: { id: string } }>('/events/:id/resolve', async (req, reply) => {
    const rows = await db.select().from(alertEvents).where(eq(alertEvents.id, req.params.id))
    if (!rows[0]) return reply.status(404).send({ error: 'Event not found' })

    const resolvedAt = new Date().toISOString()
    await db.update(alertEvents)
      .set({ status: 'resolved', resolvedAt })
      .where(eq(alertEvents.id, req.params.id))

    return { id: req.params.id, status: 'resolved', resolvedAt }
  })
}
