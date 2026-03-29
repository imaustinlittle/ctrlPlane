import type { DashboardPage } from '../types'

export const DEFAULT_PAGES: DashboardPage[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: '⬡',
    layout: [
      { i: 'clock',      x: 0,  y: 0, w: 2, h: 3, minW: 2, minH: 2 },
      { i: 'weather',    x: 2,  y: 0, w: 2, h: 3, minW: 2, minH: 3 },
      { i: 'sysmetrics', x: 4,  y: 0, w: 6, h: 2, minW: 3, minH: 2 },
      { i: 'services',   x: 0,  y: 3, w: 4, h: 5, minW: 3, minH: 3 },
      { i: 'alerts',     x: 4,  y: 3, w: 4, h: 5, minW: 3, minH: 3 },
      { i: 'containers', x: 8,  y: 3, w: 4, h: 5, minW: 2, minH: 2 },
      { i: 'storage',    x: 0,  y: 8, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'network',    x: 4,  y: 8, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'links',      x: 8,  y: 8, w: 4, h: 4, minW: 2, minH: 2 },
    ],
    widgets: [
      { id: 'clock',      type: 'clock',      config: { timezone: 'local', showSeconds: true } },
      { id: 'weather',    type: 'weather',    config: { location: 'Smyrna, GA', units: 'imperial' } },
      { id: 'sysmetrics', type: 'sysmetrics',  config: {} },
      { id: 'services',   type: 'services',   config: {} },
      { id: 'alerts',     type: 'alerts',     config: {} },
      { id: 'containers', type: 'containers', config: {} },
      { id: 'storage',    type: 'storage',    config: {} },
      { id: 'network',    type: 'network',    config: {} },
      { id: 'links', type: 'links', config: {
        links: [
          { name: 'Plex',       url: '#', emoji: '📺' },
          { name: 'Home Asst.', url: '#', emoji: '🏠' },
          { name: 'Portainer',  url: '#', emoji: '🐳' },
          { name: 'Proxmox',    url: '#', emoji: '🖥' },
          { name: 'Pi-hole',    url: '#', emoji: '🌐' },
          { name: 'Frigate',    url: '#', emoji: '📷' },
          { name: 'Immich',     url: '#', emoji: '🖼' },
          { name: 'Jellyfin',   url: '#', emoji: '🎬' },
          { name: 'Sonarr',     url: '#', emoji: '📡' },
        ]
      } },
    ],
  },
  {
    id: 'media',
    name: 'Media',
    icon: '🎬',
    layout: [
      { i: 'plex-status', x: 0, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
    ],
    widgets: [
      { id: 'plex-status', type: 'services', config: {} },
    ],
  },
]
