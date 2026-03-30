import { useState, useEffect } from 'react'

export interface AlertRule {
  id:            string
  integrationId: string | null
  name:          string
  conditionExpr: string
  severity:      'critical' | 'warning' | 'info'
  cooldownSec:   number
  enabled:       boolean
  createdAt:     string
}

export interface AlertEvent {
  id:           string
  ruleId:       string
  ruleName:     string
  severity:     'critical' | 'warning' | 'info'
  status:       'firing' | 'resolved' | 'acknowledged' | 'snoozed'
  message:      string | null
  firedAt:      string
  resolvedAt:   string | null
  ackedAt:      string | null
  snoozedUntil: string | null
}

// ── Module-level store ────────────────────────────────────────────────────────

interface Store {
  events:  AlertEvent[]
  loading: boolean
  error:   string | null
  timer:   ReturnType<typeof setTimeout> | null
  subs:    Set<() => void>
}

const store: Store = {
  events:  [],
  loading: true,
  error:   null,
  timer:   null,
  subs:    new Set(),
}

async function tick() {
  try {
    const res = await fetch('/api/alerts/events?limit=50')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as { events: AlertEvent[] }
    store.events  = json.events
    store.error   = null
    store.loading = false
  } catch (e) {
    store.error   = (e as Error).message
    store.loading = false
  }
  store.subs.forEach(fn => fn())
  if (store.subs.size > 0) {
    store.timer = setTimeout(tick, 30_000)
  }
}

function subscribe(cb: () => void): () => void {
  const wasEmpty = store.subs.size === 0
  store.subs.add(cb)
  if (wasEmpty) tick()
  return () => {
    store.subs.delete(cb)
    if (store.subs.size === 0 && store.timer !== null) {
      clearTimeout(store.timer)
      store.timer = null
    }
  }
}

export function refreshAlerts() {
  if (store.timer !== null) { clearTimeout(store.timer); store.timer = null }
  tick()
}

// ── API actions ───────────────────────────────────────────────────────────────

export async function ackAlertEvent(id: string): Promise<void> {
  await fetch(`/api/alerts/events/${id}/ack`, { method: 'POST' })
  refreshAlerts()
}

export async function resolveAlertEvent(id: string): Promise<void> {
  await fetch(`/api/alerts/events/${id}/resolve`, { method: 'POST' })
  refreshAlerts()
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAlertData() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1))
  }, [])

  return {
    events:  store.events,
    loading: store.loading,
    error:   store.error,
  }
}
