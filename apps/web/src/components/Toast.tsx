import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id:        string
  type:      ToastType
  title:     string
  message?:  string
  duration?: number   // ms, 0 = sticky
  onRetry?:  () => void
}

// ── Global toast emitter ──────────────────────────────────────────────────────
// Components call addToast() directly without needing a context provider

type Listener = (toast: Toast) => void
const listeners: Listener[] = []

export function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const full: Toast = { duration: 4000, ...toast, id }
  listeners.forEach(l => l(full))
}

function subscribe(fn: Listener) {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

const TOAST_COLORS: Record<ToastType, { icon: string; bar: string; bg: string; border: string }> = {
  success: {
    icon:   'var(--accent-g)',
    bar:    'var(--accent-g)',
    bg:     'rgba(63,185,80,0.08)',
    border: 'rgba(63,185,80,0.25)',
  },
  error: {
    icon:   'var(--accent-r)',
    bar:    'var(--accent-r)',
    bg:     'rgba(247,129,102,0.08)',
    border: 'rgba(247,129,102,0.25)',
  },
  info: {
    icon:   'var(--accent)',
    bar:    'var(--accent)',
    bg:     'rgba(88,166,255,0.08)',
    border: 'rgba(88,166,255,0.25)',
  },
}

// ── Single toast card ─────────────────────────────────────────────────────────
function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible]   = useState(false)
  const [progress, setProgress] = useState(100)
  const colors = TOAST_COLORS[toast.type]

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Progress bar + auto dismiss
  useEffect(() => {
    if (!toast.duration) return
    const start    = Date.now()
    const duration = toast.duration

    const tick = () => {
      const elapsed = Date.now() - start
      const pct     = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        handleDismiss()
      }
    }

    let raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [toast.duration])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 250)
  }

  return (
    <div
      style={{
        width: 340,
        background: 'var(--bg2)',
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(100%) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease',
        cursor: 'pointer',
      }}
      onClick={handleDismiss}
    >
      {/* Content */}
      <div style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }}>
          {toast.type === 'success' ? <SuccessIcon /> : toast.type === 'error' ? <ErrorIcon /> : <InfoIcon />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: toast.message ? 3 : 0 }}>
            {toast.title}
          </div>
          {toast.message && (
            <div style={{
              fontSize: 12,
              color: 'var(--text2)',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              fontFamily: toast.type === 'error' ? "'JetBrains Mono', monospace" : 'inherit',
            }}>
              {toast.message}
            </div>
          )}
          {toast.onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); toast.onRetry?.(); handleDismiss() }}
              style={{
                marginTop: 8,
                padding: '3px 10px',
                borderRadius: 5,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
                color: colors.icon,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          style={{
            width: 20, height: 20, borderRadius: 4,
            border: 'none', background: 'none',
            color: 'var(--text2)', cursor: 'pointer',
            fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Progress bar */}
      {!!toast.duration && (
        <div style={{ height: 2, background: 'var(--border)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: colors.bar,
            transition: 'width 0.1s linear',
          }} />
        </div>
      )}
    </div>
  )
}

// ── Toast container ───────────────────────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return subscribe(toast => {
      setToasts(prev => [...prev, toast])
    })
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard toast={toast} onDismiss={() => dismiss(toast.id)} />
        </div>
      ))}
    </div>,
    document.body
  )
}
