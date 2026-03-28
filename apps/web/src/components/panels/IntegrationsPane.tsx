import { useState, useEffect } from 'react'
import { ALL_INTEGRATIONS, INTEGRATION_REGISTRY } from '../../integrations/registry'
import type { IntegrationDefinition, IntegrationFieldDef } from '../../types'

// ── Shared instance type ──────────────────────────────────────────────────────
interface Instance {
  id:      string   // user-defined slug e.g. "home-proxmox"
  type:    string   // integration key e.g. "proxmox"
  label:   string
  enabled: boolean
  [key: string]: unknown
}

// ── inputStyle ────────────────────────────────────────────────────────────────
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

// ── Field renderer ────────────────────────────────────────────────────────────
function IntegrationField({ field, value, onChange }: {
  field: IntegrationFieldDef
  value: string
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

// ── AddInstanceForm ───────────────────────────────────────────────────────────
function AddInstanceForm({ onAdd, onCancel }: {
  onAdd: (instance: Instance) => void
  onCancel: () => void
}) {
  const [selectedKey, setSelectedKey] = useState<string>(ALL_INTEGRATIONS[0]?.key ?? '')
  const [label,       setLabel]       = useState('')
  const [fields,      setFields]      = useState<Record<string, string>>({})

  const def: IntegrationDefinition | undefined = INTEGRATION_REGISTRY.get(selectedKey)

  const handleAdd = () => {
    if (!label.trim() || !def) return
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    onAdd({ id, type: selectedKey, label: label.trim(), enabled: true, ...fields })
  }

  if (ALL_INTEGRATIONS.length === 0) {
    return (
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border-b)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 12,
        color: 'var(--text2)', fontSize: 12, textAlign: 'center',
      }}>
        No integrations available. Add a widget with an integration file to get started.
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border-b)',
      borderRadius: 10, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
        New integration
      </div>

      {/* Type picker — populated from discovered integration.ts files */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_INTEGRATIONS.map(i => (
            <button
              key={i.key}
              onClick={() => { setSelectedKey(i.key); setFields({}) }}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12,
                border: `1px solid ${selectedKey === i.key ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedKey === i.key ? 'rgba(88,166,255,0.1)' : 'var(--bg3)',
                color: selectedKey === i.key ? 'var(--accent)' : 'var(--text2)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span>{i.icon}</span>{i.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
          Name <span style={{ color: 'var(--accent-r)' }}>*</span>
        </label>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={`e.g. Home ${def?.displayName ?? ''}`}
          style={inp} onFocus={focus} onBlur={blur}
        />
        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>
          Used to identify this instance in widget settings
        </div>
      </div>

      {/* Fields driven by the discovered integration definition */}
      {def?.fields.map(f => (
        <IntegrationField
          key={f.key}
          field={f}
          value={fields[f.key] ?? ''}
          onChange={v => setFields(d => ({ ...d, [f.key]: v }))}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
        >Cancel</button>
        <button
          onClick={handleAdd}
          disabled={!label.trim()}
          style={{
            flex: 2, padding: '7px 0', borderRadius: 6, border: 'none',
            background: label.trim() ? 'var(--accent)' : 'var(--bg4)',
            color: label.trim() ? '#fff' : 'var(--text2)',
            cursor: label.trim() ? 'pointer' : 'default',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          }}
        >Add integration</button>
      </div>
    </div>
  )
}

// ── InstanceCard ──────────────────────────────────────────────────────────────
function InstanceCard({ instance, onUpdate, onDelete }: {
  instance: Instance
  onUpdate: (updated: Instance) => void
  onDelete: () => void
}) {
  const def      = INTEGRATION_REGISTRY.get(instance.type)
  const [expanded, setExpanded] = useState(false)
  const [fields,   setFields]   = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {}
    for (const fd of def?.fields ?? []) {
      f[fd.key] = String(instance[fd.key] ?? '')
    }
    return f
  })
  const [enabled, setEnabled]   = useState(instance.enabled)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [status,  setStatus]    = useState<'idle' | 'ok' | 'error'>('idle')

  const handleSave = async () => {
    setSaving(true)
    const updated = { ...instance, enabled, ...fields }
    try {
      const res = await fetch(`/api/integrations/${instance.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (res.ok) {
        onUpdate(updated)
        setSaved(true)
        setStatus('ok')
        setTimeout(() => setSaved(false), 2000)
      } else { setStatus('error') }
    } catch { setStatus('error') }
    finally  { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`Remove "${instance.label}"?`)) return
    await fetch(`/api/integrations/${instance.id}`, { method: 'DELETE' })
    onDelete()
  }

  const statusColor =
    status === 'ok'    ? 'var(--accent-g)' :
    status === 'error' ? 'var(--accent-r)' : 'var(--border-b)'

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 8, overflow: 'hidden', marginBottom: 8,
    }}>
      {/* Row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 16 }}>{def?.icon ?? '🔌'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {instance.label}
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: enabled ? statusColor : 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {def?.displayName ?? instance.type} · <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{instance.id}</code>
          </div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2.5"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 12px' }}>
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

          {def?.fields.map(f => (
            <IntegrationField
              key={f.key}
              field={f}
              value={fields[f.key] ?? ''}
              onChange={v => setFields(d => ({ ...d, [f.key]: v }))}
            />
          ))}

          {!def && (
            <div style={{ fontSize: 12, color: 'var(--accent-y)', marginBottom: 8 }}>
              ⚠️ Unknown integration type "{instance.type}" — no matching widget integration file found.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleDelete} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(247,129,102,0.3)',
              background: 'rgba(247,129,102,0.08)', color: 'var(--accent-r)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
            }}>Remove</button>
            {def?.docsUrl && (
              <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                Docs ↗
              </a>
            )}
            <button onClick={handleSave} disabled={saving} style={{
              marginLeft: 'auto', padding: '6px 16px', borderRadius: 6, border: 'none',
              background: saved ? 'var(--accent-g)' : 'var(--accent)',
              color: '#fff', cursor: saving ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
            }}>
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── IntegrationsPane ──────────────────────────────────────────────────────────
export function IntegrationsPane() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [showAdd,   setShowAdd]   = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, Record<string, unknown>>) => {
        const list: Instance[] = Object.entries(data).map(([id, cfg]) => ({
          id,
          type:    String(cfg.type ?? ''),
          label:   String(cfg.label ?? id),
          enabled: cfg.enabled === true,
          ...cfg,
        } as Instance))
        setInstances(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (instance: Instance) => {
    await fetch(`/api/integrations/${instance.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instance),
    })
    setInstances(prev => [...prev.filter(i => i.id !== instance.id), instance])
    setShowAdd(false)
  }

  return (
    <div style={{ padding: '16px' }}>
      {loading ? (
        <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading…</div>
      ) : (
        <>
          {instances.length === 0 && !showAdd && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔌</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>No integrations yet</div>
              <div style={{ fontSize: 12 }}>Add a connection to start showing real data in your widgets</div>
            </div>
          )}

          {instances.map(inst => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onUpdate={updated => setInstances(prev => prev.map(i => i.id === inst.id ? updated : i))}
              onDelete={() => setInstances(prev => prev.filter(i => i.id !== inst.id))}
            />
          ))}

          {showAdd ? (
            <AddInstanceForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: '1px dashed var(--border-b)', background: 'none',
                color: 'var(--text2)', cursor: 'pointer', fontSize: 13,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(88,166,255,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border-b)'; e.currentTarget.style.background = 'none' }}
            >
              + Add integration
            </button>
          )}

          <div style={{ marginTop: 20, padding: '10px 12px', background: 'rgba(88,166,255,0.05)', border: '1px solid rgba(88,166,255,0.12)', borderRadius: 7, fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
            💡 Credentials stored encrypted on your server. Drop an <code style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>integration.ts</code> file next to any widget to add a new integration type.
          </div>
        </>
      )}
    </div>
  )
}
