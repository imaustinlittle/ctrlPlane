import { useState, useEffect, useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface HealthData {
  cpu:    { usage: number; cores: number; model: string }
  memory: { percent: number; usedGb: number; totalGb: number }
  tempC:  number | null
}

// ── Mini arc ──────────────────────────────────────────────────────────────────
const R  = 18
const CI = 2 * Math.PI * R

function MiniArc({ value, color }: { value: number; color: string }) {
  const ref = useRef<SVGCircleElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.style.strokeDashoffset = (CI - (value / 100) * CI).toFixed(2)
  }, [value])
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        ref={ref}
        cx="22" cy="22" r={R}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={CI}
        strokeDashoffset={CI - (value / 100) * CI}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

// ── Single metric cell ─────────────────────────────────────────────────────────
function MetricCell({ label, value, displayVal, sub, color, loading }: {
  label:      string
  value:      number
  displayVal: string
  sub?:       string
  color:      string
  loading:    boolean
}) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
      {loading
        ? <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
        : <MiniArc value={value} color={color} />
      }
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
          {label}
        </div>
        {loading
          ? <>
              <div style={{ width: 44, height: 18, borderRadius: 3, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 4 }} />
              <div style={{ width: 64, height: 10, borderRadius: 3, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </>
          : <>
              <div style={{ fontSize: 22, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, color }}>{displayVal}</div>
              {sub && <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>}
            </>
        }
      </div>
    </div>
  )
}

const DIV = <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', margin: '8px 0' }} />

// ── Widget ─────────────────────────────────────────────────────────────────────
function SysMetricsWidget(_props: WidgetProps) {
  const [health,  setHealth]  = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/system/health')
        .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? `HTTP ${r.status}`) }))
        .then((d: HealthData) => { if (!cancelled) { setHealth(d); setError(null); setLoading(false) } })
        .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }
    load()
    const id = setInterval(load, 5_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (error) {
    return (
      <div className="widget-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12 }}>
        <span>⚠️</span><span>{error}</span>
      </div>
    )
  }

  const cpu    = health?.cpu.usage    ?? 0
  const ram    = health?.memory.percent ?? 0
  const tempC  = health?.tempC ?? null
  const tempPct = tempC !== null ? Math.min(100, Math.max(0, ((tempC - 20) / 70) * 100)) : 0

  return (
    <div className="widget-body" style={{ flexDirection: 'row', alignItems: 'center', padding: '6px 2px' }}>
      <MetricCell
        label="CPU" color="var(--accent-g)"
        value={cpu} displayVal={loading ? '—' : `${Math.round(cpu)}%`}
        sub={health ? `${health.cpu.cores} cores` : undefined}
        loading={loading && !health}
      />
      {DIV}
      <MetricCell
        label="Memory" color="var(--accent-p)"
        value={ram} displayVal={loading ? '—' : `${Math.round(ram)}%`}
        sub={health ? `${health.memory.usedGb} / ${health.memory.totalGb} GB` : undefined}
        loading={loading && !health}
      />
      {DIV}
      <MetricCell
        label="Thermals" color="var(--accent-y)"
        value={tempPct}
        displayVal={loading ? '—' : tempC !== null ? `${Math.round(tempC)}°C` : 'N/A'}
        sub={tempC === null && !loading ? 'Unavailable' : undefined}
        loading={loading && !health}
      />
    </div>
  )
}

export const sysmetricsWidget: WidgetDefinition = {
  type:        'sysmetrics',
  displayName: 'System Stats',
  description: 'CPU, memory, and temperature in one widget',
  icon:        '⚡',
  category:    'system',
  defaultW:    6,
  defaultH:    2,
  minW:        3,
  minH:        2,
  component:   SysMetricsWidget,
}
