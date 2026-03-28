import type { IntegrationDefinition } from '../../types'

export const integration: IntegrationDefinition = {
  key: 'homeassistant',
  displayName: 'Home Assistant',
  icon: '🏠',
  description: 'Entity states, automations, and quick actions',
  docsUrl: 'https://developers.home-assistant.io/docs/api/rest/',
  fields: [
    { key: 'host',  label: 'URL',              type: 'url',      placeholder: 'http://homeassistant.local:8123' },
    { key: 'token', label: 'Long-lived Token', type: 'password', placeholder: '••••••••', hint: 'Profile → Long-Lived Access Tokens' },
  ],

  async fetchData(creds) {
    const res    = await fetch(`${creds.host}/api/states`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    })
    const states = await res.json() as Array<{
      entity_id: string; state: string; attributes: Record<string, unknown>
    }>
    const relevant = states
      .filter(s => ['binary_sensor', 'sensor', 'switch', 'light'].some(d => s.entity_id.startsWith(d)))
      .slice(0, 10)
    return relevant.map(s => ({
      name:   s.attributes.friendly_name ?? s.entity_id,
      status: ['on', 'home', 'open'].includes(s.state) ? 'up' : 'down',
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
