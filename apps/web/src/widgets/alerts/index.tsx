import type { WidgetDefinition, WidgetProps } from '../../types'
import { useAlertData, ackAlertEvent, resolveAlertEvent } from '../shared/useAlertData'
import type { AlertEvent } from '../shared/useAlertData'
import { formatDistanceToNow } from 'date-fns'

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--accent-r)',
  warning:  'var(--accent-y)',
  info:     'var(--accent)',
}
const SEV_BG: Record<string, string> = {
  critical: 'rgba(247,129,102,0.08)',
  warning:  'rgba(255,166,87,0.08)',
  info:     'rgba(88,166,255,0.08)',
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }) }
  catch { return '—' }
}

interface AlertsConfig {
  showAcknowledged?: boolean
  maxItems?: number
}

function AlertRow({ alert }: { alert: AlertEvent }) {
  const color   = SEV_COLOR[alert.severity]
  const bg      = SEV_BG[alert.severity]
  const isAcked = alert.status === 'acknowledged' || alert.status === 'snoozed'

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '7px 0', borderBottom: '1px solid var(--border)',
      opacity: isAcked ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0, alignSelf: 'stretch', minHeight: 20 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{alert.ruleName}</span>
          {alert.message ? <>{' — '}{alert.message}</> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            padding: '1px 5px', borderRadius: 3, background: bg, color: color,
            border: `1px solid ${color}33`, textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>{alert.severity}</span>
          <span style={{ fontSize: 10, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>
            {timeAgo(alert.firedAt)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {!isAcked && alert.status === 'firing' && (
          <button onClick={() => ackAlertEvent(alert.id)} title="Acknowledge" style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-g)'; e.currentTarget.style.borderColor = 'var(--accent-g)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)' }}>✓</button>
        )}
        <button onClick={() => resolveAlertEvent(alert.id)} title="Resolve" style={{
          fontSize: 11, padding: '2px 6px', borderRadius: 4,
          border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-r)'; e.currentTarget.style.borderColor = 'var(--accent-r)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)' }}>✕</button>
      </div>
    </div>
  )
}

function AlertsWidget({ config }: WidgetProps<AlertsConfig>) {
  const { events, loading, error } = useAlertData()

  const showAcked = config.showAcknowledged === true
  const maxItems  = (config.maxItems as number | undefined) ?? 10

  const filtered = events
    .filter(a => {
      if (a.status === 'resolved') return false
      if (!showAcked && (a.status === 'acknowledged' || a.status === 'snoozed')) return false
      return true
    })
    .sort((a, b) => {
      const sev: Record<string, number> = { critical: 0, warning: 1, info: 2 }
      return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3)
    })
    .slice(0, maxItems)

  if (loading) {
    return (
      <div className="widget-body" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 44, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>🔔</span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>Alerts unavailable</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>{error}</span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ padding: '8px 14px 12px', overflowY: 'auto' }}>
      {filtered.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text2)', fontSize: 13 }}>
          <span style={{ fontSize: 24 }}>✓</span>
          All clear — no active alerts
        </div>
      ) : (
        filtered.map(alert => <AlertRow key={alert.id} alert={alert} />)
      )}
    </div>
  )
}

export const alertsWidget: WidgetDefinition<AlertsConfig> = {
  type: 'alerts', displayName: 'Alert Center',
  description: 'Active alerts with acknowledge and resolve actions',
  icon: '🔔', category: 'monitoring',
  defaultW: 4, defaultH: 5, minW: 2, minH: 3,
  component: AlertsWidget,
}
