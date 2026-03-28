import './lib/env.js'  // Validate env vars before anything else
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { dashboardRoutes }   from './routes/dashboards.js'
import { widgetRoutes }      from './routes/widgets.js'
import { integrationRoutes } from './routes/integrations.js'
import { alertRoutes }       from './routes/alerts.js'
import { actionRoutes }      from './routes/actions.js'
import { streamRoutes }      from './routes/stream.js'
import { systemRoutes }      from './routes/system.js'
import { stateRoutes }       from './routes/state.js'
import { initDb }                    from './db/index.js'
import { loadIntegrationRegistry }  from './integrations/loader.js'
import { ENV }               from './lib/env.js'

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: ENV.LOG_LEVEL,
      transport: ENV.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // ── Integration registry ─────────────────────────────────────────────────────
  await loadIntegrationRegistry()

  // ── Database init ────────────────────────────────────────────────────────────
  await initDb()
  app.log.info('Database tables initialised')

  // ── CORS ────────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin:      ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN,
    credentials: true,
  })

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Routes ───────────────────────────────────────────────────────────────────
  await app.register(dashboardRoutes,   { prefix: '/api/dashboards' })
  await app.register(widgetRoutes,      { prefix: '/api/widgets' })
  await app.register(integrationRoutes, { prefix: '/api/integrations' })
  await app.register(alertRoutes,       { prefix: '/api/alerts' })
  await app.register(actionRoutes,      { prefix: '/api/actions' })
  await app.register(streamRoutes,      { prefix: '/api/stream' })
  await app.register(systemRoutes,      { prefix: '/api/system' })
  await app.register(stateRoutes,       { prefix: '/api/state' })

  // ── Start ────────────────────────────────────────────────────────────────────
  await app.listen({ port: ENV.PORT, host: ENV.HOST })
  console.log(`🚀  API running on http://${ENV.HOST}:${ENV.PORT}`)
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
