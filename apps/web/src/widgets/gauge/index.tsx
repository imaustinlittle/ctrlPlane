import { useEffect, useRef } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'
import { useSystemMetrics } from '../../hooks/useMockData'

interface GaugeConfig {
  label: string
  metric: 'cpu' | 'ram' | 'temp'
  color: 'green' | 'purple' | 'yellow' | 'blue' | 'red'
  unit: string
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
  const metrics = useSystemMetrics()
  const color = COLOR_MAP[config.color] ?? COLOR_MAP.blue

  let value: number
  let display: string
  let extra: string | undefined

  if (config.metric === 'cpu') {
    value = metrics.cpu
    display = `${Math.round(metrics.cpu)}%`
  } else if (config.metric === 'ram') {
    value = metrics.ram
    display = `${Math.round(metrics.ram)}%`
    extra = `${metrics.ramUsedGb} / ${metrics.ramTotalGb} GB`
  } else {
    // temp: map 20–90°C to 0–100%
    value = Math.min(100, Math.max(0, ((metrics.temp - 20) / 70) * 100))
    display = `${Math.round(metrics.temp)}°C`
    extra = `Fan: ${metrics.fanRpm} rpm`
  }

  return (
    <div className="widget-body" style={{ paddingTop: 10 }}>
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
  defaultH: 3,
  minW: 2,
  minH: 2,
  component: GaugeWidget,
}
