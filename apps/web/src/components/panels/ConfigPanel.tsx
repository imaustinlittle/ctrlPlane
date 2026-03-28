import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { WidgetInstance, WidgetDefinition } from '../../types'
import { WIDGET_SCHEMAS, type ConfigField } from './configSchema'
import { useDashboardStore, useActivePage } from '../../store'

interface Props {
  instance:   WidgetInstance
  definition: WidgetDefinition
  onClose:    () => void
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--accent)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = 'var(--border)'
}

// ── Field label ───────────────────────────────────────────────────────────────

function FieldLabel({ field }: { field: ConfigField }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
        {field.label}
        {field.required && <span style={{ color: 'var(--accent-r)', marginLeft: 3 }}>*</span>}
      </label>
      {field.description && (
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{field.description}</div>
      )}
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 20 }}>{children}</div>
}

// ── Field renderers ───────────────────────────────────────────────────────────

function TextField({ field, value, onChange }: { field: ConfigField; value: string; onChange: (v: string) => void }) {
  return (
    <Wrap>
      <FieldLabel field={field} />
      <input
        type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
        value={value}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </Wrap>
  )
}

function NumberField({ field, value, onChange }: { field: ConfigField; value: number; onChange: (v: number) => void }) {
  return (
    <Wrap>
      <FieldLabel field={field} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <input
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }}
        />
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text)',
          minWidth: 40,
          textAlign: 'right',
        }}>
          {value}
        </div>
      </div>
    </Wrap>
  )
}

function ToggleField({ field, value, onChange }: { field: ConfigField; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Wrap>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <FieldLabel field={field} />
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            background: value ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3, left: value ? 23 : 3,
            width: 18, height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            display: 'block',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>
    </Wrap>
  )
}

function SelectField({ field, value, onChange }: { field: ConfigField; value: string; onChange: (v: string) => void }) {
  return (
    <Wrap>
      <FieldLabel field={field} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, cursor: 'pointer' }}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {field.options?.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: 'var(--bg2)' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </Wrap>
  )
}

interface UrlItem { name: string; url: string; emoji: string }

function UrlListField({ field, value, onChange }: { field: ConfigField; value: UrlItem[]; onChange: (v: UrlItem[]) => void }) {
  const add    = () => onChange([...value, { name: '', url: '', emoji: '🔗' }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const update = (i: number, key: keyof UrlItem, val: string) =>
    onChange(value.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

  return (
    <Wrap>
      <FieldLabel field={field} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {value.map((item, i) => (
          <div key={i} style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Icon */}
              <input
                value={item.emoji}
                onChange={e => update(i, 'emoji', e.target.value)}
                placeholder="🔗 or URL"
                maxLength={100}
                style={{ ...inputStyle, width: 80, textAlign: 'center', padding: '7px 4px', fontSize: 18, flexShrink: 0 }}
              />
              {/* Name */}
              <input
                value={item.name}
                onChange={e => update(i, 'name', e.target.value)}
                placeholder="Name"
                maxLength={40}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => remove(i)}
                style={{
                  width: 34, height: 34,
                  borderRadius: 6,
                  border: '1px solid rgba(247,129,102,0.3)',
                  background: 'rgba(247,129,102,0.08)',
                  color: 'var(--accent-r)',
                  cursor: 'pointer',
                  fontSize: 13,
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.18)' }}
                onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.08)' }}
              >
                ✕
              </button>
            </div>
            <input
              value={item.url}
              onChange={e => update(i, 'url', e.target.value)}
              placeholder="https://your-service:port"
              style={{ ...inputStyle, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', direction: 'ltr' }}
            />
          </div>
        ))}
        <button
          onClick={add}
          style={{
            padding: '9px 16px',
            borderRadius: 7,
            border: '1px dashed var(--border-b)',
            background: 'none',
            color: 'var(--text2)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.color = 'var(--text)'; (e.currentTarget).style.borderColor = 'var(--accent)'; (e.currentTarget).style.background = 'rgba(88,166,255,0.05)' }}
          onMouseLeave={e => { (e.currentTarget).style.color = 'var(--text2)'; (e.currentTarget).style.borderColor = 'var(--border-b)'; (e.currentTarget).style.background = 'none' }}
        >
          + Add item
        </button>
      </div>
    </Wrap>
  )
}

// ── Tag list field ────────────────────────────────────────────────────────────

function TagListField({ field, value, onChange }: { field: ConfigField; value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const tag = input.trim().toLowerCase()
    if (!tag || value.includes(tag)) { setInput(''); return }
    onChange([...value, tag])
    setInput('')
  }

  const remove = (tag: string) => onChange(value.filter(t => t !== tag))

  return (
    <Wrap>
      <FieldLabel field={field} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map(tag => (
          <span
            key={tag}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px',
              background: 'rgba(88,166,255,0.12)',
              border: '1px solid rgba(88,166,255,0.3)',
              borderRadius: 20,
              fontSize: 12, color: 'var(--accent)',
            }}
          >
            {tag}
            <button
              onClick={() => remove(tag)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, fontSize: 11, lineHeight: 1 }}
            >✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={field.placeholder ?? 'Type and press Enter'}
          style={{ ...inputStyle, flex: 1 }}
          onFocus={onFocus} onBlur={onBlur}
        />
        <button
          onClick={add}
          style={{
            padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)',
            background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer',
            fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
        >Add</button>
      </div>
    </Wrap>
  )
}

// ── Field router ──────────────────────────────────────────────────────────────

function Field({ field, value, onChange }: { field: ConfigField; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.type) {
    case 'text':
    case 'url':
    case 'password':
      return <TextField field={field} value={String(value ?? field.defaultValue ?? '')} onChange={onChange} />
    case 'number':
      return <NumberField field={field} value={Number(value ?? field.defaultValue ?? 0)} onChange={v => onChange(v)} />
    case 'toggle':
      return <ToggleField field={field} value={Boolean(value ?? field.defaultValue ?? false)} onChange={v => onChange(v)} />
    case 'select':
      return <SelectField field={field} value={String(value ?? field.defaultValue ?? '')} onChange={onChange} />
    case 'url-list':
      return <UrlListField field={field} value={(value as UrlItem[]) ?? []} onChange={onChange} />
    case 'tag-list':
      return <TagListField field={field} value={(value as string[]) ?? []} onChange={onChange} />
    default:
      return null
  }
}

// ── Main ConfigPanel ──────────────────────────────────────────────────────────

export function ConfigPanel({ instance, definition, onClose }: Props) {
  const page = useActivePage()
  const updateWidgetConfig = useDashboardStore(s => s.updateWidgetConfig)
  const schema = WIDGET_SCHEMAS[instance.type]

  const [draft, setDraft] = useState<Record<string, unknown>>({ ...instance.config })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const setField = useCallback((key: string, value: unknown) => {
    setDraft(d => ({ ...d, [key]: value }))
    setSaved(false)
  }, [])

  const handleSave = () => {
    updateWidgetConfig(page.id, instance.id, draft)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  const title = (instance.config?.label as string) || definition.displayName

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 400,
          animation: 'cp-fade 0.15s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '10vh', left: '50%',
        transform: 'translateX(-50%)',
        width: 560,
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: '85vh',
        background: 'var(--bg2)',
        border: '1px solid var(--border-b)',
        borderRadius: 16,
        zIndex: 401,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        animation: 'cp-in 0.22s cubic-bezier(0.34,1.2,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{
            width: 44, height: 44,
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}>
            {definition.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
              {definition.description}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'none',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'var(--surface-h)'; (e.currentTarget).style.color = 'var(--text)' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'var(--text2)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!schema || schema.fields.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 10, padding: '40px 0',
              color: 'var(--text2)', fontSize: 13, textAlign: 'center',
            }}>
              <span style={{ fontSize: 28 }}>⚙</span>
              This widget has no configurable settings.
            </div>
          ) : (
            schema.fields.map(field => (
              <Field
                key={field.key}
                field={field}
                value={draft[field.key]}
                onChange={v => setField(field.key, v)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          flexShrink: 0,
          background: 'var(--bg2)',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'none',
              color: 'var(--text2)',
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'var(--surface-h)'; (e.currentTarget).style.color = 'var(--text)' }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'var(--text2)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: saved ? 'var(--accent-g)' : 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              letterSpacing: '-0.2px',
            }}
          >
            {saved ? '✓ Saved!' : 'Save changes'}
          </button>
        </div>
      </div>


    </>,
    document.body
  )
}
