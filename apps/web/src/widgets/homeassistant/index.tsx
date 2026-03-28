import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface HaEntity {
  entityId:    string
  domain:      string
  name:        string
  state:       string
  unit:        string
  deviceClass: string
  lastUpdated: string
}

// Domain → icon fallback
const DOMAIN_ICON: Record<string, string> = {
  light:          '💡',
  switch:         '🔌',
  sensor:         '📊',
  binary_sensor:  '🔵',
  climate:        '🌡️',
  media_player:   '🎵',
  cover:          '🪟',
  lock:           '🔒',
  camera:         '📷',
  automation:     '⚙️',
  script:         '📜',
  scene:          '🎭',
  input_boolean:  '🔘',
  person:         '👤',
  weather:        '🌤️',
}

function domainIcon(domain: string) {
  return DOMAIN_ICON[domain] ?? '🏠'
}

function stateColor(domain: string, state: string): string {
  if (state === 'unavailable' || state === 'unknown') return 'var(--text2)'
  if (domain === 'binary_sensor' || domain === 'switch' || domain === 'light' || domain === 'input_boolean') {
    return state === 'on' ? 'var(--accent-g)' : 'var(--text2)'
  }
  if (domain === 'lock') return state === 'locked' ? 'var(--accent-g)' : 'var(--accent-r)'
  if (domain === 'cover') return state === 'closed' ? 'var(--text2)' : 'var(--accent)'
  return 'var(--text)'
}

function formatState(entity: HaEntity): string {
  if (entity.state === 'unavailable') return '—'
  if (entity.unit) return `${entity.state} ${entity.unit}`
  return entity.state
}

function skeletonRow(key: number) {
  return (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 18, height: 14, borderRadius: 3, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ flex: 1, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ width: 50, height: 12, borderRadius: 4, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

// Raw state shape returned by the HA API proxy
interface RawHaState {
  entity_id: string
  state: string
  last_updated: string
  attributes: Record<string, unknown>
}

function HomeAssistantWidget({ config }: WidgetProps) {
  const domains    = (config?.domains    as string[]  | undefined) ?? []
  const maxItems   = (config?.maxItems   as number    | undefined) ?? 20
  const showDomain = (config?.showDomain as boolean   | undefined) ?? false
  const instanceName = config?.integrationName as string | undefined

  const [entities,   setEntities]   = useState<HaEntity[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      setLoading(true)
      const url = instanceName
        ? `/api/integrations/homeassistant/states?name=${encodeURIComponent(instanceName)}`
        : '/api/integrations/homeassistant/states'

      fetch(url)
        .then(r => {
          if (r.status === 503) throw new Error('Home Assistant integration not configured')
          if (!r.ok) throw new Error(`Server error ${r.status}`)
          return r.json()
        })
        .then((states: RawHaState[]) => {
          if (cancelled) return
          setEntities(states.map(s => ({
            entityId:    s.entity_id,
            domain:      s.entity_id.split('.')[0],
            name:        String(s.attributes.friendly_name ?? s.entity_id),
            state:       s.state,
            unit:        String(s.attributes.unit_of_measurement ?? ''),
            deviceClass: String(s.attributes.device_class ?? ''),
            lastUpdated: s.last_updated,
          })))
          setFetchError(null)
        })
        .catch((err: Error) => {
          if (!cancelled) setFetchError(err.message)
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }

    load()
    const interval = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceName])

  if (loading && entities === null) {
    return (
      <div className="widget-body" style={{ padding: '8px 14px 12px' }}>
        {[0, 1, 2, 3, 4].map(skeletonRow)}
      </div>
    )
  }

  if (fetchError) {
    const isNotConfigured = fetchError.includes('not configured')
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        <span style={{ fontSize: 22 }}>{isNotConfigured ? '🏠' : '⚠️'}</span>
        <span style={{ fontWeight: 500 }}>{isNotConfigured ? 'No integration configured' : 'Connection error'}</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          {isNotConfigured
            ? 'Open the sidebar → Integrations → Home Assistant and add an instance'
            : fetchError}
        </span>
      </div>
    )
  }

  if (!entities) return null

  // Filter, sort, slice — never mutate state
  let filtered = domains.length > 0
    ? entities.filter(e => domains.includes(e.domain))
    : [...entities]

  filtered = filtered.sort((a, b) => {
    if (a.state === 'unavailable' && b.state !== 'unavailable') return 1
    if (a.state !== 'unavailable' && b.state === 'unavailable') return -1
    return a.name.localeCompare(b.name)
  })

  filtered = filtered.slice(0, maxItems)

  if (filtered.length === 0) {
    return (
      <div className="widget-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text2)', fontSize: 12, padding: 16 }}>
        <span style={{ fontSize: 22 }}>🏠</span>
        <span>No entities match filter</span>
      </div>
    )
  }

  return (
    <div className="widget-body" style={{ padding: '8px 14px 12px', overflowY: 'auto' }}>
      {filtered.map(entity => (
        <div
          key={entity.entityId}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}
          title={entity.entityId}
        >
          <span style={{ fontSize: 13, flexShrink: 0 }}>{domainIcon(entity.domain)}</span>
          <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entity.name}
            {showDomain && (
              <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 5 }}>{entity.domain}</span>
            )}
          </span>
          <span style={{
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: stateColor(entity.domain, entity.state),
            flexShrink: 0,
          }}>
            {formatState(entity)}
          </span>
        </div>
      ))}
    </div>
  )
}

export const homeassistantWidget: WidgetDefinition = {
  type: 'homeassistant',
  displayName: 'Home Assistant',
  description: 'Entity states and sensor readings from your HA instance',
  icon: '🏠',
  category: 'automation',
  defaultW: 4,
  defaultH: 6,
  minW: 2,
  minH: 3,
  component: HomeAssistantWidget,
}
