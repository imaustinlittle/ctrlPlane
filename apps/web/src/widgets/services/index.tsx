import type { WidgetDefinition, WidgetProps } from '../../types'
import { useServiceStatuses } from '../../hooks/useMockData'

const skeletonRow = (key: number) => (
  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface2)', flexShrink: 0 }} />
    <div style={{ flex: 1, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    <div style={{ width: 44, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  </div>
)

function ServicesWidget({ isLoading, error }: WidgetProps) {
  const services = useServiceStatuses()

  if (isLoading) {
    return (
      <div className="widget-body" style={{ padding: '8px 14px 12px' }}>
        {[0, 1, 2, 3].map(skeletonRow)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ padding: '8px 14px 12px', overflowY: 'auto' }}>
      {services.map((svc) => (
        <div
          key={svc.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <span className={`status-dot ${svc.status}`} />
          <span style={{ flex: 1, color: 'var(--text)' }}>{svc.name}</span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color:
                svc.status === 'up'
                  ? 'var(--accent-g)'
                  : svc.status === 'down'
                  ? 'var(--accent-r)'
                  : 'var(--accent-y)',
            }}
          >
            {svc.status === 'up' ? 'online' : svc.status === 'down' ? 'offline' : 'degraded'}
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text2)',
              minWidth: 44,
              textAlign: 'right',
            }}
          >
            {svc.pingMs != null ? `${svc.pingMs}ms` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

export const servicesWidget: WidgetDefinition = {
  type: 'services',
  displayName: 'Service Status',
  description: 'Live status for your self-hosted services',
  icon: '📡',
  category: 'monitoring',
  defaultW: 4,
  defaultH: 5,
  minW: 2,
  minH: 3,
  component: ServicesWidget,
}
