import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface UrlItem { name: string; url: string; emoji: string }
interface ServiceState { name: string; emoji: string; status: 'up' | 'down' | 'warn' | 'checking'; pingMs?: number }

function skeletonRow(key: number) {
  return (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface2)', flexShrink: 0 }} />
      <div style={{ flex: 1, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ width: 44, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

function ServicesWidget({ config }: WidgetProps) {
  const services = (config?.services as UrlItem[] | undefined) ?? []
  const [statuses, setStatuses] = useState<ServiceState[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (services.length === 0) { setStatuses([]); return }

    setStatuses(services.map(s => ({ name: s.name, emoji: s.emoji, status: 'checking' })))
    setChecking(true)

    let cancelled = false

    // Ping directly from the browser using no-cors mode.
    // - no-cors bypasses CORS restrictions: the browser makes the request but
    //   returns an opaque response (status 0). The promise resolves if the server
    //   responds with anything, and rejects only if the host is truly unreachable.
    // - This avoids Docker networking issues that affect server-side pinging.
    Promise.all(
      services.map(async (svc, i) => {
        const start = Date.now()
        try {
          await fetch(svc.url, { mode: 'no-cors', signal: AbortSignal.timeout(5_000) })
          // Resolved → server responded (opaque — no status code available)
          if (cancelled) return
          setStatuses(prev => {
            const next = [...prev]
            next[i] = { name: svc.name, emoji: svc.emoji, status: 'up', pingMs: Date.now() - start }
            return next
          })
        } catch {
          // Rejected → server unreachable
          if (cancelled) return
          setStatuses(prev => {
            const next = [...prev]
            next[i] = { name: svc.name, emoji: svc.emoji, status: 'down' }
            return next
          })
        }
      })
    ).finally(() => { if (!cancelled) setChecking(false) })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(services)])

  if (services.length === 0) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16 }}>
        <span style={{ fontSize: 22 }}>📡</span>
        <span>No services configured</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>Click ··· to add services</span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ padding: '8px 14px 12px', overflowY: 'auto' }}>
      {checking && statuses.every(s => s.status === 'checking') ? (
        [0, 1, 2, 3].map(skeletonRow)
      ) : (
        statuses.map((svc) => (
          <div
            key={svc.name}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}
          >
            {svc.emoji ? (
              <span style={{ fontSize: 14, flexShrink: 0 }}>{svc.emoji}</span>
            ) : (
              <span className={`status-dot ${svc.status === 'checking' ? 'warn' : svc.status}`} />
            )}
            <span style={{ flex: 1, color: 'var(--text)' }}>{svc.name}</span>
            <span style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: svc.status === 'up' ? 'var(--accent-g)' : svc.status === 'down' ? 'var(--accent-r)' : 'var(--text2)',
            }}>
              {svc.status === 'checking' ? '…' : svc.status === 'up' ? 'online' : svc.status === 'down' ? 'offline' : 'degraded'}
            </span>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)', minWidth: 44, textAlign: 'right' }}>
              {svc.pingMs != null ? `${svc.pingMs}ms` : '—'}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

export const servicesWidget: WidgetDefinition = {
  type: 'services',
  displayName: 'Service Status',
  description: 'Live status for your self-hosted services',
  icon: '📡',
  category: 'monitoring',
  defaultW: 4,
  defaultH: 5,
  minW: 2,
  minH: 3,
  component: ServicesWidget,
}
