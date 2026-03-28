// ── Layout & Dashboard ──────────────────────────────────────────────────────

// Matches react-grid-layout v1 Layout object shape
export interface WidgetLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
}

export interface DashboardPage {
  id: string
  name: string
  icon?: string
  layout: WidgetLayout[]
  widgets: WidgetInstance[]
}

export interface Dashboard {
  id: string
  name: string
  pages: DashboardPage[]
  theme: ThemeConfig
  createdAt: string
  updatedAt: string
}

// ── Widget System ───────────────────────────────────────────────────────────

export type WidgetCategory =
  | 'system'
  | 'media'
  | 'network'
  | 'general'
  | 'monitoring'
  | 'automation'

export interface WidgetInstance {
  id: string
  type: string
  config: Record<string, unknown>
  integrationId?: string
}

export interface WidgetProps<TConfig = Record<string, unknown>, TData = unknown> {
  widgetId: string
  config: TConfig
  data: TData | null
  isLoading: boolean
  error?: string | null
  lastUpdated: Date | null
  onAction?: (action: string, params?: unknown) => void
}

export interface WidgetDefinition<TConfig = Record<string, unknown>, TData = unknown> {
  type: string
  displayName: string
  description: string
  icon: string
  category: WidgetCategory
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  maxW?: number
  maxH?: number
  /** Optional: return dynamic min dimensions based on current config and current grid width. */
  getMinSize?: (config: TConfig, layout: { w: number }) => { minW: number; minH: number }
  component: React.ComponentType<WidgetProps<TConfig, TData>>
}

// ── Theme ───────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  id: string
  name: string
  accent: string
  bg?: string
  surface?: string
  background?: string
}

export const BUILT_IN_THEMES: ThemeConfig[] = [
  { id: 'dark-slate', name: 'Dark Slate',      accent: '#58a6ff', bg: '#0d1117', surface: 'rgba(255,255,255,0.04)' },
  { id: 'nord',       name: 'Nord',            accent: '#88c0d0', bg: '#2e3440', surface: 'rgba(255,255,255,0.05)' },
  { id: 'mocha',      name: 'Catppuccin Mocha',accent: '#cba6f7', bg: '#1e1e2e', surface: 'rgba(255,255,255,0.04)' },
  { id: 'gruvbox',    name: 'Gruvbox',         accent: '#fabd2f', bg: '#282828', surface: 'rgba(255,255,255,0.05)' },
  { id: 'everforest', name: 'Everforest',      accent: '#a7c080', bg: '#272e33', surface: 'rgba(255,255,255,0.05)' },
]

// ── Integrations ────────────────────────────────────────────────────────────

export type IntegrationStatus = 'ok' | 'degraded' | 'error' | 'unknown'

export interface IntegrationInstance {
  id: string
  name: string
  adapterKey: string
  enabled: boolean
  status: IntegrationStatus
  lastPolledAt?: string
}

export interface IntegrationFieldDef {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'password' | 'url' | 'number'
  hint?: string
}

export interface IntegrationDefinition {
  /** Unique key shared across all widgets that use the same credentials (e.g. 'proxmox'). */
  key: string
  displayName: string
  icon: string
  description: string
  docsUrl?: string
  /** Fields collected from the user to configure this integration. */
  fields: IntegrationFieldDef[]
  /** Fetch data for this widget from the external service. Runs server-side via the API proxy. */
  fetchData(credentials: Record<string, string>, widgetConfig?: Record<string, unknown>): Promise<unknown>
  /** Optional connection health check. */
  healthCheck?(credentials: Record<string, string>): Promise<{ ok: boolean; message: string; latencyMs?: number }>
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus   = 'firing' | 'resolved' | 'acknowledged' | 'snoozed'

export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  widgetId: string
  severity: AlertSeverity
  status: AlertStatus
  message: string
  firedAt: string
  resolvedAt?: string
  ackedAt?: string
}

// ── Mock data helpers ────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpu: number
  ram: number
  ramUsedGb: number
  ramTotalGb: number
  temp: number
  fanRpm: number
  uptime: number
}

export interface ServiceStatus {
  name: string
  url: string
  status: 'up' | 'down' | 'warn'
  pingMs?: number
  icon?: string
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: 'running' | 'exited' | 'stopped' | 'paused'
  cpuPercent: number
  memMb: number
}

export interface StorageMount {
  mount: string
  label: string
  usedGb: number
  totalGb: number
}

export interface NetworkStats {
  uploadMbps: number
  downloadMbps: number
  latencyMs: number
  history: { up: number; down: number }[]
}

export interface WeatherData {
  tempF: number
  condition: string
  emoji: string
  humidity: number
  windMph: number
  location: string
}
