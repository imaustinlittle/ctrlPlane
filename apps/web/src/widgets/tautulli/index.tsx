import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/tautulli.svg'

interface TautulliConfig { url?: string; apiKey?: string }
interface Session { full_title: string; username: string; media_type: string; state: string; progress_percent: string }
interface Stats { streamCount: number; sessions: Session[] }

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

function TautulliWidget({ config }: WidgetProps<TautulliConfig>) {
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
        const data = await proxyGet(`${base}/api/v2?apikey=${apiKey}&cmd=get_activity`) as {
          response: { data: { stream_count: number; sessions: Session[] } }
        }
        if (cancelled) return
        const d = data.response?.data
        setStats({ streamCount: d?.stream_count ?? 0, sessions: d?.sessions ?? [] })
        setError(null)
      } catch (e) { if (!cancelled) setError((e as Error).message) }
      finally     { if (!cancelled) setLoading(false) }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, apiKey])

  const mediaIcon = (t: string) => t === 'movie' ? '🎬' : t === 'episode' ? '📺' : t === 'track' ? '🎵' : '▶'
  const stateColor = (s: string) => s === 'playing' ? 'var(--accent-g)' : s === 'paused' ? 'var(--accent-y)' : 'var(--text2)'

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Tautulli</span>
        {stats !== null && (
          <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500, color: stats.streamCount > 0 ? 'var(--accent-g)' : 'var(--text2)' }}>
            {stats.streamCount} stream{stats.streamCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!url || !apiKey ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a Tautulli URL and API key in widget settings.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-r)', fontSize: 11 }}>⚠ {error}</div>
      ) : stats && stats.sessions.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>No active streams</div>
      ) : stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.sessions.map((s, i) => (
            <div key={i} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>{mediaIcon(s.media_type)}</span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_title}</span>
                <span style={{ fontSize: 10, color: stateColor(s.state), fontWeight: 600 }}>{s.state}</span>
              </div>
              <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${s.progress_percent}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{s.username} · {s.progress_percent}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const tautulliWidget: WidgetDefinition = {
  type: 'tautulli', displayName: 'Tautulli', category: 'media',
  description: 'Plex activity and stream monitoring',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: TautulliWidget,
}
