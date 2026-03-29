import { useState, useEffect } from 'react'

export interface NetworkPoint { ts: number; up: number; down: number }

const MAX_HISTORY = 240

// ── Module-level store, keyed by interface name ────────────────────────────────
// Survives tab switches — the rAF draw loop reconnects to existing history.

interface Entry {
  latest:  { up: number; down: number }
  history: NetworkPoint[]
  error:   string | null
  loading: boolean
  timer:   ReturnType<typeof setTimeout> | null
  subs:    Set<() => void>
}

const store = new Map<string, Entry>()

function getOrCreate(iface: string): Entry {
  if (!store.has(iface)) {
    store.set(iface, {
      latest: { up: 0, down: 0 },
      history: [],
      error:   null,
      loading: true,
      timer:   null,
      subs:    new Set(),
    })
  }
  return store.get(iface)!
}

async function tick(iface: string) {
  const entry = getOrCreate(iface)
  try {
    const res = await fetch(`/api/system/network?iface=${encodeURIComponent(iface)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const d = (await res.json()) as { uploadMbps: number; downloadMbps: number }
    const point: NetworkPoint = { ts: Date.now(), up: d.uploadMbps, down: d.downloadMbps }
    entry.latest  = { up: d.uploadMbps, down: d.downloadMbps }
    entry.history = [...entry.history, point].slice(-MAX_HISTORY)
    entry.error   = null
    entry.loading = false
  } catch (e) {
    entry.error   = (e as Error).message
    entry.loading = false
  }
  entry.subs.forEach(fn => fn())
  if (entry.subs.size > 0) {
    // ~2s cadence: API takes ~1s to measure, then 1s gap
    entry.timer = setTimeout(() => tick(iface), 1_000)
  }
}

function subscribe(iface: string, cb: () => void): () => void {
  const entry    = getOrCreate(iface)
  const wasEmpty = entry.subs.size === 0
  entry.subs.add(cb)
  if (wasEmpty) tick(iface)
  return () => {
    entry.subs.delete(cb)
    if (entry.subs.size === 0 && entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
  }
}

export function useNetworkData(iface: string) {
  const entry = getOrCreate(iface)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(iface, () => forceUpdate(n => n + 1))
  }, [iface])

  return {
    latest:  entry.latest,
    history: entry.history,
    error:   entry.error,
    loading: entry.loading,
  }
}
