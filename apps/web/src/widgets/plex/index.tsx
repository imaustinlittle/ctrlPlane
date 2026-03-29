import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/plex.svg'

interface PlexConfig { url?: string; token?: string }
interface Stats { streams: number; libraries: Array<{ title: string; count: number; type: string }> }

async function proxyGet(url: string, token: string) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headers: { 'X-Plex-Token': token, Accept: 'application/json' } }),
  })
  const j = await r.json() as { status: number; data: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  if (j.status >= 400) throw new Error(`HTTP ${j.status}`)
  return j.data
}

function PlexWidget({ config }: WidgetProps<PlexConfig>) {
  const { url, token } = config ?? {}
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url || !token) { setLoading(false); return }
    let cancelled = false
    const base = url.replace(/\/$/, '')
    const load = async () => {
      try {
        const [sessionsRes, sectionsRes] = await Promise.all([
          proxyGet(`${base}/status/sessions`, token),
          proxyGet(`${base}/library/sections`, token),
        ])
        if (cancelled) return
        const sessions = sessionsRes as { MediaContainer: { size: number } }
        const sections = sectionsRes as { MediaContainer: { Directory: Array<{ title: string; size: number; type: string }> } }
        const dirs = sections.MediaContainer?.Directory ?? []
        setStats({
          streams: sessions.MediaContainer?.size ?? 0,
          libraries: dirs.map(d => ({ title: d.title, count: d.size, type: d.type })),
        })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, token])

  const typeIcon = (t: string) => t === 'movie' ? '🎬' : t === 'show' ? '📺' : t === 'artist' ? '🎵' : '📁'

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Plex</span>
        {stats !== null && (
          <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500, color: stats.streams > 0 ? 'var(--accent-g)' : 'var(--text2)' }}>
            {stats.streams} stream{stats.streams !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!url || !token ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a Plex URL and access token in widget settings.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-r)', fontSize: 11 }}>⚠ {error}</div>
      ) : stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.libraries.map(lib => (
            <div key={lib.title} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
              <span style={{ fontSize: 14 }}>{typeIcon(lib.type)}</span>
              <span style={{ fontSize: 12, flex: 1 }}>{lib.title}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{lib.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const plexWidget: WidgetDefinition = {
  type: 'plex', displayName: 'Plex', category: 'media',
  description: 'Active streams and library stats',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: PlexWidget,
}
