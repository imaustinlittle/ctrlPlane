import { useMemo, useState } from 'react'
import { useDashboardStore } from '../store'
import { TabManager } from './panels/TabManager'
import { useAlertData, resolveAlertEvent } from '../widgets/shared/useAlertData'

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const CheckIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const SpinIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M12 2a10 10 0 0 1 0 20"/>
  </svg>
)
const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

export function Topbar() {
  const pages        = useDashboardStore(s => s.pages)
  const activePageId = useDashboardStore(s => s.activePageId)
  const isEditing    = useDashboardStore(s => s.isEditing)
  const theme        = useDashboardStore(s => s.theme)
  const saveStatus   = useDashboardStore(s => s.saveStatus)
  const setActivePage  = useDashboardStore(s => s.setActivePage)
  const toggleEditMode = useDashboardStore(s => s.toggleEditMode)
  const removePage     = useDashboardStore(s => s.removePage)

  const { events } = useAlertData()
  const alerts    = useMemo(() => events.filter(a => a.status === 'firing'), [events])
  const critCount = useMemo(() => alerts.filter(a => a.severity === 'critical').length, [alerts])

  const [showTabs,       setShowTabs]       = useState(false)
  const [confirmTabId,   setConfirmTabId]   = useState<string | null>(null)

  const handleRemoveTab = (pageId: string, e: { stopPropagation(): void }) => {
    e.stopPropagation()
    if (confirmTabId === pageId) {
      removePage(pageId)
      if (activePageId === pageId) {
        const next = pages.find((p: { id: string }) => p.id !== pageId)
        setActivePage(next?.id ?? pages[0].id)
      }
      setConfirmTabId(null)
    } else {
      setConfirmTabId(pageId)
      setTimeout(() => setConfirmTabId(null), 2500)
    }
  }

  const statusColor =
    saveStatus === 'saved' ? 'var(--accent-g)' :
    saveStatus === 'error' ? 'var(--accent-r)' : 'var(--accent)'

  const editBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 7, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.3s ease',
    background:
      saveStatus === 'saved'  ? 'rgba(63,185,80,0.12)'   :
      saveStatus === 'error'  ? 'rgba(247,129,102,0.12)' :
      saveStatus === 'saving' ? 'rgba(88,166,255,0.08)'  :
      isEditing ? 'rgba(88,166,255,0.12)' : 'var(--surface)',
    border: `1px solid ${
      saveStatus === 'saved'  ? 'rgba(63,185,80,0.4)'   :
      saveStatus === 'error'  ? 'rgba(247,129,102,0.4)' :
      saveStatus === 'saving' ? 'rgba(88,166,255,0.2)'  :
      isEditing ? 'rgba(88,166,255,0.4)' : 'var(--border)'}`,
    color: saveStatus !== 'idle' ? statusColor : isEditing ? 'var(--accent)' : 'var(--text2)',
  }

  return (
    <>
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: 52,
      background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 200, flexShrink: 0, overflow: 'visible',
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 15 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, fontSize: 14, fontWeight: 700,
          background: `linear-gradient(135deg, ${theme.accent}, #d2a8ff)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>⬡</div>
        <span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--accent)',
            fontWeight: 500,
            letterSpacing: '-1px',
            background: 'rgba(88,166,255,0.1)',
            border: '1px solid rgba(88,166,255,0.2)',
            borderRadius: 4,
            padding: '1px 5px',
          }}>ctrl</span>
          <span style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: '-0.3px' }}>Plane</span>
        </span>
      </div>

      {/* Tabs — absolutely centered */}
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <nav style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {pages.map(page => {
            const active = page.id === activePageId
            return (
              <button
                key={page.id}
                onClick={() => setActivePage(page.id)}
                style={{
                  padding: '4px 14px', fontSize: 13, borderRadius: 5,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? 'var(--bg3)' : 'none',
                  color: active ? 'var(--text)' : 'var(--text2)',
                  border: active ? '1px solid var(--border-b)' : '1px solid transparent',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget).style.color = 'var(--text)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget).style.color = 'var(--text2)' }}
              >
                {page.icon && <span style={{ fontSize: 12 }}>{page.icon}</span>}
                {page.name}
                {isEditing && pages.length > 1 && (
                  <span
                    onClick={(e: { stopPropagation(): void }) => handleRemoveTab(page.id, e)}
                    title={confirmTabId === page.id ? 'Click again to confirm' : 'Remove tab'}
                    style={{
                      marginLeft: 2,
                      fontSize: 10,
                      lineHeight: 1,
                      color: confirmTabId === page.id ? 'var(--accent-r)' : 'var(--text2)',
                      opacity: confirmTabId === page.id ? 1 : 0.6,
                      transition: 'all 0.15s',
                    }}
                  >
                    {confirmTabId === page.id ? '?' : '×'}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {isEditing && (
          <button
            onClick={() => setShowTabs(true)}
            title="Manage tabs"
            style={{
              width: 26, height: 26, borderRadius: 6, fontSize: 14, marginLeft: 8,
              background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--accent)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(88,166,255,0.18)' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(88,166,255,0.08)' }}
          >+</button>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Alert badge */}
        {alerts.length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: critCount > 0 ? 'rgba(247,129,102,0.12)' : 'rgba(255,166,87,0.12)',
              border: `1px solid ${critCount > 0 ? 'rgba(247,129,102,0.3)' : 'rgba(255,166,87,0.3)'}`,
              color: critCount > 0 ? 'var(--accent-r)' : 'var(--accent-y)',
            }}
            onClick={() => alerts.forEach((a: { id: string }) => resolveAlertEvent(a.id))}
          >
            <span className="animate-pulse-dot" style={{
              width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
              background: critCount > 0 ? 'var(--accent-r)' : 'var(--accent-y)',
            }} />
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </div>
        )}


        {/* Edit button */}
        <button
          onClick={toggleEditMode}
          style={editBtnStyle}
          title={
            saveStatus === 'saving' ? 'Saving...' :
            saveStatus === 'saved'  ? 'Saved!'    :
            saveStatus === 'error'  ? 'Save failed' :
            isEditing ? 'Save layout' : 'Edit layout'
          }
        >
          {saveStatus === 'saving' ? <SpinIcon />  :
           saveStatus === 'saved'  ? <CheckIcon /> :
           saveStatus === 'error'  ? <ErrorIcon /> :
           isEditing               ? <CheckIcon /> :
                                     <PencilIcon />}
        </button>

      </div>
    </header>

    {showTabs && <TabManager onClose={() => setShowTabs(false)} />}
    </>
  )
}
