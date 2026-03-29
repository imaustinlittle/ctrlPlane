// ── SSRF protection ───────────────────────────────────────────────────────────
// Block loopback, cloud-metadata, and internal Docker service names.
// Private LAN IPs (192.168.x.x, 10.x.x.x, etc.) are intentionally allowed —
// this is a homelab dashboard and users need to reach their local services.

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  '169.254.169.254',  // AWS / GCP / Azure metadata
  '169.254.170.2',    // ECS task metadata
  // Internal Docker service names that should never be reachable from widgets
  'redis',
  'postgres',
  'ctrlplane-redis',
  'ctrlplane-postgres',
  'ctrlplane-api',
])

// IPv6 private/link-local prefixes (lowercase hex)
const BLOCKED_IPV6_PREFIXES = ['fc', 'fd', 'fe80', 'ff']

export function isBlockedUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw)
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')  // strip [ ] from IPv6
    if (BLOCKED_HOSTNAMES.has(h)) return true
    // Block IPv6 private/link-local ranges
    if (BLOCKED_IPV6_PREFIXES.some(p => h.startsWith(p))) return true
    return false
  } catch {
    return true   // unparseable URL → block
  }
}
