import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'

// Actions that require an extra confirmation flag in the request body
const DANGEROUS_ACTIONS = new Set([
  'restart_container',
  'stop_container',
  'stop_vm',
  'restart_vm',
  'clear_download_queue',
  'restart_service',
])

interface ActionRequest {
  type:      string
  target?:   string
  params?:   Record<string, unknown>
  confirmed?: boolean  // must be true for dangerous actions
}

export async function actionRoutes(app: FastifyInstance) {
  // POST /api/actions/execute
  app.post<{ Body: ActionRequest }>('/execute', async (req, reply) => {
    const { type, target, params, confirmed } = req.body

    // Reject unknown action types
    const KNOWN = [
      'restart_container', 'stop_container', 'start_container',
      'restart_vm', 'stop_vm', 'start_vm',
      'trigger_webhook', 'trigger_ha_automation',
      'clear_download_queue', 'restart_service',
      'send_test_notification',
    ]
    if (!KNOWN.includes(type)) {
      return reply.status(400).send({ error: `Unknown action type: ${type}` })
    }

    // Require explicit confirmation for destructive actions
    if (DANGEROUS_ACTIONS.has(type) && !confirmed) {
      return reply.status(202).send({
        requiresConfirmation: true,
        action: type,
        target,
        message: `This action (${type}) is destructive. Send again with confirmed: true to proceed.`,
      })
    }

    const auditId = randomUUID()

    // In production: dispatch to BullMQ worker, write audit log to DB
    // For now: simulate execution
    const result = await simulateAction(type, target, params)

    return {
      ok:        result.ok,
      auditId,
      action:    type,
      target,
      message:   result.message,
      executedAt: new Date().toISOString(),
    }
  })

  // GET /api/actions/audit — recent action audit log
  app.get<{ Querystring: { limit?: string } }>('/audit', async (req) => {
    const limit = parseInt(req.query.limit ?? '50')
    // In production: query audit_logs table
    return { entries: [], total: 0, limit }
  })
}

async function simulateAction(
  type:    string,
  target?: string,
  _params?: Record<string, unknown>
): Promise<{ ok: boolean; message: string }> {
  // Simulated responses — replace with real integration calls
  await new Promise(r => setTimeout(r, 120))

  switch (type) {
    case 'restart_container':
      return { ok: true,  message: `Container '${target}' restart signal sent` }
    case 'stop_container':
      return { ok: true,  message: `Container '${target}' stopped` }
    case 'start_container':
      return { ok: true,  message: `Container '${target}' started` }
    case 'restart_vm':
      return { ok: true,  message: `VM '${target}' restart initiated` }
    case 'trigger_webhook':
      return { ok: true,  message: `Webhook dispatched to ${target}` }
    case 'trigger_ha_automation':
      return { ok: true,  message: `Automation '${target}' triggered` }
    case 'clear_download_queue':
      return { ok: true,  message: 'Download queue cleared' }
    case 'send_test_notification':
      return { ok: true,  message: 'Test notification sent' }
    default:
      return { ok: false, message: `Unhandled action: ${type}` }
  }
}
