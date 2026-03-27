import { useEffect, useRef, useState } from 'react'
import { IntegrationsPane } from './panels/IntegrationsPane'
import { SettingsPane }     from './panels/SettingsPane'
import { WidgetsPane }      from './panels/WidgetsPane'

// ── Types ─────────────────────────────────────────────────────────────────────
type Section = 'integrations' | 'widgets' | 'settings'

interface NavItem {
  id:    Section
  label: string
  icon:  React.ReactNode
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlugIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/>
    <path d="M18 8H6a2 2 0 0 0-2 2v3a6 6 0 0 0 12 0v-3a2 2 0 0 0-2-2z"/>
  </svg>
)
const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { id: 'integrations', label: 'Integrations', icon: <PlugIcon /> },
  { id: 'widgets',      label: 'Widgets',      icon: <GridIcon /> },
  { id: 'settings',     label: 'Settings',     icon: <GearIcon /> },
]

const SLIVER_W  = 18   // px — closed sliver
const STAGE1_W  = 220  // px — nav menu
const STAGE2_W  = 540  // px — nav rail + content

// ── SidePanel ─────────────────────────────────────────────────────────────────
export function SidePanel() {
  const [stage,    setStage]    = useState<0 | 1 | 2>(0)
  const [section,  setSection]  = useState<Section | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key — retract one stage at a time
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setStage(s => {
        if (s === 2) { return 1 }
        if (s === 1) { return 0 }
        return 0
      })
      if (stage === 1) setSection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage])

  const openSection = (id: Section) => {
    setSection(id)
    setStage(2)
  }

  const closeStage2 = () => {
    setStage(1)
    // Don't clear section immediately — let slide animation finish
    setTimeout(() => setSection(null), 300)
  }

  const closeAll = () => {
    setStage(0)
    setTimeout(() => setSection(null), 300)
  }

  const panelW =
    stage === 0 ? SLIVER_W :
    stage === 1 ? STAGE1_W :
                  STAGE2_W

  // ── Rail items (visible in both stage 1 and stage 2) ─────────────────────
  return (
    <>
      {/* Backdrop — clicking dashboard closes the panel */}
      {stage > 0 && (
        <div
          onClick={closeAll}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 100,
            // Transparent — just captures clicks on the dashboard
            background: stage === 2 ? 'rgba(0,0,0,0.3)' : 'transparent',
            backdropFilter: stage === 2 ? 'blur(1px)' : 'none',
            transition: 'background 0.3s, backdrop-filter 0.3s',
            cursor: 'default',
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 52,          // below topbar
          left: 0,
          bottom: 0,
          width: panelW,
          zIndex: 101,
          display: 'flex',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Sliver / Stage 1 nav */}
        <div style={{
          width: stage === 0 ? SLIVER_W : STAGE1_W,
          flexShrink: 0,
          background: 'rgba(13,17,23,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1.5px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: stage === 0 ? 'pointer' : 'default',
          boxShadow: stage > 0 ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
          position: 'relative',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), background 0.2s ease',
        }}
          onClick={stage === 0 ? () => setStage(1) : undefined}
          title={stage === 0 ? 'Open menu' : undefined}
          onMouseEnter={stage === 0 ? (e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(13,17,23,0.78)' }) : undefined}
          onMouseLeave={stage === 0 ? (e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(13,17,23,0.6)' }) : undefined}
        >
          {stage === 0 && (
            /* Texture lines — centered in the sliver */
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
              pointerEvents: 'none',
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 3, height: 1,
                  background: 'var(--text2)',
                  borderRadius: 1,
                  opacity: 0.35,
                }} />
              ))}
            </div>
          )}

          {stage > 0 && (
            <>
              {/* Stage 1 header */}
              <div style={{
                padding: '20px 16px 12px',
                fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                textTransform: 'uppercase', color: 'var(--text2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <span>Menu</span>
                <button
                  onClick={closeAll}
                  style={{
                    width: 22, height: 22, borderRadius: 4,
                    border: 'none', background: 'none',
                    color: 'var(--text2)', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>

              {/* Nav items */}
              <nav style={{ padding: '4px 8px', flex: 1 }}>
                {NAV_ITEMS.map(item => {
                  const active = stage === 2 && section === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => openSection(item.id)}
                      style={{
                        width: '100%', padding: '10px 12px',
                        borderRadius: 8, border: 'none',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400,
                        background: active ? 'rgba(88,166,255,0.1)' : 'none',
                        color: active ? 'var(--accent)' : 'var(--text2)',
                        marginBottom: 2,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget).style.background = 'var(--surface)'
                          ;(e.currentTarget).style.color = 'var(--text)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget).style.background = 'none'
                          ;(e.currentTarget).style.color = 'var(--text2)'
                        }
                      }}
                    >
                      <span style={{ opacity: active ? 1 : 0.7, color: active ? 'var(--accent)' : 'inherit' }}>
                        {item.icon}
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        style={{ marginLeft: 'auto', opacity: 0.4 }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  )
                })}
              </nav>

              {/* Version footer */}
              <div style={{ padding: '12px 16px', fontSize: 10, color: 'var(--text2)', borderTop: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                ctrlPlane
              </div>
            </>
          )}
        </div>

        {/* Stage 2 content pane */}
        <div style={{
          flex: 1,
          background: 'rgba(13,17,23,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: stage === 2 ? 1 : 0,
          transform: stage === 2 ? 'translateX(0)' : 'translateX(-12px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: stage === 2 ? 'auto' : 'none',
          boxShadow: stage === 2 ? '4px 0 24px rgba(0,0,0,0.25)' : 'none',
        }}>
          {/* Content header */}
          {section && (
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--accent)' }}>
                  {NAV_ITEMS.find(n => n.id === section)?.icon}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {NAV_ITEMS.find(n => n.id === section)?.label}
                </span>
              </div>
              <button
                onClick={closeStage2}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  border: '1px solid var(--border)', background: 'none',
                  color: 'var(--text2)', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                title="Back to menu"
                onMouseEnter={e => { (e.currentTarget).style.background = 'var(--surface)'; (e.currentTarget).style.color = 'var(--text)' }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'var(--text2)' }}
              >✕</button>
            </div>
          )}

          {/* Content body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {section === 'integrations' && <IntegrationsPane />}
            {section === 'widgets'      && <WidgetsPane />}
            {section === 'settings'     && <SettingsPane />}
          </div>
        </div>
      </div>
    </>
  )
}
