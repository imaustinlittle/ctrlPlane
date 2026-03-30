import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/opnsense.svg'

interface OPNsenseConfig { url?: string; apiKey?: string; apiSecret?: string }
interface Stats { version: string; gatewaysOnline: number; gatewaysTotal: number }

function OPNsenseWidget({ config }: WidgetProps<OPNsenseConfig>) {
  const { url, apiKey, apiSecret } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')
      const auth = `Basic ${btoa(`${apiKey!}:${apiSecret!}`)}`
      const authHeader = { Authorization: auth }

      const [fw, gw] = await Promise.all([
        proxyGet<{ product_version?: string }>(
          `${base}/api/core/firmware/status`, authHeader,
        ),
        proxyGet<{ items?: Array<{ status: string }> }>(
          `${base}/api/routes/gateway/status`, authHeader,
        ),
      ])

      const items = gw.items ?? []
      return {
        version:         fw.product_version ?? '—',
        gatewaysOnline:  items.filter(g => g.status === 'online').length,
        gatewaysTotal:   items.length,
      } satisfies Stats
    },
    30_000,
    [url, apiKey, apiSecret],
  )

  const gwColor = data && data.gatewaysOnline === data.gatewaysTotal
    ? 'var(--accent-g)' : 'var(--accent-r)'

  if (!url || !apiKey || !apiSecret) return <WidgetUnconfigured message="Configure OPNsense URL, API key, and API secret in widget settings." />
  if (loading && !data)  return <WidgetSkeleton rows={2} />
  if (error   && !data)  return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Version"  value={data.version} color="var(--accent)" fontSize={16} />
        <StatCard label="Gateways" value={`${data.gatewaysOnline}/${data.gatewaysTotal}`} color={gwColor} fontSize={16} />
      </div>
    </div>
  )
}

export const opnsenseWidget: WidgetDefinition = {
  type: 'opnsense', displayName: 'OPNsense', category: 'network',
  description: 'Firewall version and gateway status',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: OPNsenseWidget,
}
