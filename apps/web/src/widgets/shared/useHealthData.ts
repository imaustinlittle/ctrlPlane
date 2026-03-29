import { useReducer, useEffect } from 'react'

export interface HealthData {
  cpu:    { usage: number; cores: number; model?: string }
  memory: { percent: number; usedGb: number; totalGb: number }
  tempC:  number | null
}

// ── Module-level shared state ──────────────────────────────────────────────────
// No matter how many widgets call useHealthData(), there is only ONE fetch loop.

let cache:  HealthData | null = null
let err:    string | null     = null
let timer:  ReturnType<typeof setTimeout> | null = null
const subs  = new Set<() => void>()

function notify() { subs.forEach(fn => fn()) }

async function tick() {
  try {
    const res = await fetch('/api/system/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    cache = (await res.json()) as HealthData
    err   = null
  } catch (e) {
    err = (e as Error).message
  }
  notify()
  if (subs.size > 0) timer = setTimeout(tick, 5_000)
}

function subscribe(cb: () => void): () => void {
  const wasEmpty = subs.size === 0
  subs.add(cb)
  if (wasEmpty) tick()   // kick off polling when the first subscriber joins
  return () => {
    subs.delete(cb)
    if (subs.size === 0 && timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/** Subscribe to live system health data. One shared fetch loop for all callers. */
export function useHealthData() {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribe(forceUpdate), [])
  return {
    data:    cache,
    error:   err,
    loading: cache === null && err === null,
  }
}
