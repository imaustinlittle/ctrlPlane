import { useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'
import { useHealthData } from '../shared/useHealthData'

interface GaugeConfig {
  label: string
  metric: 'cpu' | 'ram' | 'temp'
  color: 'green' | 'purple' | 'yellow' | 'blue' | 'red'
  subtitle?: string
}

const COLOR_MAP = {
  green:  'var(--accent-g)',
  purple: 'var(--accent-p)',
  yellow: 'var(--accent-y)',
  blue:   'var(--accent)',
  red:    'var(--accent-r)',
}

const CIRCUMFERENCE = 2 * Math.PI * 28  // r=28 → 175.9

interface ArcProps {
  value: number  // 0–100
  color: string
}

function Arc({ value, color }: ArcProps) {
  const circleRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!circleRef.current) return
    const offset = CIRCUMFERENCE - (value / 100) * CIRCUMFERENCE
    circleRef.current.style.strokeDashoffset = offset.toFixed(2)
  }, [value])

  return (
    <svg width="76" height="76" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle
        cx="36" cy="36" r="28"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="6"
      />
      {/* Fill */}
      <circle
        ref={circleRef}
        cx="36" cy="36" r="28"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE - (value / 100) * CIRCUMFERENCE}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  )
}

function GaugeWidget({ config }: WidgetProps<GaugeConfig>) {
  const color = COLOR_MAP[config.color] ?? COLOR_MAP.blue
  const { data: health, loading, error } = useHealthData()

  if (loading && !health) {
    return (
      <div className="widget-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 14px' }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: 60, height: 28, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 80, height: 11, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  if (error || !health) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ textAlign: 'center' }}>{error ?? 'No data'}</span>
      </div>
    )
  }

  let value: number
  let display: string
  let extra: string | undefined

  if (config.metric === 'cpu') {
    value   = health.cpu.usage
    display = `${Math.round(health.cpu.usage)}%`
  } else if (config.metric === 'ram') {
    value   = health.memory.percent
    display = `${Math.round(health.memory.percent)}%`
    extra   = `${health.memory.usedGb} / ${health.memory.totalGb} GB`
  } else {
    // temp
    if (health.tempC === null) {
      value   = 0
      display = 'N/A'
      extra   = 'Temperature unavailable'
    } else {
      value   = Math.min(100, Math.max(0, ((health.tempC - 20) / 70) * 100))
      display = `${Math.round(health.tempC)}°C`
    }
  }

  return (
    <div className="widget-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Arc value={value} color={color} />
        <div>
          <div style={{
            fontSize: 28,
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1,
            color: color,
          }}>
            {display}
          </div>
          {config.subtitle && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
              {config.subtitle}
            </div>
          )}
          {extra && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
              {extra}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const gaugeWidget: WidgetDefinition<GaugeConfig> = {
  type: 'gauge',
  displayName: 'Gauge',
  description: 'Circular gauge for system metrics',
  icon: '⚡',
  category: 'system',
  defaultW: 2,
  defaultH: 2,
  minW: 2,
  minH: 2,
  component: GaugeWidget,
}
