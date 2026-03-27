import { useState, useEffect, useRef, type RefObject } from 'react'
import type {
  SystemMetrics,
  ServiceStatus,
  ContainerInfo,
  StorageMount,
  NetworkStats,
  WeatherData,
} from '../types'

// Smoothly drift a value between min/max
function drift(current: number, min: number, max: number, speed = 3): number {
  const delta = (Math.random() - 0.5) * speed
  return Math.max(min, Math.min(max, current + delta))
}

// ── System Metrics ──────────────────────────────────────────────────────────
export function useSystemMetrics(): SystemMetrics {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 42,
    ram: 75,
    ramUsedGb: 48.2,
    ramTotalGb: 64,
    temp: 52,
    fanRpm: 1180,
    uptime: 1_847_392,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((m) => {
        const cpu = drift(m.cpu, 8, 95, 8)
        const ram = drift(m.ram, 60, 90, 2)
        return {
          ...m,
          cpu,
          ram,
          ramUsedGb: parseFloat(((ram / 100) * 64).toFixed(1)),
          temp: drift(m.temp, 38, 82, 1.5),
          fanRpm: Math.round(drift(m.fanRpm, 800, 2400, 60)),
          uptime: m.uptime + 2,
        }
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return metrics
}

// ── Network Stats ───────────────────────────────────────────────────────────
const HISTORY_LEN = 30

export function useNetworkStats(): NetworkStats {
  const [stats, setStats] = useState<NetworkStats>({
    uploadMbps: 12,
    downloadMbps: 85,
    latencyMs: 4.2,
    history: Array.from({ length: HISTORY_LEN }, () => ({
      up: Math.random() * 50,
      down: Math.random() * 200,
    })),
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((s) => {
        const up = drift(s.uploadMbps, 0.5, 120, 15)
        const down = drift(s.downloadMbps, 1, 400, 30)
        return {
          uploadMbps: parseFloat(up.toFixed(1)),
          downloadMbps: parseFloat(down.toFixed(1)),
          latencyMs: parseFloat(drift(s.latencyMs, 1, 45, 2).toFixed(1)),
          history: [...s.history.slice(1), { up, down }],
        }
      })
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  return stats
}

// ── Service Statuses ────────────────────────────────────────────────────────
const MOCK_SERVICES: ServiceStatus[] = [
  { name: 'Plex',          url: 'http://plex:32400',   status: 'up',   pingMs: 4 },
  { name: 'Home Assistant',url: 'http://ha:8123',      status: 'up',   pingMs: 2 },
  { name: 'Proxmox',       url: 'https://proxmox:8006',status: 'warn', pingMs: 180 },
  { name: 'Pi-hole',       url: 'http://pihole/admin', status: 'up',   pingMs: 1 },
  { name: 'Sonarr',        url: 'http://sonarr:8989',  status: 'down' },
  { name: 'Radarr',        url: 'http://radarr:7878',  status: 'up',   pingMs: 8 },
  { name: 'Jellyfin',      url: 'http://jellyfin:8096',status: 'up',   pingMs: 6 },
  { name: 'Immich',        url: 'http://immich:3001',  status: 'up',   pingMs: 12 },
]

export function useServiceStatuses(): ServiceStatus[] {
  return MOCK_SERVICES
}

// ── Container Info ──────────────────────────────────────────────────────────
const MOCK_CONTAINERS: ContainerInfo[] = [
  { id: 'c1', name: 'plex',          image: 'linuxserver/plex',          status: 'running', cpuPercent: 2.1,  memMb: 512 },
  { id: 'c2', name: 'homeassistant', image: 'homeassistant/home-assistant',status: 'running', cpuPercent: 0.4, memMb: 384 },
  { id: 'c3', name: 'sonarr',        image: 'linuxserver/sonarr',         status: 'exited',  cpuPercent: 0,   memMb: 0 },
  { id: 'c4', name: 'radarr',        image: 'linuxserver/radarr',         status: 'running', cpuPercent: 0.2, memMb: 256 },
  { id: 'c5', name: 'pihole',        image: 'pihole/pihole',              status: 'running', cpuPercent: 0.1, memMb: 128 },
  { id: 'c6', name: 'immich',        image: 'ghcr.io/immich-app/immich',  status: 'running', cpuPercent: 1.8, memMb: 768 },
  { id: 'c7', name: 'qbittorrent',   image: 'linuxserver/qbittorrent',    status: 'stopped', cpuPercent: 0,   memMb: 0 },
  { id: 'c8', name: 'jellyfin',      image: 'linuxserver/jellyfin',       status: 'running', cpuPercent: 3.2, memMb: 640 },
]

export function useContainers(): ContainerInfo[] {
  const [containers, setContainers] = useState(MOCK_CONTAINERS)

  useEffect(() => {
    const interval = setInterval(() => {
      setContainers((cs) =>
        cs.map((c) =>
          c.status === 'running'
            ? { ...c, cpuPercent: parseFloat(drift(c.cpuPercent, 0.1, 8, 0.8).toFixed(1)) }
            : c
        )
      )
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return containers
}

// ── Storage ─────────────────────────────────────────────────────────────────
export function useStorage(): StorageMount[] {
  return [
    { mount: '/',       label: '/ (system)',    usedGb: 42.1,   totalGb: 100 },
    { mount: '/data',   label: '/data (media)', usedGb: 15_155, totalGb: 20_480 },
    { mount: '/backup', label: '/backup',       usedGb: 2_150,  totalGb: 8_192 },
    { mount: '/vm',     label: '/vm (Proxmox)', usedGb: 1_228,  totalGb: 4_096 },
  ]
}

// ── Weather ─────────────────────────────────────────────────────────────────
export function useWeather(): WeatherData {
  return {
    tempF: 72,
    condition: 'Partly cloudy',
    emoji: '⛅',
    humidity: 62,
    windMph: 8,
    location: 'Smyrna, GA',
  }
}

// ── Clock ────────────────────────────────────────────────────────────────────
// Aligns to wall-clock second boundary so multiple clocks stay in sync
export function useClock(): Date {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    let id: ReturnType<typeof setInterval>

    // Wait until the next exact second boundary, then start a steady interval
    const msUntilNextSecond = 1000 - (Date.now() % 1000)
    const alignTimeout = setTimeout(() => {
      setNow(new Date())
      id = setInterval(() => setNow(new Date()), 1000)
    }, msUntilNextSecond)

    return () => {
      clearTimeout(alignTimeout)
      clearInterval(id)
    }
  }, [])
  return now
}

// ── Uptime formatter ─────────────────────────────────────────────────────────
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Canvas sparkline hook ────────────────────────────────────────────────────
export function useSparkline(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  data: { up: number; down: number }[]
) {
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w === 0 || h === 0) return
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h)

      const maxVal = Math.max(...data.map((d) => Math.max(d.up, d.down)), 1)

      const drawLine = (values: number[], color: string) => {
        ctx.beginPath()
        values.forEach((v, i) => {
          const x = (i / (values.length - 1)) * w
          const y = h - (v / maxVal) * (h - 4) - 2
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        })
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.lineJoin = 'round'
        ctx.stroke()
      }

      drawLine(data.map((d) => d.up),   '#3fb950')
      drawLine(data.map((d) => d.down), '#58a6ff')
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])  // canvasRef is stable — excluding it prevents spurious redraws
}
