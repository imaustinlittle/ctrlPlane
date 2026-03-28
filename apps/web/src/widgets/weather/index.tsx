import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface WeatherConfig {
  location?: string
  units?:    'imperial' | 'metric'
}

interface WeatherData {
  temp:      number
  condition: string
  emoji:     string
  humidity:  number
  windSpeed: number
  location:  string
  units:     string
}

function WeatherWidget({ config }: WidgetProps<WeatherConfig>) {
  const location = config?.location ?? 'Smyrna, GA'
  const units    = config?.units    ?? 'imperial'

  const [data,    setData]    = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`/api/system/weather?location=${encodeURIComponent(location)}&units=${units}`)
        .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? `HTTP ${r.status}`) }))
        .then((d: WeatherData) => { if (!cancelled) { setData(d); setError(null); setLoading(false) } })
        .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }
    load()
    const id = setInterval(load, 15 * 60_000)  // refresh every 15 min
    return () => { cancelled = true; clearInterval(id) }
  }, [location, units])

  if (loading && !data) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 80, height: 20, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>🌤</span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>Weather unavailable</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>{error ?? 'No data'}</span>
      </div>
    )
  }

  const windLabel = units === 'metric' ? `${data.windSpeed} km/h` : `${data.windSpeed} mph`
  const tempUnit  = units === 'metric' ? '°C' : '°F'

  return (
    <div className="widget-body" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '8px 12px 14px',
      gap: 6,
      overflow: 'hidden',
    }}>
      {/* Icon + temp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1 }}>{data.emoji}</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'clamp(26px, 5vw, 42px)',
            fontWeight: 300,
            letterSpacing: '-2px',
            lineHeight: 1,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
          }}>
            {data.temp}{tempUnit}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, whiteSpace: 'nowrap' }}>
            {data.condition}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {[
          { icon: '💧', label: `${data.humidity}%` },
          { icon: '💨', label: windLabel },
          { icon: '📍', label: data.location },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const weatherWidget: WidgetDefinition<WeatherConfig> = {
  type:        'weather',
  displayName: 'Weather',
  description: 'Current weather conditions',
  icon:        '🌤',
  category:    'general',
  defaultW:    2,
  defaultH:    3,
  minW:        2,
  minH:        3,
  component:   WeatherWidget,
}
