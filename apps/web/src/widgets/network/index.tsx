import { useEffect, useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'
import { useNetworkData } from '../shared/useNetworkData'
import type { NetworkPoint } from '../shared/useNetworkData'

interface NetworkConfig {
  interface?:  string
  timeWindow?: number   // minutes: 1 | 3 | 5 | 10
}

// ── Canvas chart ──────────────────────────────────────────────────────────────
function drawChart(
  canvas: HTMLCanvasElement,
  history: NetworkPoint[],
  windowMs: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  if (history.length < 1) return

  const now     = Date.now()
  const startTs = now - windowMs

  // Append a synthetic "now" point so the line always reaches the right edge
  const last    = history[history.length - 1]
  const withNow = [...history, { ts: now, up: last.up, down: last.down }]
  const pts     = withNow.filter(p => p.ts >= startTs - 8_000)
  if (pts.length < 2) return

  const maxVal = Math.max(1, ...pts.map(p => Math.max(p.up, p.down)))

  // Map timestamp → x pixel (right edge = "now")
  const toX = (ts: number) => ((ts - startTs) / windowMs) * w
  // Map Mbps value → y pixel (0 at bottom with small padding)
  const toY = (v: number)  => h - (v / maxVal) * h * 0.88 - h * 0.04

  const drawSeries = (
    getValue: (p: NetworkPoint) => number,
    stroke: string,
    fillTop: string,
  ) => {
    const mapped = pts.map(p => ({ x: toX(p.ts), y: toY(getValue(p)) }))

    // ── Filled area ──
    ctx.save()
    ctx.beginPath()
    // Start at bottom-left of first point
    ctx.moveTo(mapped[0].x, h)
    // Line up to first point
    ctx.lineTo(mapped[0].x, mapped[0].y)
    // Draw through all points with smooth curves
    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1]
      const curr = mapped[i]
      const cpX  = (prev.x + curr.x) / 2
      ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y)
    }
    // Close at bottom-right
    ctx.lineTo(mapped[mapped.length - 1].x, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, fillTop)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()

    // ── Stroke line ──
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(mapped[0].x, mapped[0].y)
    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1]
      const curr = mapped[i]
      const cpX  = (prev.x + curr.x) / 2
      ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y)
    }
    ctx.strokeStyle = stroke
    ctx.lineWidth   = 1.5
    ctx.lineJoin    = 'round'
    ctx.stroke()
    ctx.restore()
  }

  drawSeries(p => p.down, 'rgba(88,166,255,0.9)',  'rgba(88,166,255,0.3)')
  drawSeries(p => p.up,   'rgba(63,185,80,0.9)',   'rgba(63,185,80,0.2)')
}

// ── Widget ────────────────────────────────────────────────────────────────────
function NetworkWidget({ config }: WidgetProps<NetworkConfig>) {
  const iface     = config?.interface  ?? 'eth0'
  const windowMin = Number(config?.timeWindow ?? 5)
  const windowMs  = windowMin * 60_000

  const { latest, history, loading, error: fetchError } = useNetworkData(iface)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  // historyRef mirrors the module-store history so the rAF loop always reads latest data
  const historyRef  = useRef<NetworkPoint[]>(history)
  const rafRef      = useRef<number>(0)
  const windowMsRef = useRef(windowMs)

  // Keep refs current on every render
  historyRef.current  = history
  windowMsRef.current = windowMs

  // ── Size canvas via ResizeObserver — never touch dimensions in rAF ─────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const pw = Math.round(rect.width)
      const ph = Math.round(rect.height)
      if (pw > 0 && ph > 0) { canvas.width = pw; canvas.height = ph }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── rAF draw loop — only draws, never resizes ─────────────────────────────
  useEffect(() => {
    const frame = () => {
      const canvas = canvasRef.current
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        drawChart(canvas, historyRef.current, windowMsRef.current)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const fmt = (mbps: number) =>
    mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} GB/s`
    : mbps >= 1  ? `${mbps.toFixed(0)} MB/s`
    :              `${(mbps * 1000).toFixed(0)} KB/s`

  const windowLabel = windowMin === 1 ? '1m' : windowMin === 3 ? '3m' : windowMin === 5 ? '5m' : '10m'

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
    <div className="widget-body" style={{ paddingTop: 10, gap: 0, paddingBottom: 8 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↑ Upload
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500, lineHeight: 1, color: 'var(--accent-g)' }}>
            {fmt(latest.up)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text2)', marginBottom: 2 }}>
            ↓ Download
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 500, lineHeight: 1, color: 'var(--accent)' }}>
            {fmt(latest.down)}
          </div>
        </div>
      </div>

      {/* Legend + time window label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        {[
          { color: 'rgba(63,185,80,0.9)',  label: 'Upload' },
          { color: 'rgba(88,166,255,0.9)', label: 'Download' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text2)', opacity: 0.6 }}>
          {windowLabel}
        </span>
      </div>

      {/* Canvas — fluid scrolling chart */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', flex: 1, display: 'block', minHeight: 52 }}
      />
    </div>
  )
}

export const networkWidget: WidgetDefinition = {
  type:        'network',
  displayName: 'Network',
  description: 'Live network throughput with fluid scrolling chart',
  icon:        '📶',
  category:    'network',
  defaultW:    4,
  defaultH:    4,
  minW:        2,
  minH:        3,
  component:   NetworkWidget,
}
