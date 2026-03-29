import type { FastifyInstance } from 'fastify'

export interface CalEvent {
  uid:      string
  summary:  string
  start:    string   // ISO 8601
  end:      string   // ISO 8601
  allDay:   boolean
  location: string
}

// ── Minimal iCal parser ───────────────────────────────────────────────────────
// Handles VEVENT blocks. Does NOT handle RRULE recurrence.

function unfold(raw: string): string {
  // iCal line folding: CRLF + whitespace = continuation
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function parseIcalDate(value: string, param: string): { date: Date; allDay: boolean } {
  // All-day: VALUE=DATE or value is YYYYMMDD (8 digits, no T)
  const allDay = param.includes('VALUE=DATE') || /^\d{8}$/.test(value)

  if (allDay) {
    const y = parseInt(value.slice(0, 4), 10)
    const m = parseInt(value.slice(4, 6), 10) - 1
    const d = parseInt(value.slice(6, 8), 10)
    return { date: new Date(y, m, d), allDay: true }
  }

  // With time: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const y  = parseInt(value.slice(0, 4),  10)
  const mo = parseInt(value.slice(4, 6),  10) - 1
  const d  = parseInt(value.slice(6, 8),  10)
  const h  = parseInt(value.slice(9, 11), 10)
  const mi = parseInt(value.slice(11, 13), 10)
  const s  = parseInt(value.slice(13, 15), 10)
  const utc = value.endsWith('Z')

  const date = utc
    ? new Date(Date.UTC(y, mo, d, h, mi, s))
    : new Date(y, mo, d, h, mi, s)

  return { date, allDay: false }
}

function parseIcal(raw: string): CalEvent[] {
  const text   = unfold(raw)
  const lines  = text.split(/\r?\n/)
  const events: CalEvent[] = []

  let inEvent = false
  let cur: Partial<CalEvent> & { startDate?: Date; endDate?: Date } = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (inEvent && cur.startDate) {
        events.push({
          uid:      cur.uid      ?? '',
          summary:  cur.summary  ?? '(No title)',
          start:    cur.startDate.toISOString(),
          end:      cur.endDate?.toISOString() ?? cur.startDate.toISOString(),
          allDay:   cur.allDay   ?? false,
          location: cur.location ?? '',
        })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key   = line.slice(0, colon)
    const value = line.slice(colon + 1).replace(/\\n/g, '\n').replace(/\\,/g, ',').trim()

    const keyBase = key.split(';')[0].toUpperCase()

    if (keyBase === 'UID')     { cur.uid     = value }
    if (keyBase === 'SUMMARY') { cur.summary = value }
    if (keyBase === 'LOCATION'){ cur.location = value }

    if (keyBase === 'DTSTART') {
      const { date, allDay } = parseIcalDate(value, key)
      cur.startDate = date
      cur.allDay    = allDay
    }
    if (keyBase === 'DTEND') {
      const { date } = parseIcalDate(value, key)
      cur.endDate = date
    }
  }

  return events
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function calendarRoutes(app: FastifyInstance) {

  app.get<{ Querystring: { url: string; days?: string } }>('/', async (req, reply) => {
    const { url, days = '30' } = req.query

    if (!url) return reply.status(400).send({ error: 'url query param is required' })
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return reply.status(400).send({ error: 'Only http/https URLs are allowed' })
    }

    const lookAhead = Math.min(365, Math.max(1, parseInt(days, 10) || 30))
    const cutoff    = new Date(Date.now() + lookAhead * 86_400_000)
    const now       = new Date()

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ctrlPlane/1.0 (calendar widget)' },
        signal:  AbortSignal.timeout(10_000),
      })

      if (!res.ok) return reply.status(502).send({ error: `Calendar feed returned HTTP ${res.status}` })

      const text   = await res.text()
      const events = parseIcal(text)
        .filter(e => {
          const start = new Date(e.start)
          return start >= now && start <= cutoff
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

      return { events, fetchedAt: new Date().toISOString() }
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.name === 'TimeoutError') return reply.status(504).send({ error: 'Calendar feed timed out' })
      return reply.status(502).send({ error: (e.message ?? String(err)) })
    }
  })
}
