import type { IntegrationDefinition } from '../../types'

export const integration: IntegrationDefinition = {
  key: 'homeassistant',
  displayName: 'Home Assistant',
  icon: '🏠',
  description: 'Entity states, sensor readings, and device control',
  docsUrl: 'https://developers.home-assistant.io/docs/api/rest/',
  fields: [
    { key: 'host',  label: 'URL',              type: 'url',      placeholder: 'http://homeassistant.local:8123' },
    { key: 'token', label: 'Long-lived Token', type: 'password', placeholder: '••••••••', hint: 'Profile → Long-Lived Access Tokens' },
  ],

  async fetchData(creds) {
    const res    = await fetch(`${creds.host}/api/states`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    })
    if (!res.ok) throw new Error(`HA API returned ${res.status}`)
    const states = await res.json() as Array<{
      entity_id: string
      state: string
      last_updated: string
      attributes: Record<string, unknown>
    }>
    return states.map(s => ({
      entityId:     s.entity_id,
      domain:       s.entity_id.split('.')[0],
      name:         String(s.attributes.friendly_name ?? s.entity_id),
      state:        s.state,
      unit:         String(s.attributes.unit_of_measurement ?? ''),
      deviceClass:  String(s.attributes.device_class ?? ''),
      lastUpdated:  s.last_updated,
    }))
  },

  async healthCheck(creds) {
    const start = Date.now()
    try {
      const res = await fetch(`${creds.host}/api/`, {
        headers: { Authorization: `Bearer ${creds.token}` },
      })
      return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}`, latencyMs: Date.now() - start }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  },
}
