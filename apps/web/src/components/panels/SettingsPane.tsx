import { useDashboardStore } from '../../store'
import { BUILT_IN_THEMES } from '../../types'

export function SettingsPane() {
  const theme    = useDashboardStore(s => s.theme)
  const setTheme = useDashboardStore(s => s.setTheme)

  return (
    <div style={{ padding: 16 }}>
      {/* Theme */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
          Theme
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {BUILT_IN_THEMES.map(t => {
            const active = t.id === theme.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 7,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'rgba(88,166,255,0.08)' : 'var(--bg2)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: t.accent, flexShrink: 0, boxShadow: active ? `0 0 8px ${t.accent}80` : 'none' }} />
                <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 500 : 400 }}>
                  {t.name}
                </span>
                {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Danger zone */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
          Danger zone
        </div>
        <button
          onClick={async () => {
            if (!confirm('Reset all dashboard state to defaults? This cannot be undone.')) return
            await fetch('/api/state', { method: 'DELETE' })
            window.location.reload()
          }}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 7,
            border: '1px solid rgba(247,129,102,0.3)',
            background: 'rgba(247,129,102,0.06)',
            color: 'var(--accent-r)', cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit',
          }}
        >
          Reset dashboard to defaults
        </button>
      </div>
    </div>
  )
}
