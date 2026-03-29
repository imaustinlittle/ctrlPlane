import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/opnsense.svg'

interface OPNsenseConfig { url?: string; apiKey?: string; apiSecret?: string }
interface Stats { version: string; gatewaysOnline: number; gatewaysTotal: number }

async function proxyGet(url: string, apiKey: string, apiSecret: string) {
  const auth = `Basic ${btoa(`${apiKey}:${apiSecret}`)}`
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

function OPNsenseWidget({ config }: WidgetProps<OPNsenseConfig>) {
  const { url, apiKey, apiSecret } = config ?? {}
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url || !apiKey || !apiSecret) { setLoading(false); return }
    let cancelled = false
    const base = url.replace(/\/$/, '')
    const load = async () => {
      try {
        const [fwRes, gwRes] = await Promise.all([
          proxyGet(`${base}/api/core/firmware/status`, apiKey, apiSecret),
          proxyGet(`${base}/api/routes/gateway/status`, apiKey, apiSecret),
        ])
        if (cancelled) return
        const fw = fwRes as { product_version?: string; last_check?: string }
        const gw = gwRes as { items?: Array<{ status: string }> }
        const items = gw.items ?? []
        setStats({
          version: fw.product_version ?? '—',
          gatewaysOnline: items.filter(g => g.status === 'online').length,
          gatewaysTotal:  items.length,
        })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, apiKey, apiSecret])

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>OPNsense</span>
        {stats && <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>v{stats.version}</span>}
      </div>

      {!url || !apiKey || !apiSecret ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure OPNsense URL, API key, and API secret in widget settings.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-r)', fontSize: 11 }}>⚠ {error}</div>
      ) : stats && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Version',  value: stats.version, color: 'var(--accent)' },
            { label: 'Gateways', value: `${stats.gatewaysOnline}/${stats.gatewaysTotal}`,
              color: stats.gatewaysOnline === stats.gatewaysTotal ? 'var(--accent-g)' : 'var(--accent-r)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const opnsenseWidget: WidgetDefinition = {
  type: 'opnsense', displayName: 'OPNsense', category: 'network',
  description: 'Firewall version and gateway status',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: OPNsenseWidget,
}
