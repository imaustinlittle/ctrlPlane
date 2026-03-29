// Shared UI building blocks used by all service widgets.

/** Pulsing placeholder rows shown during initial load. */
export function WidgetSkeleton({ rows = 3, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div className="widget-body" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: 8,
            background: 'var(--surface2)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  )
}

/** Error state with an optional Retry button. */
export function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="widget-body" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center',
    }}>
      <span style={{ fontSize: 20 }}>⚠️</span>
      <span style={{ fontSize: 12, color: 'var(--accent-r)', fontWeight: 500, maxWidth: 200 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 14px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.3)',
            color: 'var(--accent)', fontFamily: 'inherit', marginTop: 2,
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

/** Prompt shown when required config (URL / key) hasn't been set yet. */
export function WidgetUnconfigured({ message }: { message: string }) {
  return (
    <div className="widget-body" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px',
    }}>
      <span style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
        {message}
      </span>
    </div>
  )
}

/** A single stat tile used inside widget stat grids. */
export function StatCard({
  label, value, color, fontSize = 22,
}: {
  label:     string
  value:     string | number
  color?:    string
  fontSize?: number
}) {
  return (
    <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize, fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}
