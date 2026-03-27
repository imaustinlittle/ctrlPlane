import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children:  ReactNode
  label?:    string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message:  string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message:  error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.label ?? 'Component'} crashed:`, error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100%',
        gap:            8,
        padding:        16,
        color:          'var(--text2)',
        fontSize:       12,
        textAlign:      'center',
      }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          {this.props.label ? `${this.props.label} failed` : 'Widget failed to render'}
        </span>
        <span style={{
          maxWidth:   200,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity:    0.7,
        }}>
          {this.state.message}
        </span>
        <button
          onClick={() => this.setState({ hasError: false, message: '' })}
          style={{
            marginTop:    4,
            padding:      '4px 10px',
            background:   'var(--surface2)',
            border:       '1px solid var(--border)',
            borderRadius: 4,
            color:        'var(--text)',
            cursor:       'pointer',
            fontSize:     11,
          }}
        >
          Retry
        </button>
      </div>
    )
  }
}
