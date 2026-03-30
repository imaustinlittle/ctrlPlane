import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet }                             from '../shared/proxy'
import { usePollData }                          from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/sabnzbd.svg'

interface SabConfig { url?: string; apiKey?: string }
interface Stats { status: string; speed: string; sizeLeft: string; slots: number }

function SabWidget({ config }: WidgetProps<SabConfig>) {
  const { url, apiKey } = config ?? {}

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')
      const res = await proxyGet<{ queue: { status: string; speed: string; sizeleft: string; noofslots: number } }>(
        `${base}/api?output=json&apikey=${apiKey!}&mode=queue`,
      )
      return {
        status:   res.queue.status,
        speed:    res.queue.speed,
        sizeLeft: res.queue.sizeleft,
        slots:    res.queue.noofslots,
      } satisfies Stats
    },
    5_000,
    [url, apiKey],
  )

  const statusColor = data?.status === 'Downloading' ? 'var(--accent-g)'
    : data?.status === 'Paused' ? 'var(--accent-y)' : 'var(--text2)'

  if (!url || !apiKey)  return <WidgetUnconfigured message="Configure a SABnzbd URL and API key in widget settings." />
  if (loading && !data) return <WidgetSkeleton />
  if (error   && !data) return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Speed"     value={data.speed    || '0 B/s'} color="var(--accent)"  fontSize={15} />
        <StatCard label="Remaining" value={data.sizeLeft || '0 B'}   fontSize={15} />
        <StatCard label="Items"     value={data.slots} />
      </div>
    </div>
  )
}

export const sabnzbdWidget: WidgetDefinition = {
  type: 'sabnzbd', displayName: 'SABnzbd', category: 'media',
  description: 'Usenet download queue and speed',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 3, minW: 2, minH: 2, component: SabWidget,
}
