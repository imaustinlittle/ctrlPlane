/**
 * ControlPlane Background Worker
 * Handles scheduled polling, alert evaluation, and notification dispatch.
 * Powered by BullMQ (Redis-backed job queue).
 *
 * This is a stub — full implementation coming in the next phase.
 */

console.log('🔧  ControlPlane worker starting...')
console.log('   Redis:', process.env.REDIS_URL ?? 'redis://redis:6379')
console.log('   DB:   ', process.env.DATABASE_URL ? '[set]' : '[not set]')

// Keep the process alive
setInterval(() => {
  // In production: run BullMQ workers for:
  //   - Integration polling jobs
  //   - Alert rule evaluation
  //   - Notification dispatch
  //   - Metric snapshot cleanup
}, 30_000)

console.log('✅  Worker running (stub mode — no jobs scheduled yet)')
