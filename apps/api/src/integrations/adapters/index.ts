import { z } from 'zod'

// ── Normalized data envelope ──────────────────────────────────────────────────
export interface NormalizedData {
  widgetType: string
  timestamp:  Date
  status:     'ok' | 'degraded' | 'error'
  data:       unknown
  meta?:      Record<string, string | number>
}

export interface HealthResult {
  ok:      boolean
  message: string
  latencyMs?: number
}

// ── Adapter contract ──────────────────────────────────────────────────────────
export interface IntegrationAdapter<TCreds = unknown> {
  readonly key:            string
  readonly displayName:    string
  readonly description:    string
  readonly credentialsSchema: z.ZodType<TCreds, any, any>
  readonly supportedWidgets:  string[]

  healthCheck(creds: TCreds): Promise<HealthResult>
  fetchData(
    widgetType: string,
    config:     unknown,
    creds:      TCreds
  ): Promise<NormalizedData>
  handleWebhook?(
    payload: unknown,
    creds:   TCreds
  ): Promise<NormalizedData | null>
}

// ── Proxmox adapter ───────────────────────────────────────────────────────────
const ProxmoxCreds = z.object({
  host:       z.string().url(),
  tokenId:    z.string(),
  tokenSecret:z.string(),
  node:       z.string().default('pve'),
  verifySsl:  z.boolean().default(false),
})

type ProxmoxCreds = z.infer<typeof ProxmoxCreds>

export const proxmoxAdapter: IntegrationAdapter<ProxmoxCreds> = {
  key:         'proxmox',
  displayName: 'Proxmox VE',
  description: 'VM and container management, node stats',
  credentialsSchema: ProxmoxCreds,
  supportedWidgets:  ['gauge', 'containers', 'services'],

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

  async fetchData(widgetType, _config, creds) {
    const headers = { Authorization: `PVEAPIToken=${creds.tokenId}=${creds.tokenSecret}` }
    const base    = `${creds.host}/api2/json`

    if (widgetType === 'gauge') {
      const res  = await fetch(`${base}/nodes/${creds.node}/status`, { headers })
      const json = await res.json() as { data: { cpu: number; memory: { used: number; total: number }; uptime: number } }
      return {
        widgetType,
        timestamp: new Date(),
        status: res.ok ? 'ok' : 'error',
        data: {
          cpu:        Math.round(json.data.cpu * 100),
          ram:        Math.round((json.data.memory.used / json.data.memory.total) * 100),
          ramUsedGb:  parseFloat((json.data.memory.used / 1073741824).toFixed(1)),
          ramTotalGb: parseFloat((json.data.memory.total / 1073741824).toFixed(1)),
          uptime:     json.data.uptime,
        },
      }
    }

    if (widgetType === 'containers') {
      const res  = await fetch(`${base}/nodes/${creds.node}/lxc`, { headers })
      const json = await res.json() as { data: Array<{ vmid: string; name: string; status: string; cpu: number; mem: number }> }
      return {
        widgetType,
        timestamp: new Date(),
        status: res.ok ? 'ok' : 'error',
        data: json.data.map(c => ({
          id:         c.vmid,
          name:       c.name,
          image:      'lxc',
          status:     c.status === 'running' ? 'running' : 'stopped',
          cpuPercent: parseFloat((c.cpu * 100).toFixed(1)),
          memMb:      Math.round(c.mem / 1048576),
        })),
      }
    }

    return { widgetType, timestamp: new Date(), status: 'error', data: null }
  },
}

// ── Home Assistant adapter ────────────────────────────────────────────────────
const HACreds = z.object({
  host:  z.string().url(),
  token: z.string(),
})
type HACreds = z.infer<typeof HACreds>

export const homeAssistantAdapter: IntegrationAdapter<HACreds> = {
  key:         'homeassistant',
  displayName: 'Home Assistant',
  description: 'Entity states, automations, and quick actions',
  credentialsSchema: HACreds,
  supportedWidgets: ['services', 'gauge'],

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

  async fetchData(widgetType, _config, creds) {
    const headers = { Authorization: `Bearer ${creds.token}` }
    const res     = await fetch(`${creds.host}/api/states`, { headers })
    const states  = await res.json() as Array<{ entity_id: string; state: string; attributes: Record<string, unknown> }>

    if (widgetType === 'services') {
      const relevant = states.filter(s =>
        ['binary_sensor', 'sensor', 'switch', 'light'].some(d => s.entity_id.startsWith(d))
      ).slice(0, 10)
      return {
        widgetType,
        timestamp: new Date(),
        status: res.ok ? 'ok' : 'error',
        data: relevant.map(s => ({
          name:   s.attributes.friendly_name ?? s.entity_id,
          status: s.state === 'on' || s.state === 'home' || s.state === 'open' ? 'up' : 'down',
        })),
      }
    }

    return { widgetType, timestamp: new Date(), status: 'error', data: null }
  },
}

// ── Pi-hole adapter ───────────────────────────────────────────────────────────
const PiholeCreds = z.object({
  host:   z.string().url(),
  apiKey: z.string(),
})
type PiholeCreds = z.infer<typeof PiholeCreds>

export const piholeAdapter: IntegrationAdapter<PiholeCreds> = {
  key:         'pihole',
  displayName: 'Pi-hole',
  description: 'DNS blocking stats and query data',
  credentialsSchema: PiholeCreds,
  supportedWidgets: ['services', 'gauge'],

  async healthCheck(creds) {
    const start = Date.now()
    try {
      const res = await fetch(`${creds.host}/admin/api.php?auth=${creds.apiKey}&summary`)
      return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}`, latencyMs: Date.now() - start }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  },

  async fetchData(widgetType, _config, creds) {
    const res  = await fetch(`${creds.host}/admin/api.php?auth=${creds.apiKey}&summaryRaw`)
    const json = await res.json() as {
      dns_queries_today: number
      ads_blocked_today: number
      ads_percentage_today: number
      unique_clients: number
      status: string
    }
    return {
      widgetType,
      timestamp: new Date(),
      status: res.ok ? 'ok' : 'error',
      data: {
        queriesTotal:  json.dns_queries_today,
        adsBlocked:    json.ads_blocked_today,
        blockPercent:  parseFloat(json.ads_percentage_today.toFixed(1)),
        clients:       json.unique_clients,
        enabled:       json.status === 'enabled',
      },
    }
  },
}

// ── Adapter registry ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: IntegrationAdapter<any>[] = [
  proxmoxAdapter,
  homeAssistantAdapter,
  piholeAdapter,
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ADAPTER_REGISTRY = new Map<string, IntegrationAdapter<any>>(
  ADAPTERS.map(a => [a.key, a])
)

export function getAdapter(key: string) {
  return ADAPTER_REGISTRY.get(key)
}
