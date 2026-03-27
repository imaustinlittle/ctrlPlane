import type { WidgetDefinition, WidgetProps } from '../../types'
import { useStorage } from '../../hooks/useMockData'

function fmt(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb.toFixed(0)} GB`
}

function StorageWidget(_props: WidgetProps) {
  const mounts = useStorage()

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
