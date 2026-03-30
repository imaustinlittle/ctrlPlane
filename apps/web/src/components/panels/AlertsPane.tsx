import { useState, useEffect } from 'react'
import type { AlertRule } from '../../widgets/shared/useAlertData'
import { refreshAlerts } from '../../widgets/shared/useAlertData'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id:   string
  name: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SYSTEM_FIELDS = [
  { value: 'cpu.usage',       label: 'CPU usage (%)'        },
  { value: 'memory.percent',  label: 'Memory usage (%)'     },
  { value: 'tempC',           label: 'CPU temperature (°C)' },
  { value: 'memory.usedGb',   label: 'Memory used (GB)'     },
]

const OPERATORS = [
  { value: '>',  label: '>'  },
  { value: '>=', label: '≥'  },
  { value: '<',  label: '<'  },
  { value: '<=', label: '≤'  },
  { value: '==', label: '='  },
  { value: '!=', label: '≠'  },
]

const SEV_COLOR: Record<string, string> = {
  critical: 'var(--accent-r)',
  warning:  'var(--accent-y)',
  info:     'var(--accent)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 12,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text2)', marginBottom: 4, display: 'block',
}

const btnStyle = (variant: 'primary' | 'ghost'): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  border: variant === 'primary' ? 'none' : '1px solid var(--border)',
  background: variant === 'primary' ? 'var(--accent)' : 'none',
  color: variant === 'primary' ? '#000' : 'var(--text2)',
  fontWeight: variant === 'primary' ? 600 : 400,
})

// ── Rule row ──────────────────────────────────────────────────────────────────

function RuleRow({ rule, onToggle, onDelete }: {
  rule: AlertRule
  onToggle: () => void
  onDelete: () => void
}) {
  const color = SEV_COLOR[rule.severity]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0', borderBottom: '1px solid var(--border)',
      opacity: rule.enabled ? 1 : 0.5,
    }}>
      <div style={{ width: 3, borderRadius: 2, background: color, alignSelf: 'stretch', minHeight: 18, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{rule.name}</div>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)' }}>
          {rule.conditionExpr}
          <span style={{ marginLeft: 8, color, padding: '1px 4px', borderRadius: 3, background: `${color}22`, border: `1px solid ${color}33` }}>
            {rule.severity}
          </span>
          <span style={{ marginLeft: 6, color: 'var(--text2)', opacity: 0.6 }}>
            cooldown {rule.cooldownSec}s
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
        {/* Toggle */}
        <button
          onClick={onToggle}
          title={rule.enabled ? 'Disable' : 'Enable'}
          style={{
            width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative',
            background: rule.enabled ? 'var(--accent)' : 'var(--surface2)', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            left: rule.enabled ? 16 : 2,
          }} />
        </button>
        {/* Delete */}
        <button
          onClick={onDelete}
          title="Delete rule"
          style={{ padding: '3px 6px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-r)'; e.currentTarget.style.borderColor = 'var(--accent-r)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >✕</button>
      </div>
    </div>
  )
}

// ── Create rule form ──────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name:          '',
  source:        'system' as 'system' | 'integration',
  integrationId: '',
  fieldPreset:   'cpu.usage',
  fieldCustom:   '',
  operator:      '>',
  threshold:     '',
  severity:      'warning' as 'critical' | 'warning' | 'info',
  cooldownSec:   300,
}

function CreateRuleForm({ integrations, onCreated, onCancel }: {
  integrations: Integration[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [form,    setForm]    = useState(DEFAULT_FORM)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const field = form.source === 'system' ? form.fieldPreset : form.fieldCustom
  const conditionExpr = `${field} ${form.operator} ${form.threshold}`

  const valid = form.name.trim() !== '' &&
    field.trim() !== '' &&
    form.threshold !== '' &&
    !isNaN(Number(form.threshold))

  const handleSubmit = async () => {
    if (!valid) return
    setSaving(true); setError(null)
    try {
      const body: Record<string, unknown> = {
        name:          form.name.trim(),
        conditionExpr: conditionExpr.trim(),
        severity:      form.severity,
        cooldownSec:   form.cooldownSec,
      }
      if (form.source === 'integration' && form.integrationId) {
        body.integrationId = form.integrationId
      }
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof typeof DEFAULT_FORM, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 14, border: '1px solid var(--border)', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>New Alert Rule</div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Rule name</label>
        <input style={inputStyle} placeholder="e.g. High CPU" value={form.name}
          onChange={e => set('name', e.target.value)} />
      </div>

      {/* Source */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Data source</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['system', 'integration'] as const).map(src => (
            <button key={src} onClick={() => set('source', src)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: `1px solid ${form.source === src ? 'var(--accent)' : 'var(--border)'}`,
              background: form.source === src ? 'rgba(88,166,255,0.1)' : 'none',
              color: form.source === src ? 'var(--accent)' : 'var(--text2)',
            }}>
              {src === 'system' ? 'System metrics' : 'Integration'}
            </button>
          ))}
        </div>
      </div>

      {/* Field */}
      {form.source === 'system' ? (
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Metric</label>
          <select style={inputStyle} value={form.fieldPreset} onChange={e => set('fieldPreset', e.target.value)}>
            {SYSTEM_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      ) : (
        <>
          {integrations.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Integration</label>
              <select style={inputStyle} value={form.integrationId} onChange={e => set('integrationId', e.target.value)}>
                <option value="">Any</option>
                {integrations.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Field path</label>
            <input style={inputStyle} placeholder="e.g. cpu.usage or diskPercent"
              value={form.fieldCustom} onChange={e => set('fieldCustom', e.target.value)} />
          </div>
        </>
      )}

      {/* Operator + threshold */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: '0 0 80px' }}>
          <label style={labelStyle}>Operator</label>
          <select style={inputStyle} value={form.operator} onChange={e => set('operator', e.target.value)}>
            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Threshold</label>
          <input style={inputStyle} type="number" placeholder="e.g. 90"
            value={form.threshold} onChange={e => set('threshold', e.target.value)} />
        </div>
      </div>

      {/* Severity */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Severity</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['info', 'warning', 'critical'] as const).map(s => (
            <button key={s} onClick={() => set('severity', s)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize',
              border: `1px solid ${form.severity === s ? SEV_COLOR[s] : 'var(--border)'}`,
              background: form.severity === s ? `${SEV_COLOR[s]}22` : 'none',
              color: form.severity === s ? SEV_COLOR[s] : 'var(--text2)',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Cooldown */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Cooldown (seconds) — minimum time between re-fires</label>
        <input style={inputStyle} type="number" min={60} max={86400} step={60}
          value={form.cooldownSec} onChange={e => set('cooldownSec', parseInt(e.target.value) || 300)} />
      </div>

      {/* Preview */}
      {valid && (
        <div style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text2)' }}>
          Fire when: <span style={{ color: 'var(--accent)' }}>{conditionExpr.trim()}</span>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--accent-r)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={btnStyle('ghost')} onClick={onCancel}>Cancel</button>
        <button style={{ ...btnStyle('primary'), opacity: valid && !saving ? 1 : 0.5 }}
          disabled={!valid || saving} onClick={handleSubmit}>
          {saving ? 'Creating…' : 'Create rule'}
        </button>
      </div>
    </div>
  )
}

// ── AlertsPane ────────────────────────────────────────────────────────────────

export function AlertsPane() {
  const [rules,        setRules]        = useState<AlertRule[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading,      setLoading]      = useState(true)
  const [creating,     setCreating]     = useState(false)

  const loadRules = async () => {
    try {
      const res = await fetch('/api/alerts/rules')
      if (!res.ok) return
      const j = await res.json() as { rules: AlertRule[] }
      setRules(j.rules)
    } finally {
      setLoading(false)
    }
  }

  const loadIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations')
      if (!res.ok) return
      const j = await res.json() as { integrations: Integration[] }
      setIntegrations(j.integrations)
    } catch { /* integrations unavailable */ }
  }

  useEffect(() => { loadRules(); loadIntegrations() }, [])

  const handleToggle = async (rule: AlertRule) => {
    await fetch(`/api/alerts/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    loadRules()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/alerts/rules/${id}`, { method: 'DELETE' })
    loadRules()
  }

  const handleCreated = () => {
    setCreating(false)
    loadRules()
    refreshAlerts()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          {rules.length} rule{rules.length !== 1 ? 's' : ''}
        </span>
        {!creating && (
          <button style={btnStyle('primary')} onClick={() => setCreating(true)}>+ New rule</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {/* Create form */}
        {creating && (
          <CreateRuleForm
            integrations={integrations}
            onCreated={handleCreated}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Rules list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 56, borderRadius: 6, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : rules.length === 0 && !creating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text2)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>No alert rules</span>
            <span style={{ opacity: 0.7 }}>Create a rule to get notified when a metric crosses a threshold.</span>
          </div>
        ) : (
          rules.map(rule => (
            <RuleRow key={rule.id} rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
