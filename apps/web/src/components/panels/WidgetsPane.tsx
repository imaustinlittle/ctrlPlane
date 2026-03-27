import { useState } from 'react'
import { ALL_WIDGETS } from '../../widgets/registry'
import { useDashboardStore, useActivePage } from '../../store'
import type { WidgetInstance, WidgetLayout } from '../../types'


const CATEGORIES = ['general', 'system', 'monitoring', 'media', 'other']

function categoryLabel(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

export function WidgetsPane() {
  const page      = useActivePage()
  const addWidget = useDashboardStore(s => s.addWidget)
  const [filter,  setFilter]  = useState<string>('all')
  const [search,  setSearch]  = useState('')
  const [added,   setAdded]   = useState<string | null>(null)

  const visible = ALL_WIDGETS.filter(w => {
    const matchCat  = filter === 'all' || (w.category ?? 'other') === filter
    const matchText = !search || w.displayName.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchText
  })

  const usedCategories = ['all', ...CATEGORIES.filter(c =>
    ALL_WIDGETS.some(w => (w.category ?? 'other') === c)
  )]

  const handleAdd = (type: string) => {
    const def = ALL_WIDGETS.find(w => w.type === type)
    if (!def) return

    const id = `${type}-${Date.now()}`
    const instance: WidgetInstance = { id, type, config: {} }

    // Find a free spot — place below existing content
    const maxY = page.layout.reduce((m, l) => Math.max(m, l.y + l.h), 0)
    const layout: WidgetLayout = {
      i: id, x: 0, y: maxY,
      w: def.defaultW ?? 4, h: def.defaultH ?? 4,
      minW: def.minW ?? 1, minH: def.minH ?? 1,
    }

    addWidget(page.id, instance, layout)
    setAdded(type)
    setTimeout(() => setAdded(null), 1500)
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search widgets…"
        style={{
          width: '100%', padding: '8px 12px', boxSizing: 'border-box',
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 7, color: 'var(--text)', fontSize: 13,
          fontFamily: 'inherit', outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
        onBlur={e =>  { e.target.style.borderColor = 'var(--border)' }}
      />

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {usedCategories.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit',
              border: `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === c ? 'rgba(88,166,255,0.1)' : 'var(--bg3)',
              color: filter === c ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer',
            }}
          >
            {c === 'all' ? 'All' : categoryLabel(c)}
          </button>
        ))}
      </div>

      {/* Widget grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map(w => (
          <div
            key={w.type}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--bg2)', border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{w.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{w.displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.description}
              </div>
            </div>
            <button
              onClick={() => handleAdd(w.type)}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit',
                border: 'none', fontWeight: 600, flexShrink: 0, cursor: 'pointer',
                background: added === w.type ? 'var(--accent-g)' : 'var(--accent)',
                color: '#fff', transition: 'all 0.2s',
              }}
            >
              {added === w.type ? '✓' : '+ Add'}
            </button>
          </div>
        ))}

        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text2)', fontSize: 13 }}>
            No widgets match "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
