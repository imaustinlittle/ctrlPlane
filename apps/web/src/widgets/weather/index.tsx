import type { WidgetDefinition, WidgetProps } from '../../types'
import { useWeatherData } from '../shared/useWeatherData'

interface WeatherConfig {
  location?: string
  units?:    'imperial' | 'metric'
}

function WeatherWidget({ config }: WidgetProps<WeatherConfig>) {
  const location = config?.location ?? 'Atlanta, GA'
  const units    = config?.units    ?? 'imperial'

  const { data, loading, error } = useWeatherData(location, units)

  const tempUnit  = units === 'metric' ? '°C' : '°F'
  const windLabel = data ? `${data.windSpeed} ${units === 'metric' ? 'km/h' : 'mph'}` : ''

  if (loading && !data) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 80, height: 22, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 120, height: 10, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
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

  return (
    <div className="widget-body" style={{ padding: '10px 14px 12px', justifyContent: 'space-between' }}>

      {/* Current conditions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{data.emoji}</span>
        <div>
          <div style={{ fontSize: 32, fontWeight: 300, letterSpacing: '-2px', lineHeight: 1, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {data.temp}{tempUnit}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{data.condition}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>💧 {data.humidity}%</span>
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>💨 {windLabel}</span>
          <span style={{ fontSize: 11, color: 'var(--text2)' }}>📍 {data.location}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />

      {/* 5-day forecast */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
        {data.forecast.map(day => (
          <div key={day.weekday} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 500 }}>{day.weekday}</span>
            <span style={{ fontSize: 16 }}>{day.emoji}</span>
            <span style={{ fontSize: 11, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{day.high}°</span>
            <span style={{ fontSize: 10, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>{day.low}°</span>
          </div>
        ))}
      </div>

    </div>
  )
}

export const weatherWidget: WidgetDefinition<WeatherConfig> = {
  type:        'weather',
  displayName: 'Weather',
  description: 'Current conditions + 5-day forecast',
  icon:        '🌤',
  category:    'general',
  defaultW:    4,
  defaultH:    4,
  minW:        2,
  minH:        3,
  component:   WeatherWidget,
}
