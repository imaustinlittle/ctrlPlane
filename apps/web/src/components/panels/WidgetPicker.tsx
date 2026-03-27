import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ALL_WIDGETS } from '../../widgets/registry'
import { useDashboardStore, useActivePage } from '../../store'
import type { WidgetInstance, WidgetLayout } from '../../types'

interface Props {
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  general:    'General',
  system:     'System',
  monitoring: 'Monitoring',
  network:    'Network',
  media:      'Media',
  automation: 'Automation',
}

const CATEGORY_ICONS: Record<string, string> = {
  general:    '✦',
  system:     '⚡',
  monitoring: '📡',
  network:    '📶',
  media:      '🎬',
  automation: '⚙',
}

export function WidgetPicker({ onClose }: Props) {
  const page      = useActivePage()
  const addWidget = useDashboardStore(s => s.addWidget)
  const [filter, setFilter] = useState<string>('all')
  const [added, setAdded]   = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const categories = ['all', ...Array.from(new Set(ALL_WIDGETS.map(w => w.category)))]

  const filtered = filter === 'all'
    ? ALL_WIDGETS
    : ALL_WIDGETS.filter(w => w.category === filter)

  const handleAdd = (widgetType: string) => {
    const def = ALL_WIDGETS.find(w => w.type === widgetType)
    if (!def) return

    const id = `${widgetType}-${Date.now()}`

    // Find a free Y position below existing widgets
    const maxY = page.layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)

    const newLayout: WidgetLayout = {
      i: id,
      x: 0,
      y: maxY,
      w: def.defaultW,
      h: def.defaultH,
      minW: def.minW,
      minH: def.minH,
    }

    const newInstance: WidgetInstance = {
      id,
      type: widgetType,
      config: {},
    }

    addWidget(page.id, newInstance, newLayout)
    setAdded(widgetType)
    setTimeout(() => setAdded(null), 1500)
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 400,
          animation: 'fade-in 0.15s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '10vh', left: '50%',
        transform: 'translateX(-50%)',
        width: 580,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '80vh',
        background: 'var(--bg2)',
        border: '1px solid var(--border-b)',
        borderRadius: 16,
        zIndex: 401,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'modal-in 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Add widget</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                Choose a widget to add to your dashboard
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--text2)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: `1px solid ${filter === cat ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === cat ? 'rgba(88,166,255,0.12)' : 'none',
                  color: filter === cat ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: filter === cat ? 600 : 400,
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {cat !== 'all' && <span style={{ fontSize: 11 }}>{CATEGORY_ICONS[cat]}</span>}
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>

        {/* Widget grid */}
        <div style={{
          overflowY: 'auto',
          padding: '16px 24px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          alignContent: 'start',
        }}>
          {filtered.map(def => {
            const isAdded = added === def.type
            return (
              <button
                key={def.type}
                onClick={() => handleAdd(def.type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '14px',
                  background: isAdded ? 'rgba(63,185,80,0.1)' : 'var(--bg3)',
                  border: `1px solid ${isAdded ? 'rgba(63,185,80,0.4)' : 'var(--border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!isAdded) {
                    (e.currentTarget).style.background = 'var(--surface-h)'
                    ;(e.currentTarget).style.borderColor = 'var(--border-b)'
                    ;(e.currentTarget).style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isAdded) {
                    (e.currentTarget).style.background = 'var(--bg3)'
                    ;(e.currentTarget).style.borderColor = 'var(--border)'
                    ;(e.currentTarget).style.transform = 'translateY(0)'
                  }
                }}
              >
                <span style={{ fontSize: 22, marginBottom: 8, display: 'block' }}>{def.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>
                  {isAdded ? '✓ Added!' : def.displayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
                  {def.description}
                </div>
                <div style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: 'var(--text2)',
                  padding: '2px 6px',
                  background: 'var(--bg)',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: 600,
                }}>
                  {CATEGORY_LABELS[def.category] ?? def.category}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>,
    document.body
  )
}
