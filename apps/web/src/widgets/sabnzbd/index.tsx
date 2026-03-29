import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/sabnzbd.svg'

interface SabConfig { url?: string; apiKey?: string }
interface Stats { status: string; speed: string; sizeLeft: string; slots: number }

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

function SabWidget({ config }: WidgetProps<SabConfig>) {
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
        const data = await proxyGet(`${base}/api?output=json&apikey=${apiKey}&mode=queue`) as {
          queue: { status: string; speed: string; sizeleft: string; noofslots: number }
        }
        if (cancelled) return
        setStats({
          status:   data.queue.status,
          speed:    data.queue.speed,
          sizeLeft: data.queue.sizeleft,
          slots:    data.queue.noofslots,
        })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 5_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, apiKey])

  const statusColor = stats?.status === 'Downloading' ? 'var(--accent-g)'
    : stats?.status === 'Paused' ? 'var(--accent-y)'
    : 'var(--text2)'

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>SABnzbd</span>
        {stats && <span style={{ fontSize: 11, color: statusColor, marginLeft: 'auto', fontWeight: 500 }}>{stats.status}</span>}
      </div>

      {!url || !apiKey ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a SABnzbd URL and API key in widget settings.
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
            { label: 'Speed',    value: stats.speed    || '0 B/s', color: 'var(--accent)' },
            { label: 'Remaining', value: stats.sizeLeft || '0 B',   color: 'var(--text)' },
            { label: 'Items',    value: String(stats.slots),         color: 'var(--text)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const sabnzbdWidget: WidgetDefinition = {
  type: 'sabnzbd', displayName: 'SABnzbd', category: 'media',
  description: 'Usenet download queue and speed',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: SabWidget,
}
