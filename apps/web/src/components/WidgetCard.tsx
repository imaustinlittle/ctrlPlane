import { useState } from 'react'
import type { WidgetDefinition, WidgetInstance } from '../types'
import { ConfigPanel }   from './panels/ConfigPanel'
import { ErrorBoundary } from './ErrorBoundary'

interface Props {
  definition:  WidgetDefinition
  instance:    WidgetInstance
  isEditing?:  boolean
  onRemove?:   () => void
}

export function WidgetCard({ definition, instance, isEditing, onRemove }: Props) {
  const { component: Component, displayName, icon } = definition
  const title = (instance.config?.label as string) || displayName
  const [showConfig, setShowConfig] = useState(false)

  return (
    <>
      <div className="widget-card">

        {/* Header — drag handle only, no interactive buttons inside */}
        <div className="widget-header">
          <div className="widget-title">
            <span style={{ fontSize: 12 }}>{icon}</span>
            {title}
          </div>

          {/* Remove button inside header — edit mode only, stopPropagation so drag doesn't fire */}
          {isEditing && onRemove && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              title="Remove widget"
              style={{
                width: 20, height: 20,
                borderRadius: 4,
                border: '1px solid rgba(247,129,102,0.3)',
                background: 'rgba(247,129,102,0.1)',
                color: 'var(--accent-r)',
                fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.22)' }}
              onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(247,129,102,0.1)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Widget content — wrapped in per-widget error boundary */}
        <ErrorBoundary label={displayName}>
          <Component
            widgetId={instance.id}
            config={instance.config}
            data={null}
            isLoading={false}
            error={null}
            lastUpdated={null}
          />
        </ErrorBoundary>

        {/* ··· config button — floats over bottom-right of card, outside drag handle
            Only shown in edit mode. onPointerDown stops drag from starting. */}
        {isEditing && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowConfig(true) }}
            title="Configure widget"
            style={{
              position: 'absolute',
              bottom: 8, right: 8,
              width: 24, height: 24,
              borderRadius: 5,
              border: '1px solid var(--border-b)',
              background: 'var(--bg3)',
              color: 'var(--text2)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.15s',
              zIndex: 10,
              lineHeight: 1,
            }}
            onMouseEnter={e => {
              (e.currentTarget).style.background = 'var(--bg2)'
              ;(e.currentTarget).style.color = 'var(--text)'
              ;(e.currentTarget).style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={e => {
              (e.currentTarget).style.background = 'var(--bg3)'
              ;(e.currentTarget).style.color = 'var(--text2)'
              ;(e.currentTarget).style.borderColor = 'var(--border-b)'
            }}
          >
            ···
          </button>
        )}
      </div>

      {showConfig && (
        <ConfigPanel
          instance={instance}
          definition={definition}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  )
}
