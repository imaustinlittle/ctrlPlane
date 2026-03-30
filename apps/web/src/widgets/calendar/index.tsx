import { useState }                                                from 'react'
import type { WidgetDefinition, WidgetProps }                      from '../../types'
import { usePollData }                                             from '../shared/usePollData'
import { WidgetSkeleton, WidgetError, WidgetUnconfigured }         from '../shared/WidgetStatus'

interface CalendarConfig {
  feedUrl?:  string
  days?:     number
  label?:    string
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
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function groupByDay(events: CalEvent[]): Array<{ label: string; key: string; events: CalEvent[] }> {
  const groups = new Map<string, { label: string; key: string; events: CalEvent[] }>()
  const today    = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

  for (const e of events) {
    const d   = new Date(e.start)
    const day = new Date(d); day.setHours(0,0,0,0)
    const key = d.toDateString()
    const label =
      day.getTime() === today.getTime()    ? 'Today'    :
      day.getTime() === tomorrow.getTime() ? 'Tomorrow' :
      d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

    if (!groups.has(key)) groups.set(key, { label, key: toDateKey(day), events: [] })
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

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ── Mini calendar grid ────────────────────────────────────────────────────────
function MiniCalendar({
  year, month, eventDays, onPrev, onNext,
}: {
  year: number
  month: number  // 0-based
  eventDays: Set<string>
  onPrev: () => void
  onNext: () => void
}) {
  const today     = new Date()
  const firstDay  = new Date(year, month, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  // Build grid: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={onPrev} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{monthLabel}</span>
        <button onClick={onNext} style={navBtnStyle}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600,
            color: 'var(--text2)', letterSpacing: '0.04em', padding: '0 0 3px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />

          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const hasEvent = eventDays.has(`${year}-${month}-${day}`)

          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '2px 0',
            }}>
              <div style={{
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: isToday ? 'var(--accent)' : 'transparent',
                fontSize: 11,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? '#fff' : 'var(--text)',
              }}>
                {day}
              </div>
              {/* Event dot */}
              <div style={{
                width: 4, height: 4, borderRadius: '50%', marginTop: 1,
                background: hasEvent ? 'var(--accent)' : 'transparent',
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text2)',
  fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
}

// ── Widget ────────────────────────────────────────────────────────────────────
function CalendarWidget({ config, widgetId }: WidgetProps<CalendarConfig>) {
  const { feedUrl, days = 30 } = config ?? {}

  const now = new Date()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const { data, loading, error, retry } = usePollData(
    async () => {
      const params = new URLSearchParams({ url: feedUrl!, days: String(days) })
      const res  = await fetch(`/api/calendar?${params}`)
      const json = await res.json() as { events?: CalEvent[]; error?: string }
      if (json.error) throw new Error(json.error)
      return json.events ?? []
    },
    15 * 60_000,
    [feedUrl, days, widgetId],
  )

  if (!feedUrl)          return <WidgetUnconfigured message="Add an iCal feed URL in widget settings. Works with Google Calendar, Apple iCloud, and any .ics feed." />
  if (loading && !data)  return <WidgetSkeleton rows={4} height={32} />
  if (error   && !data)  return <WidgetError message={error} onRetry={retry} />
  if (!data) return null

  // Build set of day keys that have events (for dot rendering)
  const eventDays = new Set<string>(
    data.map(e => { const d = new Date(e.start); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` })
  )

  const groups = groupByDay(data)

  return (
    <div className="widget-body" style={{ padding: '8px 12px', gap: 0, overflowY: 'auto', flexDirection: 'column' }}>

      <MiniCalendar
        year={viewYear}
        month={viewMonth}
        eventDays={eventDays}
        onPrev={prevMonth}
        onNext={nextMonth}
      />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '10px 0 8px' }} />

      {/* Upcoming event list */}
      {groups.length === 0 ? (
        <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
          No upcoming events in the next {days} day{days !== 1 ? 's' : ''}
        </div>
      ) : groups.map(group => (
        <div key={group.label} style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--accent)',
            padding: '4px 0 5px', borderBottom: '1px solid var(--border)',
            marginBottom: 5,
          }}>
            {group.label}
          </div>

          {group.events.map((e, i) => (
            <div key={e.uid || i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '5px 6px', borderRadius: 6, marginBottom: 2,
            }}
              onMouseEnter={ev => (ev.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'}
              onMouseLeave={ev => (ev.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
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
                  {e.allDay
                    ? 'All day'
                    : new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
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
  defaultH:    6,
  minW:        2,
  minH:        4,
  component:   CalendarWidget,
}
