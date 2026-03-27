import type { WidgetDefinition, WidgetProps } from '../../types'

export interface LinkItem {
  name:  string
  url:   string
  emoji: string
}

interface LinksConfig {
  links?: LinkItem[]
}

const DEFAULT_LINKS: LinkItem[] = [
  { name: 'Plex',       url: 'https://app.plex.tv',  emoji: '📺' },
  { name: 'Home Asst.', url: '#',                    emoji: '🏠' },
  { name: 'Portainer',  url: '#',                    emoji: '🐳' },
  { name: 'Proxmox',    url: '#',                    emoji: '🖥' },
  { name: 'Pi-hole',    url: '#',                    emoji: '🌐' },
  { name: 'Frigate',    url: '#',                    emoji: '📷' },
  { name: 'Immich',     url: '#',                    emoji: '🖼' },
  { name: 'Jellyfin',   url: '#',                    emoji: '🎬' },
  { name: 'Sonarr',     url: '#',                    emoji: '📡' },
]

const CELL = 80   // fixed px — cells never stretch
const GAP  = 6

function isImageUrl(s: string): boolean {
  return /^https?:\/\/|^data:|^\//.test(s.trim())
}

function normalizeUrl(url: string): string {
  if (!url || url === '#') return '#'
  if (/^https?:\/\//.test(url)) return url
  if (url.startsWith('//')) return url
  if (!url.startsWith('/') && url.includes('.') && !url.includes(' ')) return `http://${url}`
  return url
}

function Icon({ src }: { src: string }) {
  if (isImageUrl(src)) {
    return <img src={src} alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4 }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
  }
  return <span style={{ fontSize: 22, lineHeight: 1 }}>{src}</span>
}

function LinksWidget({ config }: WidgetProps<LinksConfig>) {
  const links = (config.links as LinkItem[] | undefined) ?? DEFAULT_LINKS

  return (
    <div className="widget-body" style={{ padding: '6px 12px 10px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, ${CELL}px)`,
        gridAutoRows: `${CELL}px`,
        gap: GAP,
        alignContent: 'start',
      }}>
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url === '#' ? undefined : normalizeUrl(link.url)}
            target={link.url === '#' ? undefined : '_blank'}
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: link.url === '#' ? 'default' : 'pointer',
              textDecoration: 'none',
              transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
              overflow: 'hidden',
              padding: '0 6px',
            }}
            onMouseEnter={e => {
              if (link.url === '#') return
              const el = e.currentTarget
              el.style.background = 'var(--surface-h)'
              el.style.borderColor = 'var(--border-b)'
              el.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = 'var(--bg3)'
              el.style.borderColor = 'var(--border)'
              el.style.transform = 'translateY(0)'
            }}
          >
            <Icon src={link.emoji} />
            <span style={{
              fontSize: 11, color: 'var(--text2)', fontWeight: 500,
              textAlign: 'center', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: '100%',
            }}>
              {link.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

export const linksWidget: WidgetDefinition<LinksConfig> = {
  type:        'links',
  displayName: 'Quick Links',
  description: 'Customizable bookmark grid for your services',
  icon:        '🔗',
  category:    'general',
  defaultW:    4,
  defaultH:    4,
  minW:        2,
  minH:        1,
  getMinSize(config, { w }) {
    const n = ((config.links as LinkItem[] | undefined) ?? DEFAULT_LINKS).length
    // ~1 grid column ≈ 1 cell wide (both ~80-90px at typical viewport).
    // Rows needed at current width → that's the minimum height.
    const cellsPerRow = Math.max(1, w)
    return { minW: 2, minH: Math.max(1, Math.ceil(n / cellsPerRow)) }
  },
  component:   LinksWidget,
}
