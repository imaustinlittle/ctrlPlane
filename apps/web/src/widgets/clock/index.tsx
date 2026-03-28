import { useState, useEffect } from 'react'
import type { WidgetDefinition, WidgetProps } from '../../types'

interface ClockConfig {
  timezone?:    string
  showSeconds?: boolean
  hour12?:      boolean
  ntpUrl?:      string
}

function pad(n: number) { return String(n).padStart(2, '0') }

function getTimeParts(date: Date, tz: string, hour12: boolean) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz === 'local' ? undefined : tz,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12,
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  return {
    hh:     pad(parseInt(get('hour'))),
    mm:     get('minute'),
    ss:     get('second'),
    ampm:   hour12 ? (parts.find(p => p.type === 'dayPeriod')?.value ?? '') : '',
  }
}

function getDateString(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz === 'local' ? undefined : tz,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date)
}

function tzLabel(tz: string): string {
  if (!tz || tz === 'local') return 'Local time'
  return tz.replace(/_/g, ' ')
}

function ClockWidget({ config }: WidgetProps<ClockConfig>) {
  const [now, setNow]           = useState(new Date())
  const [timeOffset, setOffset] = useState(0)

  const tz      = config.timezone ?? 'local'
  const showSec = config.showSeconds !== false
  const use12h  = config.hour12 ?? false
  const ntpUrl  = config.ntpUrl

  useEffect(() => {
    const id = setInterval(() => setNow(new Date(Date.now() + timeOffset)), 1000)
    return () => clearInterval(id)
  }, [timeOffset])

  useEffect(() => {
    if (!ntpUrl) return
    const sync = async () => {
      try {
        const t0  = Date.now()
        const res = await fetch(ntpUrl)
        const t1  = Date.now()
        const json = await res.json() as { unixtime?: number; utc_datetime?: string }
        const serverMs = json.unixtime
          ? json.unixtime * 1000
          : json.utc_datetime ? new Date(json.utc_datetime).getTime() : null
        if (serverMs) setOffset(serverMs + (t1 - t0) / 2 - Date.now())
      } catch { /* fall back to system clock */ }
    }
    sync()
    const id = setInterval(sync, 5 * 60_000)
    return () => clearInterval(id)
  }, [ntpUrl])

  const { hh, mm, ss, ampm } = getTimeParts(now, tz, use12h)
  const dim = parseInt(ss) % 2 === 1
  const dateStr = getDateString(now, tz)
  return (
    <div className="widget-body" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '8px 12px 14px',
      gap: 4,
    }}>
      {/* Time */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 'clamp(28px, 5vw, 42px)',
        fontWeight: 400,
        letterSpacing: '-1.5px',
        lineHeight: 1,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 0,
        whiteSpace: 'nowrap',
      }}>
        <span>{hh}</span>
        <span className={`clock-colon${dim ? ' dim' : ''}`}>:</span>
        <span>{mm}</span>
        {showSec && (
          <>
            <span className={`clock-colon${dim ? ' dim' : ''}`}>:</span>
            <span style={{ fontSize: '0.6em', color: 'var(--text2)', alignSelf: 'flex-end', marginBottom: '0.1em' }}>{ss}</span>
          </>
        )}
        {ampm && (
          <span style={{ fontSize: '0.45em', color: 'var(--text2)', alignSelf: 'flex-end', marginBottom: '0.15em', marginLeft: 4 }}>{ampm}</span>
        )}
      </div>

      {/* Date */}
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{dateStr}</div>

      {/* Timezone */}
      <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>📍</span>
        <span>{tzLabel(tz)}</span>
        {ntpUrl && <span style={{ color: 'var(--accent-g)', fontSize: 10 }}>● synced</span>}
      </div>
    </div>
  )
}

export const clockWidget: WidgetDefinition<ClockConfig> = {
  type:        'clock',
  displayName: 'World Clock',
  description: 'Live clock with timezone support and optional NTP sync',
  icon:        '🕐',
  category:    'general',
  defaultW:    2,
  defaultH:    3,
  minW:        2,
  minH:        2,
  component:   ClockWidget,
}
