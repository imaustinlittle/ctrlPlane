import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// In-memory subscriber map: sessionId → reply object
// Production: replace with Redis pub/sub subscriptions
const subscribers = new Map<string, FastifyReply>()

export async function streamRoutes(app: FastifyInstance) {
  // GET /api/stream  — SSE endpoint, one connection per browser tab
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = (req.query as Record<string, string>).session ?? crypto.randomUUID()

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',       // Disable nginx buffering
    })

    // Register subscriber
    subscribers.set(sessionId, reply)
    app.log.info({ sessionId }, 'SSE client connected')

    // Send initial connection confirmation
    sendEvent(reply, 'connected', { sessionId, ts: new Date().toISOString() })

    // Heartbeat every 25s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      if (reply.raw.destroyed) {
        clearInterval(heartbeat)
        subscribers.delete(sessionId)
        return
      }
      reply.raw.write(': heartbeat\n\n')
    }, 25_000)

    // Start sending mock live data
    const dataInterval = startMockDataStream(reply)

    // Cleanup on disconnect
    req.raw.on('close', () => {
      clearInterval(heartbeat)
      clearInterval(dataInterval)
      subscribers.delete(sessionId)
      app.log.info({ sessionId }, 'SSE client disconnected')
    })

    // Keep the handler alive (don't resolve the promise)
    await new Promise<void>(resolve => req.raw.on('close', resolve))
  })
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sendEvent(reply: FastifyReply, event: string, data: unknown) {
  if (reply.raw.destroyed) return
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Broadcast to all connected subscribers (used by worker layer in production)
export function broadcast(event: string, data: unknown) {
  for (const reply of subscribers.values()) {
    sendEvent(reply, event, data)
  }
}

// ── Mock live data stream ─────────────────────────────────────────────────────
// In production this is replaced by Redis pub/sub publishing from BullMQ workers

function drift(v: number, min: number, max: number, speed: number) {
  return Math.max(min, Math.min(max, v + (Math.random() - 0.5) * speed))
}

function startMockDataStream(reply: FastifyReply): ReturnType<typeof setInterval> {
  let cpu  = 42
  let ram  = 75
  let temp = 52
  let upMbps   = 12
  let downMbps = 85

  return setInterval(() => {
    if (reply.raw.destroyed) return

    cpu      = drift(cpu,      8,  95,  8)
    ram      = drift(ram,      60, 90,  2)
    temp     = drift(temp,     38, 82,  1.5)
    upMbps   = drift(upMbps,   0.5, 120, 15)
    downMbps = drift(downMbps, 1,  400, 30)

    // widget:data event — widgets subscribe by widgetId
    sendEvent(reply, 'widget:data', {
      widgetId: 'cpu',
      data: { cpu: Math.round(cpu), uptime: 1_847_392 },
      ts: new Date().toISOString(),
    })

    sendEvent(reply, 'widget:data', {
      widgetId: 'ram',
      data: { ram: Math.round(ram), ramUsedGb: parseFloat(((ram / 100) * 64).toFixed(1)), ramTotalGb: 64 },
      ts: new Date().toISOString(),
    })

    sendEvent(reply, 'widget:data', {
      widgetId: 'temp',
      data: { temp: Math.round(temp), fanRpm: Math.round(drift(1200, 800, 2400, 60)) },
      ts: new Date().toISOString(),
    })

    sendEvent(reply, 'widget:data', {
      widgetId: 'network',
      data: {
        uploadMbps:   parseFloat(upMbps.toFixed(1)),
        downloadMbps: parseFloat(downMbps.toFixed(1)),
        latencyMs:    parseFloat(drift(4.2, 1, 45, 2).toFixed(1)),
      },
      ts: new Date().toISOString(),
    })
  }, 2000)
}
