import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IntegrationState<T> {
  data:        T | null
  loading:     boolean
  error:       string | null
  configured:  boolean   // false = integration not set up yet
  refetch:     () => void
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// Simple in-memory cache so multiple widgets using the same integration
// endpoint don't make duplicate requests
interface CacheEntry {
  data:      unknown
  fetchedAt: number
}
const cache = new Map<string, CacheEntry>()
const TTL   = 10_000  // 10s — how long before re-fetching

// ── useIntegration ────────────────────────────────────────────────────────────
// Primary hook for widget authors. Fetches from a normalized API endpoint.
//
// Usage in a widget:
//   const { data, loading, error, configured } = useIntegration<ContainerInfo[]>(
//     'docker/containers',
//     { refreshMs: 5000 }
//   )
//
// The endpoint is relative to /api/integrations/ — so 'docker/containers'
// becomes GET /api/integrations/docker/containers.
//
// If the integration isn't configured, `configured` is false and the widget
// can render a helpful "Not configured" state rather than an error.

export function useIntegration<T>(
  endpoint: string,
  options: {
    refreshMs?: number   // auto-refresh interval in ms (default: 0 = no auto-refresh)
    enabled?:   boolean  // set false to skip fetching (default: true)
  } = {}
): IntegrationState<T> {
  const { refreshMs = 0, enabled = true } = options

  const [data,       setData]       = useState<T | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async (signal: AbortSignal) => {
    const url    = `/api/integrations/${endpoint}`
    const cached = cache.get(url)

    // Serve from cache if fresh
    if (cached && Date.now() - cached.fetchedAt < TTL) {
      setData(cached.data as T)
      setLoading(false)
      setError(null)
      setConfigured(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(url, { signal })

      if (res.status === 503 || res.status === 404) {
        // Integration not configured
        setConfigured(false)
        setData(null)
        setError(null)
        setLoading(false)
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      const json = await res.json() as T
      cache.set(url, { data: json, fetchedAt: Date.now() })
      setData(json)
      setConfigured(true)
      setError(null)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  const refetch = useCallback(() => {
    // Bust cache for this endpoint and re-fetch
    cache.delete(`/api/integrations/${endpoint}`)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetch_(ctrl.signal)
  }, [endpoint, fetch_])

  useEffect(() => {
    if (!enabled) return

    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetch_(ctrl.signal)

    let timer: ReturnType<typeof setInterval> | null = null
    if (refreshMs > 0) {
      timer = setInterval(() => {
        const c = new AbortController()
        abortRef.current = c
        fetch_(c.signal)
      }, refreshMs)
    }

    return () => {
      ctrl.abort()
      if (timer) clearInterval(timer)
    }
  }, [endpoint, refreshMs, enabled, fetch_])

  return { data, loading, error, configured, refetch }
}

// ── NotConfigured ─────────────────────────────────────────────────────────────
// Reusable component widget authors can render when configured === false
export function NotConfigured({ name }: { name: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 16, textAlign: 'center',
    }}>
      <span style={{ fontSize: 24 }}>🔌</span>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)' }}>
        {name} not configured
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
        Add your connection details in<br />
        <strong style={{ color: 'var(--accent)' }}>Edit → Integrations</strong>
      </div>
    </div>
  )
}

// ── IntegrationError ──────────────────────────────────────────────────────────
export function IntegrationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 16, textAlign: 'center',
    }}>
      <span style={{ fontSize: 24 }}>⚠️</span>
      <div style={{ fontSize: 12, color: 'var(--accent-r)', fontFamily: "'JetBrains Mono', monospace", maxWidth: 200, wordBreak: 'break-word' }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          marginTop: 4, padding: '4px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'none',
          color: 'var(--text2)', cursor: 'pointer', fontSize: 12,
          fontFamily: 'inherit',
        }}
      >Retry</button>
    </div>
  )
}
