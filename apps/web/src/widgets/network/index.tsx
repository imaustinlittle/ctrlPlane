import { useState, useEffect, useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'
import { useSparkline } from '../../hooks/useMockData'

interface NetworkConfig {
  interface?: string
}

interface NetworkPoint { up: number; down: number }

const HISTORY_LEN = 30

function NetworkWidget({ config }: WidgetProps<NetworkConfig>) {
  const iface = config?.interface ?? 'eth0'

  const [uploadMbps,   setUploadMbps]   = useState(0)
  const [downloadMbps, setDownloadMbps] = useState(0)
  const [history,      setHistory]      = useState<NetworkPoint[]>(
    () => Array.from({ length: HISTORY_LEN }, () => ({ up: 0, down: 0 }))
  )
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  useSparkline(canvasRef, history)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`/api/system/network?iface=${encodeURIComponent(iface)}`)
        .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? `HTTP ${r.status}`) }))
        .then((d: { uploadMbps: number; downloadMbps: number }) => {
          if (cancelled) return
          setUploadMbps(d.uploadMbps)
          setDownloadMbps(d.downloadMbps)
          setHistory(h => [...h.slice(1), { up: d.uploadMbps, down: d.downloadMbps }])
          setFetchError(null)
          setLoading(false)
        })
        .catch((e: Error) => { if (!cancelled) { setFetchError(e.message); setLoading(false) } })
    }
    load()
    // Poll every 5s — each call takes ~1s to measure, so effective rate ≈ every 6s
    const id = setInterval(load, 5_000)
    return () => { cancelled = true; clearInterval(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iface])

  const fmt = (mbps: number) =>
    mbps >= 1000
      ? `${(mbps / 1000).toFixed(2)} GB/s`
      : mbps >= 1
      ? `${mbps.toFixed(0)} MB/s`
      : `${(mbps * 1000).toFixed(0)} KB/s`

  if (loading) {
    return (
      <div className="widget-body" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <div style={{ height: 50, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite', marginTop: 4 }} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>📶</span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>Network unavailable</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>{fetchError}</span>
        <span style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
          Make sure the server is running on Linux and the interface name is correct (e.g. eth0, ens3)
        </span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ paddingTop: 10, gap: 0 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↑ Upload
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500, lineHeight: 1, color: 'var(--accent-g)' }}>
            {fmt(uploadMbps)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↓ Download
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500, lineHeight: 1, color: 'var(--accent)' }}>
            {fmt(downloadMbps)}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
        {[
          { color: 'var(--accent-g)', label: 'Upload' },
          { color: 'var(--accent)',   label: 'Download' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 52, display: 'block', flex: 1 }}
      />
    </div>
  )
}

export const networkWidget: WidgetDefinition = {
  type: 'network',
  displayName: 'Network',
  description: 'Live network throughput sparkline',
  icon: '📶',
  category: 'network',
  defaultW: 4,
  defaultH: 4,
  minW: 2,
  minH: 3,
  component: NetworkWidget,
}
