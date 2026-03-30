import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface StorageMount {
  mount:   string
  label:   string
  usedGb:  number
  totalGb: number
}

interface StorageConfig {
  mounts?:     string[]  // if set, only show these mount paths
  showLabels?: boolean
  warnAt?:     number
  criticalAt?: number
}

function fmt(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`
  return `${gb.toFixed(0)} GB`
}

function StorageWidget({ config }: WidgetProps<StorageConfig>) {
  const warnAt     = config?.warnAt     ?? 80
  const criticalAt = config?.criticalAt ?? 90
  const showLabels = config?.showLabels ?? true
  const mountFilter = config?.mounts?.length ? new Set(config.mounts) : null

  const [mounts,  setMounts]  = useState<StorageMount[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/system/storage')
        .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => { throw new Error(b.error ?? `HTTP ${r.status}`) }))
        .then((d: StorageMount[]) => { if (!cancelled) { setMounts(d); setError(null); setLoading(false) } })
        .catch((e: Error) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    }
    load()
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (loading && !mounts) {
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

  if (error || !mounts) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12 }}>
        <span style={{ fontSize: 18 }}>💾</span>
        <span>{error ?? 'No data'}</span>
      </div>
    )
  }

  const visible = mountFilter ? mounts.filter(m => mountFilter.has(m.mount)) : mounts

  return (
    <div className="widget-body" style={{ paddingTop: 10, gap: 10, display: 'flex', flexDirection: 'column' }}>
      {visible.map(m => {
        const pct = (m.usedGb / m.totalGb) * 100
        const color =
          pct > criticalAt ? 'var(--accent-r)' :
          pct > warnAt     ? 'var(--accent-y)' :
          'var(--accent)'

        return (
          <div key={m.mount} style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {showLabels ? m.label : m.mount}
              </span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)' }}>
                {fmt(m.usedGb)} / {fmt(m.totalGb)}
              </span>
            </div>

            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct.toFixed(1)}%`, background: color, borderRadius: 3 }} />
            </div>

            <div style={{ fontSize: 10, color: color, textAlign: 'right', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
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
