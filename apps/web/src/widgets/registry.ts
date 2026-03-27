import type { WidgetDefinition } from '../types'

// ── Auto-discovery ────────────────────────────────────────────────────────────
// Vite's import.meta.glob picks up every widget's index.tsx automatically.
// To add a new widget, just create src/widgets/<name>/index.tsx and export
// a WidgetDefinition — no registration step needed.
//
// The glob is eagerly loaded (eager: true) so all widgets are available
// synchronously on first render, matching the previous behavior.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WidgetModule = Record<string, WidgetDefinition<any>>

const modules = import.meta.glob<WidgetModule>('./*/index.tsx', { eager: true })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_WIDGETS: WidgetDefinition<any>[] = []

for (const path in modules) {
  const mod = modules[path]
  for (const key in mod) {
    const exported = mod[key]
    // Pick up any export that looks like a WidgetDefinition
    if (exported && typeof exported === 'object' && 'type' in exported && 'component' in exported) {
      ALL_WIDGETS.push(exported as WidgetDefinition)
    }
  }
}

// Sort alphabetically by displayName for consistent widget picker ordering
ALL_WIDGETS.sort((a, b) => a.displayName.localeCompare(b.displayName))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WIDGET_REGISTRY = new Map<string, WidgetDefinition<any>>(
  ALL_WIDGETS.map(w => [w.type, w])
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWidget(type: string): WidgetDefinition<any> | undefined {
  return WIDGET_REGISTRY.get(type)
}

export { ALL_WIDGETS }
