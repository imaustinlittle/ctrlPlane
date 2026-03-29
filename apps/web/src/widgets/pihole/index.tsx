import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/pi-hole.svg'

interface PiholeConfig { url?: string; apiKey?: string }
interface Stats { queriesToday: number; blockedToday: number; blockedPct: number; domainsBlocked: number; status: string }

async function proxyGet(url: string) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const j = await r.json() as { status: number; data: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  if (j.status >= 400) throw new Error(`HTTP ${j.status}`)
  return j.data
}

function PiholeWidget({ config }: WidgetProps<PiholeConfig>) {
  const { url, apiKey } = config ?? {}
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url || !apiKey) { setLoading(false); return }
    let cancelled = false
    const base = url.replace(/\/$/, '')
    const load = async () => {
      try {
        const data = await proxyGet(`${base}/admin/api.php?summaryRaw&auth=${apiKey}`) as {
          dns_queries_today: number
          ads_blocked_today: number
          ads_percentage_today: number
          domains_being_blocked: number
          status: string
        }
        if (cancelled) return
        setStats({
          queriesToday:   data.dns_queries_today,
          blockedToday:   data.ads_blocked_today,
          blockedPct:     data.ads_percentage_today,
          domainsBlocked: data.domains_being_blocked,
          status:         data.status,
        })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, apiKey])

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Pi-hole</span>
        {stats && (
          <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500, color: stats.status === 'enabled' ? 'var(--accent-g)' : 'var(--accent-r)' }}>
            {stats.status === 'enabled' ? 'Active' : 'Disabled'}
          </span>
        )}
      </div>

      {!url || !apiKey ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a Pi-hole URL and API token in widget settings.
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
              { label: 'Queries Today',  value: stats.queriesToday.toLocaleString(), color: 'var(--text)' },
              { label: 'Blocked',        value: stats.blockedToday.toLocaleString(), color: 'var(--accent-r)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Block Rate',      value: `${stats.blockedPct.toFixed(1)}%`, color: 'var(--accent-y)' },
              { label: 'Domains Blocked', value: stats.domainsBlocked.toLocaleString(), color: 'var(--text2)' },
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

export const piholeWidget: WidgetDefinition = {
  type: 'pihole', displayName: 'Pi-hole', category: 'network',
  description: 'DNS queries blocked and block rate',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: PiholeWidget,
}
