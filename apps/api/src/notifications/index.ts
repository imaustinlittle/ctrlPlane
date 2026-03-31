/**
 * Notification dispatcher.
 * Supports: Discord webhook, ntfy, generic webhook.
 * Never throws — returns { ok, error } so callers can log and continue.
 */
import { isBlockedUrl } from '../lib/ssrf.js'

export interface NotificationChannel {
  id:         string
  name:       string
  type:       string
  configJson: string
  enabled:    boolean | null
}

export interface SendResult {
  ok:     boolean
  error?: string
}

export async function sendNotification(
  channel: NotificationChannel,
  message: string,
  title   = 'ctrlPlane Alert',
): Promise<SendResult> {
  if (!channel.enabled) return { ok: false, error: 'Channel is disabled' }

  let config: Record<string, unknown>
  try {
    config = JSON.parse(channel.configJson) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Invalid channel config JSON' }
  }

  try {
    switch (channel.type) {
      case 'discord':  return await sendDiscord(config, message, title)
      case 'ntfy':     return await sendNtfy(config, message, title)
      case 'webhook':  return await sendWebhook(config, message, title)
      default:
        console.warn(`[notifications] Channel type "${channel.type}" not implemented`)
        return { ok: false, error: `Channel type "${channel.type}" not implemented` }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Discord ───────────────────────────────────────────────────────────────────

async function sendDiscord(
  config: Record<string, unknown>,
  message: string,
  title: string,
): Promise<SendResult> {
  const webhookUrl = config.webhookUrl as string
  if (!webhookUrl) return { ok: false, error: 'discord: missing webhookUrl' }
  if (isBlockedUrl(webhookUrl)) return { ok: false, error: 'discord: blocked URL' }

  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title,
        description: message,
        color: 0xf04747,  // red
        timestamp: new Date().toISOString(),
        footer: { text: 'ctrlPlane' },
      }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `discord: HTTP ${res.status} — ${body}` }
  }
  return { ok: true }
}

// ── ntfy ──────────────────────────────────────────────────────────────────────

async function sendNtfy(
  config: Record<string, unknown>,
  message: string,
  title: string,
): Promise<SendResult> {
  const topic   = config.topic as string
  const server  = (config.server as string | undefined) ?? 'https://ntfy.sh'
  if (!topic) return { ok: false, error: 'ntfy: missing topic' }
  if (isBlockedUrl(`${server}/${topic}`)) return { ok: false, error: 'ntfy: blocked URL' }

  const res = await fetch(`${server}/${topic}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Title':  title,
      'Priority': '4',
      'Tags': 'warning',
    },
    body: message,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `ntfy: HTTP ${res.status} — ${body}` }
  }
  return { ok: true }
}

// ── Generic webhook ───────────────────────────────────────────────────────────

async function sendWebhook(
  config: Record<string, unknown>,
  message: string,
  title: string,
): Promise<SendResult> {
  const url = config.url as string
  if (!url) return { ok: false, error: 'webhook: missing url' }
  if (isBlockedUrl(url)) return { ok: false, error: 'webhook: blocked URL' }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event:   'ctrlplane.alert',
      title,
      message,
      ts:      new Date().toISOString(),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, error: `webhook: HTTP ${res.status} — ${body}` }
  }
  return { ok: true }
}
