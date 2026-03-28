import type { IntegrationDefinition } from '../../types'

export const integration: IntegrationDefinition = {
  key: 'docker',
  displayName: 'Docker',
  icon: '🐳',
  description: 'Container stats via Docker TCP API',
  docsUrl: 'https://docs.docker.com/engine/api/',
  fields: [
    {
      key: 'host', label: 'Docker API URL', type: 'url',
      placeholder: 'http://host:2375',
      hint: 'Enable with: dockerd -H tcp://0.0.0.0:2375',
    },
  ],

  async fetchData(creds) {
    const res  = await fetch(`${creds.host}/containers/json?all=true`)
    const json = await res.json() as Array<{
      Id: string; Names: string[]; Image: string; State: string
    }>
    return json.map(c => ({
      id:         c.Id.slice(0, 12),
      name:       c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
      image:      c.Image,
      status:     c.State === 'running' ? 'running' : c.State === 'exited' ? 'exited' : 'stopped',
      cpuPercent: 0,
      memMb:      0,
    }))
  },

  async healthCheck(creds) {
    const start = Date.now()
    try {
      const res = await fetch(`${creds.host}/version`)
      return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}`, latencyMs: Date.now() - start }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  },
}
