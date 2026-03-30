import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/pi-hole.svg'

interface PiholeConfig { url?: string; apiKey?: string }
interface Stats {
  queriesToday: number; blockedToday: number
  blockedPct: number; domainsBlocked: number; status: string
}

// Note: Pi-hole v5 requires the auth token in the query string — the API has
// no header-based auth option for this endpoint.
function PiholeWidget({ config }: WidgetProps<PiholeConfig>) {
  const { url, apiKey } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')
      const res = await proxyGet<{
        dns_queries_today:    number
        ads_blocked_today:    number
        ads_percentage_today: number
        domains_being_blocked: number
        status:               string
      }>(`${base}/admin/api.php?summaryRaw&auth=${apiKey!}`)

      return {
        queriesToday:   res.dns_queries_today,
        blockedToday:   res.ads_blocked_today,
        blockedPct:     res.ads_percentage_today,
        domainsBlocked: res.domains_being_blocked,
        status:         res.status,
      } satisfies Stats
    },
    30_000,
    [url, apiKey],
  )

  if (!url || !apiKey)  return <WidgetUnconfigured message="Configure a Pi-hole URL and API token in widget settings." />
  if (loading && !data) return <WidgetSkeleton rows={2} />
  if (error   && !data) return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Queries Today" value={data.queriesToday.toLocaleString()} fontSize={16} />
        <StatCard label="Blocked"       value={data.blockedToday.toLocaleString()} color="var(--accent-r)" fontSize={16} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Block Rate"       value={`${data.blockedPct.toFixed(1)}%`}           color="var(--accent-y)" fontSize={16} />
        <StatCard label="Domains Blocked"  value={data.domainsBlocked.toLocaleString()} fontSize={14} />
      </div>
    </div>
  )
}

export const piholeWidget: WidgetDefinition = {
  type: 'pihole', displayName: 'Pi-hole', category: 'network',
  description: 'DNS queries blocked and block rate',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: PiholeWidget,
}
