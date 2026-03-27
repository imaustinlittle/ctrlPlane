# ctrlPlane

A self-hosted homelab dashboard. Drop widgets in, connect your services, see everything at a glance.

## Stack

- **Frontend** — React 18 + TypeScript + Vite, Zustand, TailwindCSS, react-grid-layout
- **API** — Fastify 4 + TypeScript
- **Storage** — PostgreSQL + Redis (future), JSON file persistence on a Docker volume (current)
- **Deployment** — Docker Compose

## Quick start

```bash
cp .env.example .env
# Edit .env — set MASTER_SECRET at minimum

docker compose up -d
```

Open `http://your-server:8080`.

## Architecture

```
apps/
  web/          # React frontend (Vite)
    src/
      components/     # UI components (Topbar, SidePanel, WidgetCard, Toast)
      components/panels/  # Modal/pane UIs (Config, TabManager, Integrations, Widgets, Settings)
      hooks/          # useIntegration, useMockData
      store/          # Zustand store + API persistence layer
      types/          # Shared TypeScript types
      widgets/        # Widget library — each widget is a self-contained folder
  api/          # Fastify backend
    src/
      routes/         # state, integrations, dashboards, widgets, alerts...
      db/             # Drizzle schema (PostgreSQL — future)
      integrations/   # Service adapters (Proxmox, HA, Docker...)
```

## Adding a widget

Create a folder in `apps/web/src/widgets/<your-widget>/` with an `index.tsx` that exports a `WidgetDefinition`:

```typescript
import type { WidgetDefinition, WidgetProps } from '../../types'

function MyWidget({ config }: WidgetProps<MyConfig>) {
  return <div className="widget-body">...</div>
}

export const myWidget: WidgetDefinition<MyConfig> = {
  type:        'my-widget',
  displayName: 'My Widget',
  description: 'What it does',
  icon:        '🔧',
  category:    'general',
  defaultW: 3, defaultH: 3,
  minW: 2,     minH: 2,
  component:   MyWidget,
}
```

The widget auto-discovers via `import.meta.glob` — no registration needed.

## Connecting real data

Open the side panel → Integrations → Add integration. Supported types:

| Type | What it connects to |
|------|---------------------|
| `proxmox` | Proxmox VE API |
| `docker` | Docker TCP API |
| `homeassistant` | Home Assistant REST API |
| `pihole` | Pi-hole API |

Credentials are stored in `/data/integrations.json` on the `homelab-api-data` Docker volume — never leaves your server.

In a widget, consume an integration:

```typescript
import { useIntegration, NotConfigured } from '../../hooks/useIntegration'

const { data, loading, error, configured } = useIntegration('docker/containers', { refreshMs: 5000 })
if (!configured) return <NotConfigured name="Docker" />
```

## Persistence

Dashboard state (layouts, widget configs, theme) is saved to `/data/state.json` on the `homelab-api-data` volume. It survives container rebuilds. **Never run `docker compose down -v`** unless you want to wipe your saved layout.

To back up your state:
```bash
docker cp homelab-api:/data/state.json ./ctrlplane-backup.json
```

To reset to defaults:
```bash
curl -X DELETE http://localhost:8080/api/state
```

## Environment variables

See `.env.example` for all options. Required:

| Variable | Description |
|----------|-------------|
| `MASTER_SECRET` | Secret key for signing tokens |

## License

MIT
