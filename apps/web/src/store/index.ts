import { create } from 'zustand'
import type {
  DashboardPage,
  WidgetInstance,
  WidgetLayout,
  ThemeConfig,
  AlertEvent,
} from '../types'
import { BUILT_IN_THEMES } from '../types'
import { DEFAULT_PAGES } from './defaults'
import { loadState, scheduleSave, saveState } from './apiState'
import { addToast } from '../components/Toast'

// ── Demo alerts — fresh timestamps every load ────────────────────────────────
function makeDemoAlerts(): AlertEvent[] {
  const now = Date.now()
  return [
    {
      id: 'a1', ruleId: 'r1', ruleName: 'Sonarr offline',
      widgetId: 'services', severity: 'critical', status: 'firing',
      message: 'Sonarr unreachable — container exited unexpectedly',
      firedAt: new Date(now - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'a2', ruleId: 'r2', ruleName: 'Proxmox latency',
      widgetId: 'services', severity: 'warning', status: 'firing',
      message: 'Proxmox node latency elevated (180ms, threshold 100ms)',
      firedAt: new Date(now - 8 * 60 * 1000).toISOString(),
    },
    {
      id: 'a3', ruleId: 'r3', ruleName: 'Disk /data high',
      widgetId: 'storage', severity: 'info', status: 'firing',
      message: 'Disk /data at 78% capacity — consider expanding',
      firedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    },
  ]
}

// ── Apply theme to CSS variables ─────────────────────────────────────────────
export function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement.style
  root.setProperty('--accent', theme.accent)
  if (theme.bg)      root.setProperty('--bg', theme.bg)
  if (theme.surface) root.setProperty('--surface', theme.surface)
}

// ── Store interface ───────────────────────────────────────────────────────────
interface DashboardStore {
  pages:        DashboardPage[]
  activePageId: string
  isEditing:    boolean
  theme:        ThemeConfig
  alerts:       AlertEvent[]
  saveStatus:   'idle' | 'saving' | 'saved' | 'error'
  isLoaded:     boolean   // true once API load attempt completes

  setActivePage:      (id: string) => void
  toggleEditMode:     () => void
  updateLayout:       (pageId: string, layout: WidgetLayout[]) => void
  addWidget:          (pageId: string, widget: WidgetInstance, layout: WidgetLayout) => void
  removeWidget:       (pageId: string, widgetId: string) => void
  addPage:            (name: string, icon?: string) => void
  removePage:         (pageId: string) => void
  renamePage:         (pageId: string, name: string, icon?: string) => void
  updateWidgetConfig: (pageId: string, widgetId: string, config: Record<string, unknown>) => void
  moveWidget:         (fromPageId: string, toPageId: string, widgetId: string) => void
  setTheme:           (theme: ThemeConfig) => void
  addAlert:           (alert: AlertEvent) => void
  dismissAlert:       (alertId: string) => void
  dismissAllAlerts:   () => void
  ackAlert:           (alertId: string) => void
  _initFromAPI:       () => Promise<void>
  _scheduleSave:      () => void
}

export const useDashboardStore = create<DashboardStore>()((set, get) => ({
  pages:        DEFAULT_PAGES,
  activePageId: DEFAULT_PAGES[0].id,
  isEditing:    false,
  theme:        BUILT_IN_THEMES[0],
  alerts:       makeDemoAlerts(),
  saveStatus:   'idle',
  isLoaded:     false,

  // ── Load from API on startup ────────────────────────────────────────────────
  _initFromAPI: async () => {
    const saved = await loadState()
    if (saved) {
      const theme = (saved.theme as ThemeConfig) ?? BUILT_IN_THEMES[0]
      set({
        pages:        (saved.pages as DashboardPage[]) ?? DEFAULT_PAGES,
        activePageId: (saved.activePageId as string) ?? DEFAULT_PAGES[0].id,
        theme,
        isLoaded: true,
      })
      applyTheme(theme)
    } else {
      set({ isLoaded: true })
    }
  },

  // ── Save to API (called after every state change) ───────────────────────────
  _scheduleSave: () => {
    const s = get()
    set({ saveStatus: 'saving' })
    scheduleSave(
      { pages: s.pages, activePageId: s.activePageId, theme: s.theme },
      // onSuccess
      () => {
        set({ saveStatus: 'saved' })
        setTimeout(() => set({ saveStatus: 'idle' }), 2000)
      },
      // onError
      (errMsg) => {
        set({ saveStatus: 'error' })
        setTimeout(() => set({ saveStatus: 'idle' }), 5000)

        // Show error toast
        addToast({
          type:    'error',
          title:   'Failed to save dashboard',
          message: errMsg,
          duration: 0,  // sticky — user must dismiss
          onRetry: () => get()._scheduleSave(),
        })

        // Also log to alert center
        get().addAlert({
          id:       `save-err-${Date.now()}`,
          ruleId:   'system',
          ruleName: 'Save failed',
          widgetId: 'system',
          severity: 'critical',
          status:   'firing',
          message:  `Dashboard save failed: ${errMsg}`,
          firedAt:  new Date().toISOString(),
        })
      }
    )
  },

  // ── Actions ──────────────────────────────────────────────────────────────────
  setActivePage: (id) => {
    set({ activePageId: id })
    // Save silently — no UI indicator for tab switches
    const s = get()
    saveState({ pages: s.pages, activePageId: id, theme: s.theme })
      .catch(() => {}) // best-effort, ignore errors
  },

  toggleEditMode: () => {
    const wasEditing = get().isEditing
    set((s) => ({ isEditing: !s.isEditing }))
    // Only save when exiting edit mode
    if (wasEditing) get()._scheduleSave()
  },

  updateLayout: (pageId, layout) => {
    set((s) => ({ pages: s.pages.map(p => p.id === pageId ? { ...p, layout } : p) }))
  },

  addWidget: (pageId, widget, layout) => {
    set((s) => ({
      pages: s.pages.map(p =>
        p.id === pageId
          ? { ...p, widgets: [...p.widgets, widget], layout: [...p.layout, layout] }
          : p
      ),
    }))
  },

  removeWidget: (pageId, widgetId) => {
    set((s) => ({
      pages: s.pages.map(p =>
        p.id === pageId
          ? { ...p, widgets: p.widgets.filter(w => w.id !== widgetId), layout: p.layout.filter(l => l.i !== widgetId) }
          : p
      ),
    }))
  },

  updateWidgetConfig: (pageId, widgetId, config) => {
    set((s) => ({
      pages: s.pages.map(p =>
        p.id === pageId
          ? { ...p, widgets: p.widgets.map(w => w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w) }
          : p
      ),
    }))
    get()._scheduleSave()
  },

  moveWidget: (fromPageId, toPageId, widgetId) => {
    const s = get()
    const fromPage = s.pages.find(p => p.id === fromPageId)
    if (!fromPage) return
    const widget = fromPage.widgets.find(w => w.id === widgetId)
    if (!widget) return
    // Place at bottom of destination page
    const toPage = s.pages.find(p => p.id === toPageId)
    const maxY = toPage ? Math.max(0, ...toPage.layout.map(l => l.y + l.h)) : 0
    const srcLayout = fromPage.layout.find(l => l.i === widgetId)
    const newLayout = srcLayout ? { ...srcLayout, x: 0, y: maxY } : { i: widgetId, x: 0, y: maxY, w: 4, h: 2 }
    set((s) => ({
      pages: s.pages.map(p => {
        if (p.id === fromPageId) return { ...p, widgets: p.widgets.filter(w => w.id !== widgetId), layout: p.layout.filter(l => l.i !== widgetId) }
        if (p.id === toPageId)   return { ...p, widgets: [...p.widgets, widget], layout: [...p.layout, newLayout] }
        return p
      }),
    }))
    get()._scheduleSave()
  },

  addPage: (name, icon) => {
    set((s) => ({
      pages: [...s.pages, { id: `page-${Date.now()}`, name, icon: icon ?? '📄', layout: [], widgets: [] }],
    }))
  },

  removePage: (pageId) => {
    set((s) => ({
      pages:        s.pages.filter(p => p.id !== pageId),
      activePageId: s.activePageId === pageId
        ? (s.pages.find(p => p.id !== pageId)?.id ?? s.pages[0].id)
        : s.activePageId,
    }))
  },

  renamePage: (pageId, name, icon) => {
    set((s) => ({
      pages: s.pages.map(p => p.id === pageId ? { ...p, name, icon: icon ?? p.icon } : p),
    }))
  },

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
  },

  addAlert: (alert) =>
    set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 50) })),

  dismissAlert: (alertId) =>
    set((s) => ({ alerts: s.alerts.filter(a => a.id !== alertId) })),
  dismissAllAlerts: () => set({ alerts: [] }),

  ackAlert: (alertId) =>
    set((s) => ({
      alerts: s.alerts.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged', ackedAt: new Date().toISOString() } : a
      ),
    })),
}))

// ── Selectors ─────────────────────────────────────────────────────────────────
export const useActivePage = () => {
  const pages        = useDashboardStore(s => s.pages)
  const activePageId = useDashboardStore(s => s.activePageId)
  return pages.find(p => p.id === activePageId) ?? pages[0]
}

export const useActiveAlerts = () => {
  const alerts = useDashboardStore(s => s.alerts)
  return alerts.filter(a => a.status === 'firing')
}
