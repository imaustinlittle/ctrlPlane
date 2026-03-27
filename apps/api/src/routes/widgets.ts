import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import IORedis from 'ioredis'
import { ENV } from '../lib/env.js'

// Shared Redis client for reading worker-cached widget data
let redis: IORedis | null = null

function getRedis() {
  if (!redis) {
    const parsed = new URL(ENV.REDIS_URL.replace('redis://', 'http://'))
    redis = new IORedis({ host: parsed.hostname, port: parseInt(parsed.port || '6379'), lazyConnect: true })
    redis.on('error', () => { /* handled at worker level */ })
  }
  return redis
}

export async function widgetRoutes(app: FastifyInstance) {

  // GET /api/widgets/types — available widget type definitions
  app.get('/types', async () => ({
    widgets: [
      { type: 'clock',      displayName: 'World Clock',     category: 'general',    icon: '🕐', defaultW: 3, defaultH: 3 },
      { type: 'weather',    displayName: 'Weather',         category: 'general',    icon: '🌤', defaultW: 3, defaultH: 3 },
      { type: 'gauge',      displayName: 'Gauge',           category: 'system',     icon: '⚡', defaultW: 2, defaultH: 3 },
      { type: 'services',   displayName: 'Service Status',  category: 'monitoring', icon: '📡', defaultW: 4, defaultH: 5 },
      { type: 'alerts',     displayName: 'Alert Center',    category: 'monitoring', icon: '🔔', defaultW: 4, defaultH: 5 },
      { type: 'containers', displayName: 'Containers',      category: 'system',     icon: '🐳', defaultW: 4, defaultH: 5 },
      { type: 'storage',    displayName: 'Storage',         category: 'system',     icon: '💾', defaultW: 4, defaultH: 4 },
      { type: 'network',    displayName: 'Network',         category: 'network',    icon: '📶', defaultW: 4, defaultH: 4 },
      { type: 'links',      displayName: 'Quick Links',     category: 'general',    icon: '🔗', defaultW: 4, defaultH: 4 },
    ],
  }))

  // GET /api/widgets/:integrationId/:widgetType/data — cached data from worker
  app.get<{
    Params: { integrationId: string; widgetType: string }
  }>('/:integrationId/:widgetType/data', async (req, reply) => {
    try {
      const client   = getRedis()
      const cacheKey = `widget:${req.params.integrationId}:${req.params.widgetType}`
      const cached   = await client.get(cacheKey)

      if (!cached) {
        return reply.status(404).send({ data: null, lastUpdated: null, message: 'No data cached yet — polling may still be starting up' })
      }

      return JSON.parse(cached) as { data: unknown; lastUpdated: string }
    } catch (err) {
      app.log.warn({ err }, 'Redis unavailable for widget data lookup')
      return reply.status(503).send({ data: null, lastUpdated: null, message: 'Cache unavailable' })
    }
  })

  // POST /api/widgets — create widget on a page
  app.post<{
    Body: {
      pageId:   string
      type:     string
      config:   Record<string, unknown>
      position: { x: number; y: number; w: number; h: number }
    }
  }>('/', async (req) => ({
    id: randomUUID(),
    ...req.body,
    createdAt: new Date().toISOString(),
  }))

  // PUT /api/widgets/:id — update widget config
  app.put<{
    Params: { id: string }
    Body:   { config?: Record<string, unknown>; position?: unknown }
  }>('/:id', async (req) => ({
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  }))

  // DELETE /api/widgets/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req) => ({
    ok: true, id: req.params.id,
  }))

  // POST /api/widgets/:id/action — trigger a widget action
  app.post<{
    Params: { id: string }
    Body:   { action: string; params?: unknown }
  }>('/:id/action', async (req, reply) => {
    const ALLOWED = ['refresh', 'restart_container', 'trigger_automation']
    if (!ALLOWED.includes(req.body.action)) {
      return reply.status(400).send({ error: `Unknown action: ${req.body.action}` })
    }
    return {
      ok:       true,
      action:   req.body.action,
      widgetId: req.params.id,
      queuedAt: new Date().toISOString(),
    }
  })
}
