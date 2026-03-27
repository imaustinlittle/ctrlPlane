import type { WidgetDefinition, WidgetProps } from '../../types'

function BlankWidget(_props: WidgetProps) {
  return (
    <div className="widget-body" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      opacity: 0.3,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    </div>
  )
}

export const blankWidget: WidgetDefinition = {
  type:        'blank',
  displayName: 'Blank',
  description: 'Empty spacer for layout testing',
  icon:        '⬜',
  category:    'general',
  defaultW:    1,
  defaultH:    1,
  minW:        1,
  minH:        1,
  component:   BlankWidget,
}
