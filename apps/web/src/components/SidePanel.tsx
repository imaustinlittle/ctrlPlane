import { useEffect, useRef, useState } from 'react'
import { IntegrationsPane }     from './panels/IntegrationsPane'
import { IntegrationDetailPane } from './panels/IntegrationDetailPane'
import { SettingsPane }          from './panels/SettingsPane'
import { WidgetsPane }           from './panels/WidgetsPane'

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

// Settings lives at the bottom — separate from the main nav items
const TOP_NAV_ITEMS: NavItem[] = [
  { id: 'integrations', label: 'Integrations', icon: <PlugIcon /> },
  { id: 'widgets',      label: 'Widgets',      icon: <GridIcon /> },
]
const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: <GearIcon /> }

// ── Widths ────────────────────────────────────────────────────────────────────
const SLIVER_W  = 18   // closed sliver
const STAGE1_W  = 220  // nav menu only
const STAGE2_W  = 520  // nav + section content
const STAGE3_W  = 780  // nav + section content + detail panel (integrations)

// ── NavButton ─────────────────────────────────────────────────────────────────
function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '10px 12px',
        borderRadius: 8, border: 'none',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 600 : 400,
        background: active ? 'rgba(88,166,255,0.1)' : 'none',
        color: active ? 'var(--accent)' : 'var(--text2)',
        marginBottom: 2, transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'none'
          e.currentTarget.style.color = 'var(--text2)'
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
}

// ── SidePanel ─────────────────────────────────────────────────────────────────
export function SidePanel() {
  const [stage,          setStage]          = useState<0 | 1 | 2>(0)
  const [section,        setSection]        = useState<Section | null>(null)
  const [detailKey,      setDetailKey]      = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape key — retract one level at a time
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (detailKey) {
        setDetailKey(null)
        return
      }
      if (stage === 2) { setStage(1); setTimeout(() => setSection(null), 300); return }
      if (stage === 1) { setStage(0) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, detailKey])

  // Click outside — close panel without blocking the underlying click
  useEffect(() => {
    if (stage === 0) return
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeAll()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // Clear detail panel when leaving integrations
  useEffect(() => {
    if (section !== 'integrations') setDetailKey(null)
  }, [section])

  const handleNavClick = (id: Section) => {
    // Clicking the active section at stage 2 toggles it closed
    if (stage === 2 && section === id) {
      setStage(1)
      setDetailKey(null)
      setTimeout(() => setSection(null), 300)
      return
    }
    setDetailKey(null)
    setSection(id)
    setStage(2)
  }

  const closeAll = () => {
    setStage(0)
    setDetailKey(null)
    setTimeout(() => setSection(null), 300)
  }

  const showDetail = section === 'integrations' && detailKey !== null

  const panelW =
    stage === 0 ? SLIVER_W :
    stage === 1 ? STAGE1_W :
    showDetail   ? STAGE3_W : STAGE2_W

  return (
    <>
      {/* Backdrop — only at stage 2 so the nav at stage 1 never blocks widget clicks */}
      {stage === 2 && (
        <div
          onClick={closeAll}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(1px)',
            transition: 'background 0.3s, backdrop-filter 0.3s',
            cursor: 'default',
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed', top: 52, left: 0, bottom: 0,
          width: panelW, zIndex: 101,
          display: 'flex',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          pointerEvents: 'auto',
          boxShadow: '2px 0 0 0 var(--border-b), 6px 0 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Column 1: Nav rail ───────────────────────────────────────────── */}
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
          {/* Pull-tab chevron — always visible, rotates when open */}
          <button
            onClick={e => { e.stopPropagation(); stage === 0 ? setStage(1) : closeAll() }}
            title={stage === 0 ? 'Open menu' : 'Close menu'}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 18, height: 18,
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer',
              color: 'var(--accent)',
              opacity: 0.7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', transform: stage === 0 ? 'rotate(0deg)' : 'rotate(180deg)' }}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {stage > 0 && (
            <>
              {/* Header */}
              <div style={{
                padding: '20px 16px 12px',
                fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                textTransform: 'uppercase', color: 'var(--text2)',
                flexShrink: 0,
              }}>
                Menu
              </div>

              {/* Top nav items */}
              <nav style={{ padding: '4px 8px', flex: 1 }}>
                {TOP_NAV_ITEMS.map(item => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={stage === 2 && section === item.id}
                    onClick={() => handleNavClick(item.id)}
                  />
                ))}
              </nav>

              {/* Settings pinned to bottom */}
              <div style={{ padding: '8px 8px', borderTop: '1px solid var(--border)' }}>
                <NavButton
                  item={SETTINGS_ITEM}
                  active={stage === 2 && section === 'settings'}
                  onClick={() => handleNavClick('settings')}
                />
              </div>

              {/* Version */}
              <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                ctrlPlane v{__APP_VERSION__}
              </div>
            </>
          )}
        </div>

        {/* ── Column 2: Section content ────────────────────────────────────── */}
        <div style={{
          width: STAGE2_W - STAGE1_W,
          flexShrink: 0,
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
          {/* Section header */}
          {section && (
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--accent)' }}>
                  {[...TOP_NAV_ITEMS, SETTINGS_ITEM].find(n => n.id === section)?.icon}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {[...TOP_NAV_ITEMS, SETTINGS_ITEM].find(n => n.id === section)?.label}
                </span>
              </div>
              <button
                onClick={() => handleNavClick(section)}
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                title="Close"
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)' }}
              >✕</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {section === 'integrations' && (
              <IntegrationsPane selectedKey={detailKey} onSelect={setDetailKey} />
            )}
            {section === 'widgets'      && <WidgetsPane />}
            {section === 'settings'     && <SettingsPane />}
          </div>
        </div>

        {/* ── Column 3: Detail panel (integrations only) ───────────────────── */}
        <div style={{
          flex: 1,
          background: 'rgba(13,17,23,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: showDetail ? 1 : 0,
          transform: showDetail ? 'translateX(0)' : 'translateX(-16px)',
          transition: 'opacity 0.2s ease, transform 0.22s ease',
          pointerEvents: showDetail ? 'auto' : 'none',
        }}>
          {/* Detail header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Configure
            </span>
            <button
              onClick={() => setDetailKey(null)}
              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              title="Close"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text2)' }}
            >✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {detailKey && <IntegrationDetailPane integrationKey={detailKey} />}
          </div>
        </div>
      </div>
    </>
  )
}
