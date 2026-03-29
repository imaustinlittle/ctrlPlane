import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/plex.svg'

interface PlexConfig { url?: string; token?: string }
interface Library { title: string; count: number; type: string }
interface Stats { streams: number; libraries: Library[] }

const TYPE_ICON: Record<string, string> = { movie: '🎬', show: '📺', artist: '🎵' }

function PlexWidget({ config }: WidgetProps<PlexConfig>) {
  const { url, token } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base    = url!.replace(/\/$/, '')
      const headers = { 'X-Plex-Token': token!, Accept: 'application/json' }

      const [sessionsRes, sectionsRes] = await Promise.all([
        proxyGet<{ MediaContainer: { size: number } }>(
          `${base}/status/sessions`, headers,
        ),
        proxyGet<{ MediaContainer: { Directory?: Array<{ title: string; size: number; type: string }> } }>(
          `${base}/library/sections`, headers,
        ),
      ])

      return {
        streams:   sessionsRes.MediaContainer?.size ?? 0,
        libraries: (sectionsRes.MediaContainer?.Directory ?? []).map(d => ({
          title: d.title,
          count: d.size,
          type:  d.type,
        })),
      } satisfies Stats
    },
    15_000,
    [url, token],
  )

  if (!url || !token)   return <WidgetUnconfigured message="Configure a Plex URL and access token in widget settings." />
  if (loading && !data) return <WidgetSkeleton />
  if (error   && !data) return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Plex</span>
        <span style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 500,
          color: data.streams > 0 ? 'var(--accent-g)' : 'var(--text2)' }}>
          {data.streams} stream{data.streams !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.libraries.map(lib => (
          <div key={lib.title} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
            <span style={{ fontSize: 14 }}>{TYPE_ICON[lib.type] ?? '📁'}</span>
            <span style={{ fontSize: 12, flex: 1 }}>{lib.title}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{lib.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const plexWidget: WidgetDefinition = {
  type: 'plex', displayName: 'Plex', category: 'media',
  description: 'Active streams and library stats',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: PlexWidget,
}
