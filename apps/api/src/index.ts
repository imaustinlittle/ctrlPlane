import Fastify from 'fastify'
import cors from '@fastify/cors'
import { dashboardRoutes } from './routes/dashboards.js'
import { widgetRoutes } from './routes/widgets.js'
import { integrationRoutes } from './routes/integrations.js'  // now handles real proxy + config
import { alertRoutes } from './routes/alerts.js'
import { actionRoutes } from './routes/actions.js'
import { streamRoutes } from './routes/stream.js'
import { systemRoutes } from './routes/system.js'
import { stateRoutes }  from './routes/state.js'

const PORT = parseInt(process.env.PORT ?? '3001')
const HOST = process.env.HOST ?? '0.0.0.0'

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // ── CORS ────────────────────────────────────────────────────────────────
  await app.register(cors, {
    // '*' or unset = allow all origins (self-hosted LAN use case)
    // Set CORS_ORIGIN env var to a specific URL to restrict
    origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN ?? true),
    credentials: true,
  })

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  // ── Routes ───────────────────────────────────────────────────────────────
  await app.register(dashboardRoutes,  { prefix: '/api/dashboards' })
  await app.register(widgetRoutes,     { prefix: '/api/widgets' })
  await app.register(integrationRoutes,{ prefix: '/api/integrations' })
  await app.register(alertRoutes,      { prefix: '/api/alerts' })
  await app.register(actionRoutes,     { prefix: '/api/actions' })
  await app.register(streamRoutes,     { prefix: '/api/stream' })
  await app.register(systemRoutes,     { prefix: '/api/system' })
  await app.register(stateRoutes,      { prefix: '/api/state' })

  // ── Start ────────────────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST })
  console.log(`🚀  API running on http://${HOST}:${PORT}`)
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
