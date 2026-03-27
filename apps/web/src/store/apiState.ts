import type { DashboardPage, ThemeConfig } from '../types'

export interface PersistedState {
  pages:        DashboardPage[]
  activePageId: string
  theme:        ThemeConfig
}

const STATE_URL   = '/api/state'
const LS_KEY      = 'ctrlplane-dashboard'
const DEBOUNCE_MS = 1500

// ── Load ──────────────────────────────────────────────────────────────────────
export async function loadState(): Promise<PersistedState | null> {
  // 1. Try API first
  try {
    const res = await fetch(STATE_URL)
    if (res.ok) {
      const json = await res.json() as { data: PersistedState }
      if (json.data) return json.data
    }
    // 404 = no state saved yet, fall through
  } catch {
    // API unavailable — fall through to localStorage migration
  }

  // 2. One-time migration from localStorage
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: PersistedState }
      if (parsed?.state) {
        // Save to API in background, clear localStorage on success
        saveState(parsed.state).then(err => {
          if (!err) localStorage.removeItem(LS_KEY)
        })
        return parsed.state
      }
    }
  } catch {
    // Corrupt localStorage — ignore
  }

  return null
}

// ── Save ──────────────────────────────────────────────────────────────────────
// Use a single stable timer. Each call updates the pending state and callbacks.
let saveTimer:   ReturnType<typeof setTimeout> | null = null
let pendingState: PersistedState | null = null
let pendingSuccess: (() => void) | null = null
let pendingError:   ((err: string) => void) | null = null

export function scheduleSave(
  state:     PersistedState,
  onSuccess: () => void,
  onError:   (err: string) => void,
) {
  // Always update to latest state and callbacks
  pendingState   = state
  pendingSuccess = onSuccess
  pendingError   = onError

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (!pendingState) return
    const err = await saveState(pendingState)
    if (err) pendingError?.(err)
    else     pendingSuccess?.()
    pendingState = pendingSuccess = pendingError = null
    saveTimer    = null
  }, DEBOUNCE_MS)
}

export async function saveState(state: PersistedState): Promise<string | null> {
  try {
    const res = await fetch(STATE_URL, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(state),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      return json.error ?? `HTTP ${res.status}`
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
