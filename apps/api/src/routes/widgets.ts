import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

export async function widgetRoutes(app: FastifyInstance) {
  // GET /api/widgets/types — list all available widget types from registry
  app.get('/types', async () => {
    return {
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
    }
  })

  // GET /api/widgets/:id/data — fetch latest cached data for a widget
  app.get<{ Params: { id: string } }>('/:id/data', async (_req) => {
    // In production: return cached snapshot from Redis/DB
    return { data: null, lastUpdated: null }
  })

  // POST /api/widgets — create widget on a page
  app.post<{
    Body: {
      pageId: string
      type: string
      config: Record<string, unknown>
      position: { x: number; y: number; w: number; h: number }
    }
  }>('/', async (req) => {
    return {
      id: randomUUID(),
      ...req.body,
      createdAt: new Date().toISOString(),
    }
  })

  // PUT /api/widgets/:id — update widget config
  app.put<{
    Params: { id: string }
    Body: { config?: Record<string, unknown>; position?: unknown }
  }>('/:id', async (req) => {
    return { id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }
  })

  // DELETE /api/widgets/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req) => {
    return { ok: true, id: req.params.id }
  })

  // POST /api/widgets/:id/action — trigger a widget action (restart, refresh, etc.)
  app.post<{
    Params: { id: string }
    Body: { action: string; params?: unknown }
  }>('/:id/action', async (req, reply) => {
    const { action } = req.body
    const ALLOWED = ['refresh', 'restart_container', 'trigger_automation']
    if (!ALLOWED.includes(action)) {
      return reply.status(400).send({ error: `Unknown action: ${action}` })
    }
    // In production: queue the action via BullMQ with confirmation check
    return {
      ok: true,
      action,
      widgetId: req.params.id,
      queuedAt: new Date().toISOString(),
    }
  })
}
