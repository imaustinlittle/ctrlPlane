<h1 align="center">
  <code>ctrl</code>Plane
</h1>

<p align="center">
  A self-hosted homelab dashboard. Drop in widgets, connect your services, and see everything at a glance — all from your own server.
</p>

<p align="center">
  <a href="https://github.com/imaustinlittle/ctrlPlane/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
  &nbsp;
  <img alt="Docker" src="https://img.shields.io/badge/deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white"/>
  &nbsp;
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white"/>
</p>

---

## What is ctrlPlane?

ctrlPlane is a drag-and-drop homelab dashboard you run on your own server. Connect it to your existing services — Proxmox, Docker, Home Assistant, Pi-hole — and pull their live data into resizable widgets arranged exactly how you want them. Your layout, your data, your server.

## Features

- **Drag-and-drop layout** — resize and rearrange widgets freely. Changes save automatically.
- **Multiple pages** — organize widgets across tabbed pages; move widgets between tabs from the ··· menu.
- **Live service data** — real metrics from Proxmox, Docker, Home Assistant, Pi-hole, and more.
- **Real-time charts** — fluid scrolling network throughput chart, live CPU/RAM/temp gauges.
- **Encrypted credentials** — integration secrets are AES-256-GCM encrypted at rest. They never leave your server.
- **Alerts & notifications** — define threshold rules on your data; get notified via Discord, ntfy, or a custom webhook.
- **Quick Links** — a customizable bookmark grid for all your self-hosted apps.
- **Calendar** — display upcoming events from any Google, Apple, or self-hosted iCal feed.
- **Themes** — switch accent colors to match your setup.
- **Self-contained** — ships as a single `docker compose up`. No cloud, no accounts, no telemetry.

## Quick Start

```bash
git clone https://github.com/imaustinlittle/ctrlPlane.git
cd ctrlPlane

cp .env.example .env
# Open .env and set MASTER_SECRET (required — generate with: openssl rand -hex 32)

docker compose up -d
```

Open **http://your-server:8080** and start building your dashboard.

## Widgets

| Widget | Description |
|--------|-------------|
| **System Metrics** | Live CPU, RAM, and temperature gauges |
| **Gauge** | Single metric (CPU / RAM / temp) with color-coded arc |
| **Network** | Fluid scrolling upload/download chart; configurable time window |
| **Storage** | Disk usage bars for all mounted filesystems |
| **Clock** | Timezone-aware clock with optional NTP sync |
| **Weather** | Current conditions + 5-day forecast (imperial or metric) |
| **Calendar** | Upcoming events from any iCal feed (Google, Apple, self-hosted) |
| **Quick Links** | Icon grid of bookmarks; supports emoji or image URLs |
| **Services** | Ping-based uptime monitor for any HTTP endpoint |
| **Alerts** | In-dashboard alert center |
| **Containers** | Docker container status and CPU stats |
| **Home Assistant** | Live entity states; pick specific entities to display |
| **Sonarr** | Series list, queue, and version |
| **Radarr** | Movie list, queue, and version |
| **Lidarr** | Artist list, queue, and version |
| **qBittorrent** | Active torrents and transfer stats |
| **SABnzbd** | Active downloads and queue |
| **OPNsense** | Firewall version and system stats |
| **Pi-hole** | DNS query stats and blocking status |
| **AdGuard Home** | DNS filtering stats |
| **Plex** | Active streams and library stats |
| **Tautulli** | Plex watch history and stats |

## Connecting Services

Open the side panel → **Integrations** → **Add integration**. Enter your service URL and credentials — ctrlPlane encrypts and stores them, then polls the service on a background schedule.

| Integration | Connects to |
|-------------|-------------|
| `proxmox` | Proxmox VE — node stats, VM/CT list |
| `docker` | Docker TCP API — container status & stats |
| `homeassistant` | Home Assistant REST API — entity states |
| `pihole` | Pi-hole API — query stats & blocking status |

## Alerts

Set up threshold rules in the side panel → **Alerts**. When a rule fires (e.g. CPU > 90%), ctrlPlane logs the event and can notify you through:

- **Discord** — webhook message
- **ntfy** — push notification (self-hosted or ntfy.sh)
- **Webhook** — POST to any URL

## Your Data Stays Yours

Dashboard layout and widget config are saved to a Docker volume (`ctrlplane-api-data`) and survive container rebuilds.

```bash
# Back up your layout
docker cp ctrlplane-api:/data/state.json ./ctrlplane-backup.json

# Restore
docker cp ./ctrlplane-backup.json ctrlplane-api:/data/state.json
```

> **Never run `docker compose down -v`** unless you want to wipe your saved layout and integration credentials.

## Configuration

All options are in `.env.example`. The only required variable is:

| Variable | Description |
|----------|-------------|
| `MASTER_SECRET` | 32+ character secret used to encrypt integration credentials |

## License

MIT
