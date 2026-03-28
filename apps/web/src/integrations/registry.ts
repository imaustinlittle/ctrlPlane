import type { IntegrationDefinition } from '../types'

// ── Auto-discovery ─────────────────────────────────────────────────────────
// Vite's import.meta.glob picks up every widget's optional integration.ts.
// To add a new integration, create src/widgets/<name>/integration.ts and
// export an `integration` object — no registration step needed.
//
// Widgets that share the same integration key (e.g. two Proxmox widgets)
// must declare identical field definitions. A mismatch is logged as a warning
// so widget authors catch configuration drift early.

type IntegrationModule = { integration?: IntegrationDefinition }

const modules = import.meta.glob<IntegrationModule>('../widgets/*/integration.ts', { eager: true })

const seenKeys = new Map<string, { fields: IntegrationDefinition['fields']; sourceWidget: string }>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_INTEGRATIONS: IntegrationDefinition[] = []

for (const [path, mod] of Object.entries(modules)) {
  const def = mod.integration
  if (!def || typeof def !== 'object' || !def.key) continue

  const widgetName = path.match(/\/widgets\/([^/]+)\//)?.[1] ?? path

  if (seenKeys.has(def.key)) {
    const existing = seenKeys.get(def.key)!
    const existingKeys = existing.fields.map(f => f.key).sort().join(',')
    const newKeys     = def.fields.map(f => f.key).sort().join(',')

    if (existingKeys !== newKeys) {
      console.warn(
        `[ctrlPlane] Integration key "${def.key}" is declared by both ` +
        `"${existing.sourceWidget}" and "${widgetName}" but their fields don't match.\n` +
        `  ${existing.sourceWidget}: [${existingKeys}]\n` +
        `  ${widgetName}: [${newKeys}]\n` +
        `  Using the definition from "${existing.sourceWidget}".`
      )
    }
    // First definition wins — skip duplicates regardless of whether fields match
  } else {
    seenKeys.set(def.key, { fields: def.fields, sourceWidget: widgetName })
    ALL_INTEGRATIONS.push(def)
  }
}

export const INTEGRATION_REGISTRY = new Map<string, IntegrationDefinition>(
  ALL_INTEGRATIONS.map(i => [i.key, i])
)

export function getIntegration(key: string): IntegrationDefinition | undefined {
  return INTEGRATION_REGISTRY.get(key)
}

export { ALL_INTEGRATIONS }
