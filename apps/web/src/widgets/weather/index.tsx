import type { WidgetDefinition, WidgetProps } from '../../types'
import { useWeather } from '../../hooks/useMockData'

interface WeatherConfig {
  location?: string
  units?:    'imperial' | 'metric'
}

function WeatherWidget({ config }: WidgetProps<WeatherConfig>) {
  const data     = useWeather()
  const isMetric = config.units === 'metric'
  const temp     = isMetric ? Math.round((data.tempF - 32) * 5 / 9) : data.tempF
  const unit     = isMetric ? '°C' : '°F'
  const wind     = isMetric ? `${Math.round(data.windMph * 1.6)} km/h` : `${data.windMph} mph`

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
            {temp}{unit}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, whiteSpace: 'nowrap' }}>
            {data.condition}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 4,
      }}>
        {[
          { icon: '💧', label: `${data.humidity}%` },
          { icon: '💨', label: wind },
          { icon: '📍', label: data.location },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--text2)',
            whiteSpace: 'nowrap',
          }}>
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
