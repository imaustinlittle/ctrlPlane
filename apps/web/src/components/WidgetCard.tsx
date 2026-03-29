import { useRef, useState } from 'react'
import type { DashboardPage, WidgetDefinition, WidgetInstance } from '../types'
import { ConfigPanel }   from './panels/ConfigPanel'
import { ErrorBoundary } from './ErrorBoundary'

interface Props {
  definition:  WidgetDefinition
  instance:    WidgetInstance
  pageId:      string
  pages:       DashboardPage[]
  isEditing?:  boolean
  onRemove?:   () => void
  onMove?:     (toPageId: string) => void
}

export function WidgetCard({ definition, instance, pageId, pages, isEditing, onRemove, onMove }: Props) {
  const { component: Component, displayName, icon } = definition
  const title = (instance.config?.label as string) || displayName
  const [showConfig, setShowConfig] = useState(false)
  const [showMenu,   setShowMenu]   = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const otherPages = pages.filter(p => p.id !== pageId)

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    setShowMenu(v => !v)
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setShowMenu(false)
    setShowConfig(true)
  }

  function handleMove(e: React.MouseEvent, toPageId: string) {
    e.stopPropagation()
    setShowMenu(false)
    onMove?.(toPageId)
  }

  return (
    <>
      <div className="widget-card">

        {/* Header — drag handle only, no interactive buttons inside */}
        <div className="widget-header">
          <div className="widget-title">
            <span style={{ fontSize: 12 }}>{icon}</span>
            {title}
          </div>

          {/* Edit-mode actions — stopPropagation so drag doesn't fire */}
          {isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}
              onMouseDown={e => e.stopPropagation()}
              ref={menuRef}
            >
              <button
                onClick={openMenu}
                title="Widget options"
                style={{
                  width: 20, height: 20,
                  borderRadius: 4,
                  border: showMenu ? '1px solid var(--accent)' : '1px solid var(--border-b)',
                  background: showMenu ? 'var(--surface-h)' : 'var(--bg3)',
                  color: showMenu ? 'var(--text)' : 'var(--text2)',
                  fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.15s',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!showMenu) {
                    (e.currentTarget).style.background = 'var(--surface-h)'
                    ;(e.currentTarget).style.color = 'var(--text)'
                    ;(e.currentTarget).style.borderColor = 'var(--accent)'
                  }
                }}
                onMouseLeave={e => {
                  if (!showMenu) {
                    (e.currentTarget).style.background = 'var(--bg3)'
                    ;(e.currentTarget).style.color = 'var(--text2)'
                    ;(e.currentTarget).style.borderColor = 'var(--border-b)'
                  }
                }}
              >
                ···
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <>
                  {/* Click-outside backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 299 }}
                    onMouseDown={e => { e.stopPropagation(); setShowMenu(false) }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    zIndex: 300,
                    background: 'var(--surface)',
                    border: '1px solid var(--border-b)',
                    borderRadius: 7,
                    padding: '4px 0',
                    minWidth: 140,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    <button
                      onClick={handleEdit}
                      style={menuItemStyle}
                      onMouseEnter={e => (e.currentTarget).style.background = 'var(--bg3)'}
                      onMouseLeave={e => (e.currentTarget).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 12 }}>⚙</span> Edit config
                    </button>

                    {otherPages.length > 0 && (
                      <>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
                        <div style={{ padding: '2px 12px', fontSize: 10, color: 'var(--text2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Move to
                        </div>
                        {otherPages.map(p => (
                          <button
                            key={p.id}
                            onClick={e => handleMove(e, p.id)}
                            style={menuItemStyle}
                            onMouseEnter={e => (e.currentTarget).style.background = 'var(--bg3)'}
                            onMouseLeave={e => (e.currentTarget).style.background = 'transparent'}
                          >
                            {p.icon && <span style={{ fontSize: 12 }}>{p.icon}</span>} {p.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}

              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove() }}
                  title="Remove widget"
                  style={{
                    width: 20, height: 20,
                    borderRadius: 4,
                    border: '1px solid rgba(247,129,102,0.3)',
                    background: 'rgba(247,129,102,0.1)',
                    color: 'var(--accent-r)',
                    fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.22)' }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.1)' }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Widget content — wrapped in per-widget error boundary */}
        <ErrorBoundary label={displayName}>
          <Component
            widgetId={instance.id}
            config={instance.config}
            data={null}
            isLoading={false}
            error={null}
            lastUpdated={null}
          />
        </ErrorBoundary>
      </div>

      {showConfig && (
        <ConfigPanel
          instance={instance}
          definition={definition}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7,
  width: '100%', padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
  fontFamily: 'inherit',
}
