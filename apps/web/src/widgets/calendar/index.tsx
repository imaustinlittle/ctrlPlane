import type { WidgetDefinition, WidgetProps } from '../../types'
import { usePollData }                         from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured } from '../shared/WidgetStatus'

interface CalendarConfig {
  feedUrl?:  string
  days?:     number   // look-ahead window, default 30
  label?:    string   // friendly name e.g. "Work" or "Family"
}

interface CalEvent {
  uid:      string
  summary:  string
  start:    string
  end:      string
  allDay:   boolean
  location: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  const today    = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const day      = new Date(d);    day.setHours(0,0,0,0)

  const dateStr =
    day.getTime() === today.getTime()    ? 'Today'    :
    day.getTime() === tomorrow.getTime() ? 'Tomorrow' :
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  if (allDay) return dateStr
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} · ${timeStr}`
}

function groupByDay(events: CalEvent[]): Array<{ label: string; events: CalEvent[] }> {
  const groups = new Map<string, { label: string; events: CalEvent[] }>()
  for (const e of events) {
    const d     = new Date(e.start)
    const key   = d.toDateString()
    const today    = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const day      = new Date(d); day.setHours(0,0,0,0)
    const label =
      day.getTime() === today.getTime()    ? 'Today'    :
      day.getTime() === tomorrow.getTime() ? 'Tomorrow' :
      d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

    if (!groups.has(key)) groups.set(key, { label, events: [] })
    groups.get(key)!.events.push(e)
  }
  return [...groups.values()]
}

const DOT_COLORS = [
  'var(--accent)',
  'var(--accent-g)',
  'var(--accent-p)',
  'var(--accent-y)',
  'var(--accent-r)',
]

// ── Widget ────────────────────────────────────────────────────────────────────
function CalendarWidget({ config, widgetId }: WidgetProps<CalendarConfig>) {
  const { feedUrl, days = 30 } = config ?? {}
  // Use widgetId to make each instance independent in the cache
  const { data, loading, error, retry } = usePollData(
    async () => {
      const params = new URLSearchParams({ url: feedUrl!, days: String(days) })
      const res = await fetch(`/api/calendar?${params}`)
      const json = await res.json() as { events?: CalEvent[]; error?: string }
      if (json.error) throw new Error(json.error)
      return json.events ?? []
    },
    15 * 60_000,   // refresh every 15 min
    [feedUrl, days, widgetId],
  )

  if (!feedUrl)          return <WidgetUnconfigured message="Add an iCal feed URL in widget settings. Works with Google Calendar, Apple iCloud, and any .ics feed." />
  if (loading && !data)  return <WidgetSkeleton rows={4} height={32} />
  if (error   && !data)  return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  const groups = groupByDay(data)

  return (
    <div className="widget-body" style={{ padding: '8px 12px', gap: 0, overflowY: 'auto' }}>
      {groups.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
          No upcoming events in the next {days} day{days !== 1 ? 's' : ''}
        </div>
      ) : groups.map(group => (
        <div key={group.label} style={{ marginBottom: 10 }}>
          {/* Day header */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--accent)',
            padding: '4px 0 5px', borderBottom: '1px solid var(--border)',
            marginBottom: 5,
          }}>
            {group.label}
          </div>

          {/* Events */}
          {group.events.map((e, i) => (
            <div key={e.uid || i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '5px 6px', borderRadius: 6,
              marginBottom: 2,
            }}
              onMouseEnter={ev => (ev.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'}
              onMouseLeave={ev => (ev.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              {/* Color dot */}
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: DOT_COLORS[i % DOT_COLORS.length],
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.summary}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>
                  {e.allDay ? 'All day' : fmtDate(e.start, false).split(' · ')[1]}
                  {e.location && <span style={{ opacity: 0.7 }}> · {e.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const calendarWidget: WidgetDefinition = {
  type:        'calendar',
  displayName: 'Calendar',
  description: 'Upcoming events from any iCal feed (Google, Apple, Outlook)',
  icon:        '📅',
  category:    'general',
  defaultW:    3,
  defaultH:    5,
  minW:        2,
  minH:        3,
  component:   CalendarWidget,
}
