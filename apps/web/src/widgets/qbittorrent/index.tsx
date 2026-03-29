import { useRef }                              from 'react'
import type { WidgetDefinition, WidgetProps }  from '../../types'
import { proxyGet, proxyPost }                 from '../shared/proxy'
import { usePollData }                         from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured, StatCard } from '../shared/WidgetStatus'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/qbittorrent.svg'

interface QbitConfig { url?: string; username?: string; password?: string }
interface Stats { dlSpeed: number; ulSpeed: number; active: number; total: number }

function fmtSpeed(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB/s`
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB/s`
  return `${bytes} B/s`
}

function QbitWidget({ config }: WidgetProps<QbitConfig>) {
  const { url, username = 'admin', password } = config ?? {}
  const sidRef = useRef('')

  const { data, loading, error, retry } = usePollData(
    async () => {
      const base = url!.replace(/\/$/, '')

      // Login if we don't have a session ID
      if (!sidRef.current) {
        const res = await proxyPost(
          `${base}/api/v2/auth/login`,
          `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password!)}`,
          { 'Content-Type': 'application/x-www-form-urlencoded' },
        )
        const match = (res.setCookie ?? '').match(/SID=([^;]+)/)
        sidRef.current = match?.[1] ?? ''
      }

      const cookie = `SID=${sidRef.current}`
      const [xfer, torrents] = await Promise.all([
        proxyGet<{ dl_info_speed: number; up_info_speed: number }>(`${base}/api/v2/transfer/info`, { Cookie: cookie }),
        proxyGet<Array<{ state: string }>>(`${base}/api/v2/torrents/info`, { Cookie: cookie }),
      ])

      const active = torrents.filter(
        t => !['stalledDL','stalledUP','pausedDL','pausedUP','error','missingFiles'].includes(t.state)
      ).length

      return {
        dlSpeed: xfer.dl_info_speed,
        ulSpeed: xfer.up_info_speed,
        active,
        total: torrents.length,
      } satisfies Stats
    },
    5_000,
    [url, username, password],
  )

  // Session expiry: clear SID so next poll re-authenticates
  if (error) sidRef.current = ''

  if (!url || !password)  return <WidgetUnconfigured message="Configure a qBittorrent URL and password in widget settings." />
  if (loading && !data)   return <WidgetSkeleton rows={2} />
  if (error   && !data)   return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>qBittorrent</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="↓ Download" value={fmtSpeed(data.dlSpeed)} color="var(--accent)"   fontSize={15} />
        <StatCard label="↑ Upload"   value={fmtSpeed(data.ulSpeed)} color="var(--accent-g)" fontSize={15} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <StatCard label="Active"    value={data.active} />
        <StatCard label="Torrents"  value={data.total} />
      </div>
    </div>
  )
}

export const qbittorrentWidget: WidgetDefinition = {
  type: 'qbittorrent', displayName: 'qBittorrent', category: 'media',
  description: 'Torrent download speeds and active transfers',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: QbitWidget,
}
