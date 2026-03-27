import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDashboardStore } from '../../store'
import type { DashboardPage } from '../../types'

interface Props {
  onClose: () => void
}

const PAGE_ICONS = ['⬡', '🎬', '📡', '🖥', '🌐', '📊', '🏠', '⚙', '🔒', '📱', '🎮', '📷']

export function TabManager({ onClose }: Props) {
  const pages        = useDashboardStore(s => s.pages)
  const activePageId = useDashboardStore(s => s.activePageId)
  const setActivePage = useDashboardStore(s => s.setActivePage)
  const addPage      = useDashboardStore(s => s.addPage)
  const removePage   = useDashboardStore(s => s.removePage)
  const renamePage   = useDashboardStore(s => s.renamePage)

  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editName, setEditName]     = useState('')
  const [editIcon, setEditIcon]     = useState('')
  const [newName, setNewName]       = useState('')
  const [newIcon, setNewIcon]       = useState('📄')
  const [showAdd, setShowAdd]       = useState(false)
  const [confirmDelete, setConfirm] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const startEdit = (page: DashboardPage) => {
    setEditingId(page.id)
    setEditName(page.name)
    setEditIcon(page.icon ?? '📄')
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    renamePage(editingId, editName.trim(), editIcon)
    setEditingId(null)
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    addPage(newName.trim(), newIcon)
    setNewName('')
    setNewIcon('📄')
    setShowAdd(false)
  }

  const handleDelete = (pageId: string) => {
    if (confirmDelete === pageId) {
      removePage(pageId)
      if (activePageId === pageId) {
        setActivePage(pages.find(p => p.id !== pageId)?.id ?? pages[0].id)
      }
      setConfirm(null)
    } else {
      setConfirm(pageId)
      setTimeout(() => setConfirm(null), 3000)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 400,
      }} />

      <div style={{
        position: 'fixed',
        top: '10vh', left: '50%',
        transform: 'translateX(-50%)',
        width: 480,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '80vh',
        background: 'var(--bg2)',
        border: '1px solid var(--border-b)',
        borderRadius: 16,
        zIndex: 401,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        animation: 'cp-in 0.2s cubic-bezier(0.34,1.2,0.64,1)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Manage tabs</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Create, rename, or delete dashboard pages</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Page list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {pages.map(page => (
            <div key={page.id} style={{
              background: page.id === activePageId ? 'rgba(88,166,255,0.06)' : 'var(--bg3)',
              border: `1px solid ${page.id === activePageId ? 'rgba(88,166,255,0.2)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 8,
            }}>
              {editingId === page.id ? (
                /* Edit mode */
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {/* Icon picker */}
                    <div style={{ position: 'relative' }}>
                      <input
                        value={editIcon}
                        onChange={e => setEditIcon(e.target.value)}
                        style={{ ...inputStyle, width: 52, textAlign: 'center', fontSize: 18 }}
                      />
                    </div>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      autoFocus
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Tab name"
                    />
                  </div>
                  {/* Quick icon picker */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {PAGE_ICONS.map(ic => (
                      <button key={ic} onClick={() => setEditIcon(ic)} style={{
                        width: 30, height: 30,
                        border: `1px solid ${editIcon === ic ? 'var(--accent)' : 'var(--border)'}`,
                        background: editIcon === ic ? 'rgba(88,166,255,0.1)' : 'var(--bg)',
                        borderRadius: 6, cursor: 'pointer', fontSize: 15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{ic}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingId(null)} style={{ ...inputStyle, cursor: 'pointer', flex: 1, textAlign: 'center' }}>Cancel</button>
                    <button onClick={saveEdit} style={{ flex: 2, padding: '7px 0', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Save</button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{page.icon ?? '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{page.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                      {page.widgets.length} widget{page.widgets.length !== 1 ? 's' : ''}
                      {page.id === activePageId && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>● active</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(page)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                      Rename
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={() => handleDelete(page.id)}
                        style={{
                          padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                          border: `1px solid ${confirmDelete === page.id ? 'var(--accent-r)' : 'var(--border)'}`,
                          background: confirmDelete === page.id ? 'rgba(247,129,102,0.1)' : 'none',
                          color: confirmDelete === page.id ? 'var(--accent-r)' : 'var(--text2)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {confirmDelete === page.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new page */}
          {showAdd ? (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={newIcon} onChange={e => setNewIcon(e.target.value)} style={{ ...inputStyle, width: 52, textAlign: 'center', fontSize: 18 }} />
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  autoFocus
                  placeholder="New tab name"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {PAGE_ICONS.map(ic => (
                  <button key={ic} onClick={() => setNewIcon(ic)} style={{
                    width: 30, height: 30,
                    border: `1px solid ${newIcon === ic ? 'var(--accent)' : 'var(--border)'}`,
                    background: newIcon === ic ? 'rgba(88,166,255,0.1)' : 'var(--bg)',
                    borderRadius: 6, cursor: 'pointer', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{ic}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={{ ...inputStyle, cursor: 'pointer', flex: 1, textAlign: 'center' }}>Cancel</button>
                <button onClick={handleAdd} disabled={!newName.trim()} style={{
                  flex: 2, padding: '7px 0', borderRadius: 6, border: 'none',
                  background: newName.trim() ? 'var(--accent)' : 'var(--bg4)',
                  color: newName.trim() ? '#fff' : 'var(--text3)',
                  cursor: newName.trim() ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                }}>
                  Create tab
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                width: '100%', padding: '10px 0',
                borderRadius: 8, border: '1px dashed var(--border-b)',
                background: 'none', color: 'var(--text2)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget).style.color = 'var(--text)'; (e.currentTarget).style.borderColor = 'var(--accent)'; (e.currentTarget).style.background = 'rgba(88,166,255,0.04)' }}
              onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text2)'; (e.currentTarget).style.borderColor = 'var(--border-b)'; (e.currentTarget).style.background = 'none' }}
            >
              + New tab
            </button>
          )}
        </div>

        {/* Footer note about moving widgets */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)', flexShrink: 0 }}>
          💡 To move a widget to another tab, remove it here and add it on the destination tab.
        </div>
      </div>

      <style>{`
        @keyframes cp-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </>,
    document.body
  )
}
