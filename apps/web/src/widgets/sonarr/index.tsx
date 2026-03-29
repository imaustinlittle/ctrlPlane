import type { WidgetDefinition, WidgetProps } from '../../types'
import { arrGet }                              from '../shared/proxy'
import { usePollData }                         from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/sonarr.svg'

interface SonarrConfig { url?: string; apiKey?: string }
interface Stats { version: string; series: number; queue: number; missing: number }

async function fetchStats(url: string, apiKey: string): Promise<Stats> {
  const [status, series, queue, missing] = await Promise.all([
    arrGet<{ version: string }>(url, apiKey, '/api/v3/system/status'),
    arrGet<unknown[]>(url, apiKey, '/api/v3/series'),
    arrGet<{ totalCount: number }>(url, apiKey, '/api/v3/queue/status'),
    arrGet<{ totalRecords: number }>(url, apiKey, '/api/v3/wanted/missing?pageSize=1'),
  ])
  return {
    version: status.version,
    series:  series.length,
    queue:   queue.totalCount,
    missing: missing.totalRecords,
  }
}

function SonarrWidget({ config }: WidgetProps<SonarrConfig>) {
  const { url, apiKey } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    () => fetchStats(url!, apiKey!),
    60_000,
    [url, apiKey],
  )

  if (!url || !apiKey)   return <WidgetUnconfigured message="Configure a Sonarr URL and API key in widget settings." />
  if (loading && !data)  return <WidgetSkeleton />
  if (error   && !data)  return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Sonarr</span>
        <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>v{data.version}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Series"  value={data.series}  color="var(--accent)" />
        <StatCard label="Queue"   value={data.queue}   color="var(--accent-y)" />
        <StatCard label="Missing" value={data.missing} color="var(--accent-r)" />
      </div>
    </div>
  )
}

export const sonarrWidget: WidgetDefinition = {
  type: 'sonarr', displayName: 'Sonarr', category: 'media',
  description: 'TV series queue and missing episodes',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: SonarrWidget,
}
