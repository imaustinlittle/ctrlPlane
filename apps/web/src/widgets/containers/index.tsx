import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface Container {
  id:         string
  name:       string
  image:      string
  status:     'running' | 'exited' | 'stopped'
  cpuPercent: number
  memMb:      number
}

function statusLabel(s: Container['status']) {
  return s === 'running' ? 'running' : s === 'exited' ? 'exited' : 'stopped'
}

const skeletonRow = (key: number) => (
  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface2)', flexShrink: 0 }} />
    <div style={{ flex: 1, height: 11, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    <div style={{ width: 48, height: 11, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  </div>
)

function ContainersWidget({ config }: WidgetProps) {
  const instanceName = config?.integrationName as string | undefined
  const showStopped  = (config?.showStopped as boolean | undefined) ?? true
  const showCpu      = (config?.showCpu     as boolean | undefined) ?? true

  const [containers, setContainers] = useState<Container[] | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      const url = instanceName
        ? `/api/integrations/docker/containers?name=${encodeURIComponent(instanceName)}`
        : '/api/integrations/docker/containers'

      fetch(url)
        .then(async r => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({})) as { error?: string }
            const msg = b.error ?? `HTTP ${r.status}`
            if (r.status === 503) throw new Error('not-configured:' + msg)
            throw new Error(msg)
          }
          return r.json()
        })
        .then((data: Container[]) => {
          if (!cancelled) { setContainers(data); setFetchError(null); setLoading(false) }
        })
        .catch((e: Error) => {
          if (!cancelled) { setFetchError(e.message); setLoading(false) }
        })
    }
    load()
    const id = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceName])

  if (loading && containers === null) {
    return (
      <div className="widget-body" style={{ padding: '6px 14px 12px' }}>
        {[0, 1, 2, 3, 4].map(skeletonRow)}
      </div>
    )
  }

  if (fetchError) {
    const isNotConfigured = fetchError.startsWith('not-configured:')
    const detail = isNotConfigured ? fetchError.slice('not-configured:'.length) : fetchError
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>🐳</span>
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
          {isNotConfigured ? 'No Docker integration configured' : 'Connection error'}
        </span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>
          {isNotConfigured
            ? 'Open the sidebar → Integrations → Docker and add an instance'
            : detail}
        </span>
      </div>
    )
  }

  if (!containers) return null

  const filtered = showStopped ? containers : containers.filter(c => c.status === 'running')
  const running  = containers.filter(c => c.status === 'running').length
  const total    = containers.length

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
        {showCpu && (
          <span style={{ fontSize: 10, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>CPU</span>
        )}
      </div>

      {/* Container rows */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.map(c => (
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
            {showCpu && (
              <span style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text2)',
                minWidth: 36,
                textAlign: 'right',
              }}>
                {c.status === 'running' ? `${c.cpuPercent.toFixed(1)}%` : '—'}
              </span>
            )}
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
