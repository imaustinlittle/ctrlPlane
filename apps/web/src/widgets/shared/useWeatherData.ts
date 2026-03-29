import { useState, useEffect } from 'react'

export interface WeatherData {
  temp:      number
  condition: string
  emoji:     string
  humidity:  number
  windSpeed: number
  location:  string
  units:     string
  forecast:  Array<{ weekday: string; emoji: string; high: number; low: number }>
}

// ── Module-level store, keyed by "location|units" ─────────────────────────────
// Survives tab switches — widgets subscribe and share a single fetch loop.

interface Entry {
  data:    WeatherData | null
  error:   string | null
  timer:   ReturnType<typeof setTimeout> | null
  subs:    Set<() => void>
}

const store = new Map<string, Entry>()

function key(location: string, units: string) { return `${location}|${units}` }

function getOrCreate(location: string, units: string): Entry {
  const k = key(location, units)
  if (!store.has(k)) store.set(k, { data: null, error: null, timer: null, subs: new Set() })
  return store.get(k)!
}

async function tick(location: string, units: string) {
  const entry = getOrCreate(location, units)
  try {
    const res = await fetch(`/api/system/weather?location=${encodeURIComponent(location)}&units=${units}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    entry.data  = (await res.json()) as WeatherData
    entry.error = null
  } catch (e) {
    entry.error = (e as Error).message
  }
  entry.subs.forEach(fn => fn())
  if (entry.subs.size > 0) {
    entry.timer = setTimeout(() => tick(location, units), 15 * 60_000)
  }
}

function subscribe(location: string, units: string, cb: () => void): () => void {
  const entry = getOrCreate(location, units)
  const wasEmpty = entry.subs.size === 0
  entry.subs.add(cb)
  if (wasEmpty) tick(location, units)
  return () => {
    entry.subs.delete(cb)
    if (entry.subs.size === 0 && entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
  }
}

export function useWeatherData(location: string, units: string) {
  const entry = getOrCreate(location, units)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    // Re-subscribe whenever location or units changes
    return subscribe(location, units, () => forceUpdate(n => n + 1))
  }, [location, units])

  return {
    data:    entry.data,
    error:   entry.error,
    loading: entry.data === null && entry.error === null,
  }
}
