import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/lidarr.svg'

interface LidarrConfig { url?: string; apiKey?: string }
interface Stats { version: string; artists: number; queue: number; missing: number }

async function arrGet(baseUrl: string, apiKey: string, path: string) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `${baseUrl.replace(/\/$/, '')}${path}`, headers: { 'X-Api-Key': apiKey } }),
  })
  const j = await r.json() as { status: number; data: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  if (j.status >= 400) throw new Error(`HTTP ${j.status}`)
  return j.data
}

function LidarrWidget({ config }: WidgetProps<LidarrConfig>) {
  const { url, apiKey } = config ?? {}
  const [stats, setStats]   = useState<Stats | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url || !apiKey) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      try {
        const [statusRes, artistsRes, queueRes, missingRes] = await Promise.all([
          arrGet(url, apiKey, '/api/v1/system/status'),
          arrGet(url, apiKey, '/api/v1/artist'),
          arrGet(url, apiKey, '/api/v1/queue/status'),
          arrGet(url, apiKey, '/api/v1/wanted/missing?pageSize=1'),
        ])
        if (cancelled) return
        setStats({
          version: (statusRes as { version: string }).version,
          artists: (artistsRes as unknown[]).length,
          queue:   (queueRes as { totalCount: number }).totalCount,
          missing: (missingRes as { totalRecords: number }).totalRecords,
        })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, apiKey])

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Lidarr</span>
        {stats && <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>v{stats.version}</span>}
      </div>

      {!url || !apiKey ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a Lidarr URL and API key in widget settings.
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
            { label: 'Artists', value: stats.artists, color: 'var(--accent)' },
            { label: 'Queue',   value: stats.queue,   color: 'var(--accent-y)' },
            { label: 'Missing', value: stats.missing, color: 'var(--accent-r)' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const lidarrWidget: WidgetDefinition = {
  type: 'lidarr', displayName: 'Lidarr', category: 'media',
  description: 'Music library queue and missing albums',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: LidarrWidget,
}
