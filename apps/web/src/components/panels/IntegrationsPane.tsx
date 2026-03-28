import { useState, useEffect } from 'react'
import { ALL_INTEGRATIONS } from '../../integrations/registry'

interface Instance {
  id:         string
  name:       string
  adapterKey: string
  enabled:    boolean
}

interface IntegrationsPaneProps {
  selectedKey: string | null
  onSelect:    (key: string) => void
}

export function IntegrationsPane({ selectedKey, onSelect }: IntegrationsPaneProps) {
  const [instances, setInstances] = useState<Instance[]>([])

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.ok ? r.json() : [])
      .then((data: Instance[]) => setInstances(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  if (ALL_INTEGRATIONS.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text2)' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔌</div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>No integrations available</div>
        <div style={{ fontSize: 12 }}>
          Add an <code style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>integration.ts</code> file
          next to a widget to register a new integration type.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 12px' }}>
      {ALL_INTEGRATIONS.map(def => {
        const typeInstances = instances.filter(i => i.adapterKey === def.key)
        const configured    = typeInstances.some(i => i.enabled)
        const active        = selectedKey === def.key

        return (
          <button
            key={def.key}
            onClick={() => onSelect(def.key)}
            style={{
              width: '100%', padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderRadius: 8, border: 'none',
              background: active ? 'rgba(88,166,255,0.1)' : 'none',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', marginBottom: 2,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{def.icon}</span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {def.displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {def.description}
              </div>
            </div>

            {/* Configured badge */}
            <span style={{
              flexShrink: 0,
              fontSize: 10, fontWeight: 600, padding: '2px 7px',
              borderRadius: 10,
              background: configured ? 'rgba(63,185,80,0.15)' : 'rgba(255,255,255,0.06)',
              color: configured ? 'var(--accent-g)' : 'var(--text2)',
              border: `1px solid ${configured ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
            }}>
              {configured ? '● Active' : '○ Not set'}
            </span>

            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ color: active ? 'var(--accent)' : 'var(--text2)', opacity: 0.5, flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )
      })}
    </div>
  )
}
