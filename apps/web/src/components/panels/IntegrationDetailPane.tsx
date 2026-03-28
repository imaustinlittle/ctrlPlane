import { useState, useEffect } from 'react'
import { INTEGRATION_REGISTRY } from '../../integrations/registry'
import type { IntegrationFieldDef } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Instance {
  id:      string
  name:    string
  adapterKey: string
  enabled: boolean
  credentials: Record<string, unknown>
}

// ── Shared input styles ───────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text)', fontSize: 12,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const focus = (e: React.FocusEvent<HTMLInputElement>) =>
  { e.target.style.borderColor = 'var(--accent)' }
const blur  = (e: React.FocusEvent<HTMLInputElement>) =>
  { e.target.style.borderColor = 'var(--border)' }

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ field, value, onChange }: {
  field:    IntegrationFieldDef
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
        {field.label}
      </label>
      <input
        type={field.type ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        style={inp} onFocus={focus} onBlur={blur}
      />
      {field.hint && (
        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{field.hint}</div>
      )}
    </div>
  )
}

// ── Instance form (add or edit) ───────────────────────────────────────────────
function InstanceForm({ integrationKey, existing, onSave, onCancel }: {
  integrationKey: string
  existing?: Instance
  onSave:   (name: string, fields: Record<string, string>, enabled: boolean) => Promise<void>
  onCancel: () => void
}) {
  const def = INTEGRATION_REGISTRY.get(integrationKey)!
  const [name,    setName]    = useState(existing?.name ?? '')
  const [fields,  setFields]  = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {}
    for (const fd of def.fields) {
      f[fd.key] = String((existing?.credentials?.[fd.key] as string | undefined) ?? '')
    }
    return f
  })
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim(), fields, enabled)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const isNew = !existing

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border-b)',
      borderRadius: 8, padding: '14px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        {isNew ? 'Add instance' : 'Edit instance'}
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
          Name <span style={{ color: 'var(--accent-r)' }}>*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={`e.g. Home ${def.displayName}`}
          style={inp} onFocus={focus} onBlur={blur}
          readOnly={!isNew}
        />
        {isNew && (
          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
            Used as a unique identifier — cannot be changed later
          </div>
        )}
      </div>

      {/* Enabled toggle (edit only) */}
      {!isNew && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Enabled</span>
          <button onClick={() => setEnabled(e => !e)} style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', flexShrink: 0,
            background: enabled ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: enabled ? 20 : 2,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', display: 'block',
            }} />
          </button>
        </div>
      )}

      {/* Integration-specific fields */}
      {def.fields.map(f => (
        <FieldRow
          key={f.key}
          field={f}
          value={fields[f.key] ?? ''}
          onChange={v => setFields(d => ({ ...d, [f.key]: v }))}
        />
      ))}

      {error && (
        <div style={{ fontSize: 12, color: 'var(--accent-r)', marginBottom: 8 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
        >Cancel</button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          style={{
            flex: 2, padding: '7px 0', borderRadius: 6, border: 'none',
            background: name.trim() ? 'var(--accent)' : 'var(--bg4)',
            color: name.trim() ? '#fff' : 'var(--text2)',
            cursor: name.trim() && !saving ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}
        >{saving ? 'Saving…' : isNew ? 'Add instance' : 'Save'}</button>
      </div>
    </div>
  )
}

// ── InstanceRow ───────────────────────────────────────────────────────────────
function InstanceRow({ instance, onEdit, onDelete }: {
  instance: Instance
  onEdit:   () => void
  onDelete: () => void
}) {
  const statusColor = instance.enabled ? 'var(--accent-g)' : 'var(--border)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'var(--bg2)', borderRadius: 8,
      border: '1px solid var(--border)', marginBottom: 6,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {instance.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
          {instance.enabled ? 'Enabled' : 'Disabled'}
        </div>
      </div>
      <button
        onClick={onEdit}
        style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.background = 'none' }}
      >Edit</button>
      <button
        onClick={onDelete}
        style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid rgba(247,129,102,0.25)', background: 'none', color: 'var(--accent-r)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(247,129,102,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >✕</button>
    </div>
  )
}

// ── IntegrationDetailPane ─────────────────────────────────────────────────────
export function IntegrationDetailPane({ integrationKey }: { integrationKey: string }) {
  const def = INTEGRATION_REGISTRY.get(integrationKey)
  const [instances,   setInstances]   = useState<Instance[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/integrations')
      .then(r => r.ok ? r.json() : [])
      .then((all: Instance[]) => {
        setInstances(all.filter(i => i.adapterKey === integrationKey))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [integrationKey])

  const handleSave = async (name: string, fields: Record<string, string>, enabled: boolean) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await fetch(`/api/integrations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adapterKey: integrationKey, enabled, credentials: fields }),
    })
    load()
    setShowAdd(false)
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`Remove this instance?`)) return
    await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
    load()
  }

  if (!def) {
    return (
      <div style={{ padding: 16, color: 'var(--text2)', fontSize: 13 }}>
        Unknown integration type "{integrationKey}"
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>{def.icon}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{def.displayName}</span>
          {def.docsUrl && (
            <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              Docs ↗
            </a>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{def.description}</div>
      </div>

      {/* Instance list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ color: 'var(--text2)', fontSize: 12, padding: '8px 0' }}>Loading…</div>
        ) : (
          <>
            {instances.length === 0 && !showAdd && (
              <div style={{ textAlign: 'center', padding: '20px 0 16px', color: 'var(--text2)' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>🔌</div>
                <div style={{ fontSize: 12 }}>No instances configured yet</div>
              </div>
            )}

            {instances.map(inst => (
              editingId === inst.id
                ? <div key={inst.id} style={{ marginBottom: 8 }}>
                    <InstanceForm
                      integrationKey={integrationKey}
                      existing={inst}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                : <InstanceRow
                    key={inst.id}
                    instance={inst}
                    onEdit={() => { setShowAdd(false); setEditingId(inst.id) }}
                    onDelete={() => handleDelete(inst.id)}
                  />
            ))}

            {showAdd && (
              <InstanceForm
                integrationKey={integrationKey}
                onSave={handleSave}
                onCancel={() => setShowAdd(false)}
              />
            )}

            {!showAdd && !editingId && (
              <button
                onClick={() => setShowAdd(true)}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8,
                  border: '1px dashed var(--border-b)', background: 'none',
                  color: 'var(--text2)', cursor: 'pointer', fontSize: 13,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  marginTop: 4,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(88,166,255,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border-b)'; e.currentTarget.style.background = 'none' }}
              >+ Add instance</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
