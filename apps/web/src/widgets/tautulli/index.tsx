import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/tautulli.svg'

interface TautulliConfig { url?: string; apiKey?: string }
interface Session { full_title: string; username: string; media_type: string; state: string; progress_percent: string }
interface Stats { streamCount: number; sessions: Session[] }

const MEDIA_ICON: Record<string, string> = { movie: '🎬', episode: '📺', track: '🎵' }
const STATE_COLOR: Record<string, string> = { playing: 'var(--accent-g)', paused: 'var(--accent-y)' }

function TautulliWidget({ config }: WidgetProps<TautulliConfig>) {
  const { url, apiKey } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')
      const res = await proxyGet<{
        response: { data: { stream_count: number; sessions: Session[] } }
      }>(`${base}/api/v2?apikey=${apiKey!}&cmd=get_activity`)

      const d = res.response?.data
      return {
        streamCount: d?.stream_count ?? 0,
        sessions:    d?.sessions     ?? [],
      } satisfies Stats
    },
    15_000,
    [url, apiKey],
  )

  if (!url || !apiKey)  return <WidgetUnconfigured message="Configure a Tautulli URL and API key in widget settings." />
  if (loading && !data) return <WidgetSkeleton />
  if (error   && !data) return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Tautulli</span>
        <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500,
          color: data.streamCount > 0 ? 'var(--accent-g)' : 'var(--text2)' }}>
          {data.streamCount} stream{data.streamCount !== 1 ? 's' : ''}
        </span>
      </div>

      {data.sessions.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>
          No active streams
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.sessions.map((s, i) => (
            <div key={i} style={{ padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>{MEDIA_ICON[s.media_type] ?? '▶'}</span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.full_title}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: STATE_COLOR[s.state] ?? 'var(--text2)' }}>
                  {s.state}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${s.progress_percent}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
                {s.username} · {s.progress_percent}%
              </div>
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
