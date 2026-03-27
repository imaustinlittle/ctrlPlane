import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboards — list all dashboards
  app.get('/', async () => {
    return {
      dashboards: [
        {
          id: 'default',
          name: 'Overview',
          isDefault: true,
          pageCount: 2,
          updatedAt: new Date().toISOString(),
        },
      ],
    }
  })

  // GET /api/dashboards/:id — get full dashboard with pages + layouts
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params
    if (id !== 'default') return reply.status(404).send({ error: 'Not found' })
    return {
      id: 'default',
      name: 'Overview',
      isDefault: true,
      pages: [
        { id: 'overview', name: 'Overview', icon: '⬡', sortOrder: 0 },
        { id: 'media',    name: 'Media',    icon: '🎬', sortOrder: 1 },
      ],
      updatedAt: new Date().toISOString(),
    }
  })

  // POST /api/dashboards — create dashboard
  app.post<{ Body: { name: string } }>('/', async (req) => {
    const { name } = req.body
    return {
      id: randomUUID(),
      name,
      isDefault: false,
      pages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  // PUT /api/dashboards/:id — update dashboard metadata
  app.put<{ Params: { id: string }; Body: { name?: string; themeOverrides?: unknown } }>(
    '/:id',
    async (req) => {
      return { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() }
    }
  )

  // POST /api/dashboards/:id/export — export config as JSON
  app.post<{ Params: { id: string } }>('/:id/export', async (req, reply) => {
    reply.header('Content-Disposition', `attachment; filename="dashboard-${req.params.id}.json"`)
    reply.header('Content-Type', 'application/json')
    return JSON.stringify({ exportedAt: new Date().toISOString(), version: '1', id: req.params.id })
  })

  // POST /api/dashboards/:id/pages — add page to dashboard
  app.post<{
    Params: { id: string }
    Body: { name: string; icon?: string }
  }>('/:id/pages', async (req) => {
    return {
      id: randomUUID(),
      dashboardId: req.params.id,
      name: req.body.name,
      icon: req.body.icon ?? '📄',
      sortOrder: 99,
      layoutJson: '[]',
    }
  })

  // PUT /api/dashboards/:dashId/pages/:pageId/layout — save drag/drop layout
  app.put<{
    Params: { dashId: string; pageId: string }
    Body: { layout: unknown[] }
  }>('/:dashId/pages/:pageId/layout', async (req) => {
    // In production: persist to DB
    return { ok: true, pageId: req.params.pageId, itemCount: req.body.layout.length }
  })
}
