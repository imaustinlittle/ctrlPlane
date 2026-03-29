import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/adguard-home.svg'

interface AdGuardConfig { url?: string; username?: string; password?: string }
interface Stats { queries: number; blocked: number; blockedPct: number; avgMs: number; running: boolean }

async function proxyGet(url: string, auth: string) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headers: { Authorization: auth } }),
  })
  const j = await r.json() as { status: number; data: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  if (j.status >= 400) throw new Error(`HTTP ${j.status}`)
  return j.data
}

function AdGuardWidget({ config }: WidgetProps<AdGuardConfig>) {
  const { url, username = 'admin', password } = config ?? {}
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url || !password) { setLoading(false); return }
    let cancelled = false
    const base = url.replace(/\/$/, '')
    const auth = `Basic ${btoa(`${username}:${password}`)}`
    const load = async () => {
      try {
        const [statusRes, statsRes] = await Promise.all([
          proxyGet(`${base}/control/status`, auth),
          proxyGet(`${base}/control/stats`, auth),
        ])
        if (cancelled) return
        const st = statusRes as { running: boolean }
        const s  = statsRes  as { num_dns_queries: number; num_blocked_filtering: number; avg_processing_time: number }
        const pct = s.num_dns_queries > 0 ? (s.num_blocked_filtering / s.num_dns_queries) * 100 : 0
        setStats({ queries: s.num_dns_queries, blocked: s.num_blocked_filtering, blockedPct: pct, avgMs: s.avg_processing_time, running: st.running })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, username, password])

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>AdGuard Home</span>
        {stats !== null && (
          <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500, color: stats.running ? 'var(--accent-g)' : 'var(--accent-r)' }}>
            {stats.running ? 'Running' : 'Stopped'}
          </span>
        )}
      </div>

      {!url || !password ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure an AdGuard Home URL, username, and password in widget settings.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-r)', fontSize: 11 }}>⚠ {error}</div>
      ) : stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'DNS Queries', value: stats.queries.toLocaleString(), color: 'var(--text)' },
              { label: 'Blocked',     value: stats.blocked.toLocaleString(), color: 'var(--accent-r)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Block Rate', value: `${stats.blockedPct.toFixed(1)}%`,   color: 'var(--accent-y)' },
              { label: 'Avg Latency', value: `${(stats.avgMs * 1000).toFixed(1)} ms`, color: 'var(--text2)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const adguardhomeWidget: WidgetDefinition = {
  type: 'adguardhome', displayName: 'AdGuard Home', category: 'network',
  description: 'DNS query stats and block rate',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: AdGuardWidget,
}
