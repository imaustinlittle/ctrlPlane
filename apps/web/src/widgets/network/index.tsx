import { useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'
import { useNetworkStats, useSparkline } from '../../hooks/useMockData'

function NetworkWidget(_props: WidgetProps) {
  const stats     = useNetworkStats()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useSparkline(canvasRef, stats.history)

  const fmt = (mbps: number) =>
    mbps >= 1000
      ? `${(mbps / 1000).toFixed(2)} GB/s`
      : mbps >= 1
      ? `${mbps.toFixed(0)} MB/s`
      : `${(mbps * 1000).toFixed(0)} KB/s`

  return (
    <div className="widget-body" style={{ paddingTop: 10, gap: 0 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↑ Upload
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--accent-g)',
          }}>
            {fmt(stats.uploadMbps)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↓ Download
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--accent)',
          }}>
            {fmt(stats.downloadMbps)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            Latency
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--text)',
          }}>
            {stats.latencyMs}ms
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
