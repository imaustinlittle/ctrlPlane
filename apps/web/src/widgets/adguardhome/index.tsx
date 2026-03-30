import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/adguard-home.svg'

interface AdGuardConfig { url?: string; username?: string; password?: string }
interface Stats { queries: number; blocked: number; blockedPct: number; avgMs: number; running: boolean }

function AdGuardWidget({ config }: WidgetProps<AdGuardConfig>) {
  const { url, username = 'admin', password } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')
      const auth = `Basic ${btoa(`${username}:${password!}`)}`
      const authHeader = { Authorization: auth }

      const [status, stats] = await Promise.all([
        proxyGet<{ running: boolean }>(`${base}/control/status`, authHeader),
        proxyGet<{ num_dns_queries: number; num_blocked_filtering: number; avg_processing_time: number }>(
          `${base}/control/stats`, authHeader,
        ),
      ])

      const pct = stats.num_dns_queries > 0
        ? (stats.num_blocked_filtering / stats.num_dns_queries) * 100
        : 0

      return {
        queries:    stats.num_dns_queries,
        blocked:    stats.num_blocked_filtering,
        blockedPct: pct,
        avgMs:      stats.avg_processing_time,
        running:    status.running,
      } satisfies Stats
    },
    30_000,
    [url, username, password],
  )

  if (!url || !password)  return <WidgetUnconfigured message="Configure an AdGuard Home URL, username, and password in widget settings." />
  if (loading && !data)   return <WidgetSkeleton rows={2} />
  if (error   && !data)   return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="DNS Queries" value={data.queries.toLocaleString()} fontSize={16} />
        <StatCard label="Blocked"     value={data.blocked.toLocaleString()} color="var(--accent-r)" fontSize={16} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Block Rate"   value={`${data.blockedPct.toFixed(1)}%`}        color="var(--accent-y)" fontSize={16} />
        <StatCard label="Avg Latency"  value={`${(data.avgMs * 1000).toFixed(1)} ms`}  fontSize={14} />
      </div>
    </div>
  )
}

export const adguardhomeWidget: WidgetDefinition = {
  type: 'adguardhome', displayName: 'AdGuard Home', category: 'network',
  description: 'DNS query stats and block rate',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: AdGuardWidget,
}
