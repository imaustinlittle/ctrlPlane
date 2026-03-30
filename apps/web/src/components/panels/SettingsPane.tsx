import { useEffect, useState } from 'react'
import { useDashboardStore } from '../../store'
import { BUILT_IN_THEMES } from '../../types'
import type { ThemeConfig } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSurfaceOpacity(surface: string): number {
  const m = surface.match(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/)
  return m ? Math.round(parseFloat(m[1]) * 100) : 4
}

function surfaceFromOpacity(pct: number): string {
  return `rgba(255,255,255,${(pct / 100).toFixed(2)})`
}

// ── ColorRow ──────────────────────────────────────────────────────────────────

function ColorRow({
  label,
  value,
  onChange,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
}) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])

  const handleText = (v: string) => {
    setText(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
  }

  // native color picker only works with #rrggbb
  const pickerVal = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', width: 80, flexShrink: 0 }}>{label}</span>
      <input
        type="color"
        value={pickerVal}
        onChange={e => { setText(e.target.value); onChange(e.target.value) }}
        style={{
          width: 32, height: 28, padding: 2, flexShrink: 0,
          border: '1px solid var(--border)', borderRadius: 5,
          background: 'var(--bg3)', cursor: 'pointer',
        }}
      />
      <input
        type="text"
        value={text}
        onChange={e => handleText(e.target.value)}
        onBlur={() => setText(value)}
        maxLength={7}
        placeholder="#rrggbb"
        style={{
          flex: 1, padding: '5px 8px', fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 5, color: 'var(--text)', outline: 'none',
        }}
      />
    </div>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
      textTransform: 'uppercase', color: 'var(--text2)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

// ── SettingsPane ──────────────────────────────────────────────────────────────

export function SettingsPane() {
  const theme    = useDashboardStore(s => s.theme)
  const setTheme = useDashboardStore(s => s.setTheme)

  const [bgImageText, setBgImageText] = useState(theme.backgroundImage ?? '')
  useEffect(() => { setBgImageText(theme.backgroundImage ?? '') }, [theme.backgroundImage])

  const patch = (partial: Partial<ThemeConfig>) => setTheme({ ...theme, id: 'custom', name: 'Custom', ...partial })

  const surfaceOpacity = parseSurfaceOpacity(theme.surface ?? 'rgba(255,255,255,0.04)')

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Presets ── */}
      <div>
        <SectionLabel>Presets</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {BUILT_IN_THEMES.map(t => {
            const active = t.id === theme.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 7,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'rgba(88,166,255,0.08)' : 'var(--bg2)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  background: t.accent,
                  boxShadow: active ? `0 0 8px ${t.accent}80` : 'none',
                }} />
                <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text2)', fontWeight: active ? 500 : 400 }}>
                  {t.name}
                </span>
                {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Colors ── */}
      <div>
        <SectionLabel>Colors</SectionLabel>
        <ColorRow
          label="Accent"
          value={theme.accent}
          onChange={v => patch({ accent: v })}
        />
        <ColorRow
          label="Background"
          value={theme.bg ?? '#0d1117'}
          onChange={v => patch({ bg: v })}
        />
        {/* Widget surface opacity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', width: 80, flexShrink: 0 }}>Widgets</span>
          <input
            type="range"
            min={0} max={20} step={1}
            value={surfaceOpacity}
            onChange={e => patch({ surface: surfaceFromOpacity(Number(e.target.value)) })}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)', width: 32, textAlign: 'right' }}>
            {surfaceOpacity}%
          </span>
        </div>
      </div>

      {/* ── Background image ── */}
      <div>
        <SectionLabel>Background image</SectionLabel>
        <input
          type="url"
          value={bgImageText}
          onChange={e => setBgImageText(e.target.value)}
          onBlur={() => patch({ backgroundImage: bgImageText.trim() || undefined })}
          onKeyDown={e => { if (e.key === 'Enter') patch({ backgroundImage: bgImageText.trim() || undefined }) }}
          placeholder="https://example.com/wallpaper.jpg"
          style={{
            width: '100%', padding: '7px 10px', fontSize: 12,
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 7, color: 'var(--text)', outline: 'none',
            fontFamily: 'inherit', marginBottom: 8,
          }}
        />
        {theme.backgroundImage && (
          <button
            onClick={() => { setBgImageText(''); patch({ backgroundImage: undefined }) }}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Clear image
          </button>
        )}
      </div>

      {/* ── Danger zone ── */}
      <div>
        <SectionLabel>Danger zone</SectionLabel>
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
