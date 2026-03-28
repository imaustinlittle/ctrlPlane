import type { IntegrationDefinition } from '../../types'

export const integration: IntegrationDefinition = {
  key: 'proxmox',
  displayName: 'Proxmox VE',
  icon: '🖥️',
  description: 'VM and container management, node stats',
  docsUrl: 'https://pve.proxmox.com/wiki/Proxmox_VE_API',
  fields: [
    { key: 'host',        label: 'URL',          type: 'url',      placeholder: 'https://pve.local:8006' },
    { key: 'tokenId',     label: 'Token ID',     type: 'text',     placeholder: 'user@pam!mytoken', hint: 'Format: user@realm!tokenname' },
    { key: 'tokenSecret', label: 'Token Secret', type: 'password', placeholder: '••••••••' },
    { key: 'node',        label: 'Node',         type: 'text',     placeholder: 'pve', hint: 'Proxmox node name' },
  ],

  async fetchData(creds) {
    const headers = { Authorization: `PVEAPIToken=${creds.tokenId}=${creds.tokenSecret}` }
    const node    = creds.node || 'pve'
    const res     = await fetch(`${creds.host}/api2/json/nodes/${node}/status`, { headers })
    const json    = await res.json() as {
      data: { cpu: number; memory: { used: number; total: number }; uptime: number }
    }
    return {
      cpu:        Math.round(json.data.cpu * 100),
      ram:        Math.round((json.data.memory.used / json.data.memory.total) * 100),
      ramUsedGb:  parseFloat((json.data.memory.used  / 1_073_741_824).toFixed(1)),
      ramTotalGb: parseFloat((json.data.memory.total / 1_073_741_824).toFixed(1)),
      uptime:     json.data.uptime,
    }
  },

  async healthCheck(creds) {
    const start = Date.now()
    try {
      const res = await fetch(`${creds.host}/api2/json/version`, {
        headers: { Authorization: `PVEAPIToken=${creds.tokenId}=${creds.tokenSecret}` },
      })
      return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}`, latencyMs: Date.now() - start }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  },
}
