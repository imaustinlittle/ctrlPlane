import type { WidgetDefinition, WidgetProps } from '../../types'
import { useStorage } from '../../hooks/useMockData'

function fmt(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb.toFixed(0)} GB`
}

function StorageWidget({ isLoading, error }: WidgetProps) {
  const mounts = useStorage()

  if (isLoading) {
    return (
      <div className="widget-body" style={{ paddingTop: 10, gap: 10, display: 'flex', flexDirection: 'column' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: 80, height: 11, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>💾</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ paddingTop: 10, gap: 10, display: 'flex', flexDirection: 'column' }}>
      {mounts.map(m => {
        const pct = (m.usedGb / m.totalGb) * 100
        const color =
          pct > 85 ? 'var(--accent-r)' :
          pct > 70 ? 'var(--accent-y)' :
          'var(--accent)'

        return (
          <div key={m.mount}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{m.label}</span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)' }}>
                {fmt(m.usedGb)} / {fmt(m.totalGb)}
              </span>
            </div>

            {/* Bar track */}
            <div style={{
              height: 5,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct.toFixed(1)}%`,
                background: color,
                borderRadius: 3,
              }} />
            </div>

            <div style={{
              fontSize: 10,
              color: color,
              textAlign: 'right',
              marginTop: 2,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const storageWidget: WidgetDefinition = {
  type: 'storage',
  displayName: 'Storage',
  description: 'Disk usage across all mounts',
  icon: '💾',
  category: 'system',
  defaultW: 4,
  defaultH: 4,
  minW: 2,
  minH: 3,
  component: StorageWidget,
}
