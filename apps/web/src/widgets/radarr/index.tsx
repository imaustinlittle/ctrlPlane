import type { WidgetDefinition, WidgetProps } from '../../types'
import { arrGet }                              from '../shared/proxy'
import { usePollData }                         from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/radarr.svg'

interface RadarrConfig { url?: string; apiKey?: string }
interface Stats { version: string; movies: number; queue: number; missing: number }

async function fetchStats(url: string, apiKey: string): Promise<Stats> {
  const [status, movies, queue, missing] = await Promise.all([
    arrGet<{ version: string }>(url, apiKey, '/api/v3/system/status'),
    arrGet<unknown[]>(url, apiKey, '/api/v3/movie'),
    arrGet<{ totalCount: number }>(url, apiKey, '/api/v3/queue/status'),
    arrGet<{ totalRecords: number }>(url, apiKey, '/api/v3/wanted/missing?pageSize=1'),
  ])
  return {
    version: status.version,
    movies:  movies.length,
    queue:   queue.totalCount,
    missing: missing.totalRecords,
  }
}

function RadarrWidget({ config }: WidgetProps<RadarrConfig>) {
  const { url, apiKey } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    () => fetchStats(url!, apiKey!),
    60_000,
    [url, apiKey],
  )

  if (!url || !apiKey)   return <WidgetUnconfigured message="Configure a Radarr URL and API key in widget settings." />
  if (loading && !data)  return <WidgetSkeleton />
  if (error   && !data)  return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '10px 14px', gap: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--text2)', textAlign: 'right' }}>v{data.version}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Movies"  value={data.movies}  color="var(--accent)" />
        <StatCard label="Queue"   value={data.queue}   color="var(--accent-y)" />
        <StatCard label="Missing" value={data.missing} color="var(--accent-r)" />
      </div>
    </div>
  )
}

export const radarrWidget: WidgetDefinition = {
  type: 'radarr', displayName: 'Radarr', category: 'media',
  description: 'Movie queue and missing films',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 2, minW: 2, minH: 2, component: RadarrWidget,
}
