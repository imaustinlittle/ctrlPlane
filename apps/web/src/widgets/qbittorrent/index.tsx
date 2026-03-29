import { useState, useEffect, useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

const LOGO = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/qbittorrent.svg'

interface QbitConfig { url?: string; username?: string; password?: string }
interface Stats { dlSpeed: number; ulSpeed: number; active: number; total: number }

async function proxyPost(url: string, body: string, headers: Record<string, string> = {}) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method: 'POST', body, headers }),
  })
  return r.json() as Promise<{ status: number; data: unknown; setCookie?: string; error?: string }>
}

async function proxyGet(url: string, headers: Record<string, string> = {}) {
  const r = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, headers }),
  })
  const j = await r.json() as { status: number; data: unknown; error?: string }
  if (j.error) throw new Error(j.error)
  if (j.status >= 400) throw new Error(`HTTP ${j.status}`)
  return j.data
}

function fmtSpeed(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB/s`
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB/s`
  return `${bytes} B/s`
}

function QbitWidget({ config }: WidgetProps<QbitConfig>) {
  const { url, username = 'admin', password } = config ?? {}
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sidRef = useRef<string>('')

  useEffect(() => {
    if (!url || !password) { setLoading(false); return }
    let cancelled = false
    const base = url.replace(/\/$/, '')

    const login = async () => {
      const res = await proxyPost(
        `${base}/api/v2/auth/login`,
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      )
      if (res.setCookie) {
        const match = res.setCookie.match(/SID=([^;]+)/)
        if (match) sidRef.current = match[1]
      }
    }

    const load = async () => {
      try {
        if (!sidRef.current) await login()
        const cookie = `SID=${sidRef.current}`
        const [xferRes, torrentsRes] = await Promise.all([
          proxyGet(`${base}/api/v2/transfer/info`, { Cookie: cookie }),
          proxyGet(`${base}/api/v2/torrents/info`, { Cookie: cookie }),
        ])
        if (cancelled) return
        const xfer = xferRes as { dl_info_speed: number; up_info_speed: number }
        const torrents = torrentsRes as Array<{ state: string }>
        const active = torrents.filter(t => !['stalledDL','stalledUP','pausedDL','pausedUP','error','missingFiles'].includes(t.state)).length
        setStats({ dlSpeed: xfer.dl_info_speed, ulSpeed: xfer.up_info_speed, active, total: torrents.length })
        setError(null)
      } catch (e) {
        // Session expired — clear SID and retry on next tick
        sidRef.current = ''
        if (!cancelled) setError((e as Error).message)
      }
      finally { if (!cancelled) setLoading(false) }
    }

    load()
    const id = setInterval(load, 5_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [url, username, password])

  return (
    <div className="widget-body" style={{ padding: '12px 14px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <img src={LOGO} style={{ width: 24, height: 24, objectFit: 'contain' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>qBittorrent</span>
      </div>

      {!url || !password ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
          Configure a qBittorrent URL and password in widget settings.
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 48, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--accent-r)', fontSize: 11 }}>⚠ {error}</div>
      ) : stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '↓ Download', value: fmtSpeed(stats.dlSpeed), color: 'var(--accent)' },
              { label: '↑ Upload',   value: fmtSpeed(stats.ulSpeed), color: 'var(--accent-g)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Active',    value: stats.active },
              { label: 'Torrents', value: stats.total },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const qbittorrentWidget: WidgetDefinition = {
  type: 'qbittorrent', displayName: 'qBittorrent', category: 'media',
  description: 'Torrent download speeds and active transfers',
  icon: <img src={LOGO} style={{ width: 18, height: 18, objectFit: 'contain' }} />,
  defaultW: 3, defaultH: 4, minW: 2, minH: 3, component: QbitWidget,
}
