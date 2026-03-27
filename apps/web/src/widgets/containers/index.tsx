import type { WidgetDefinition, WidgetProps } from '../../types'
import { useContainers } from '../../hooks/useMockData'
import type { ContainerInfo } from '../../types'

function statusLabel(s: ContainerInfo['status']) {
  return s === 'running' ? 'running' : s === 'exited' ? 'exited' : s === 'paused' ? 'paused' : 'stopped'
}

function ContainersWidget(_props: WidgetProps) {
  const containers = useContainers()

  const running = containers.filter(c => c.status === 'running').length
  const total   = containers.length

  return (
    <div className="widget-body" style={{ padding: '6px 14px 12px' }}>

      {/* Summary row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
        paddingBottom: 6,
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>
          <span style={{ color: 'var(--accent-g)', fontWeight: 600 }}>{running}</span>
          /{total} running
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>CPU</span>
      </div>

      {/* Container rows */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {containers.map(c => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span className={`status-dot ${c.status === 'running' ? 'up' : c.status === 'exited' ? 'down' : 'idle'}`} />
            <span style={{
              flex: 1,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: c.status === 'running' ? 'var(--text)' : 'var(--text2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {c.name}
            </span>
            <span className={`ct-badge ${statusLabel(c.status)}`}>
              {statusLabel(c.status)}
            </span>
            <span style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text2)',
              minWidth: 36,
              textAlign: 'right',
            }}>
              {c.status === 'running' ? `${c.cpuPercent.toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const containersWidget: WidgetDefinition = {
  type: 'containers',
  displayName: 'Containers',
  description: 'Docker container status and resource usage',
  icon: '🐳',
  category: 'system',
  defaultW: 4,
  defaultH: 5,
  minW: 2,
  minH: 2,
  component: ContainersWidget,
}
