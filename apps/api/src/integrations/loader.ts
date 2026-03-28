/**
 * Dynamic integration loader.
 *
 * Scans the web app's widget directories for co-located integration.ts files
 * and builds a runtime registry. No registration step needed — dropping an
 * integration.ts next to a widget is enough.
 *
 * Each integration.ts must export:
 *   export const integration = {
 *     key: string            // shared credential namespace (e.g. 'proxmox')
 *     displayName: string
 *     fetchData(creds): Promise<unknown>
 *     healthCheck?(creds): Promise<{ ok, message, latencyMs? }>
 *   }
 *
 * Multiple widgets can share the same key (same credentials, different data).
 * The loader deduplicates by key — first definition wins for metadata/healthCheck,
 * but every widget's fetchData is registered under its own widget type.
 */

import { readdirSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// Path from apps/api/src/integrations/ up to apps/web/src/widgets/
const WIDGETS_DIR = resolve(__dirname, '../../../web/src/widgets')

// ── Registry types ────────────────────────────────────────────────────────────

export interface LoadedIntegration {
  key:         string
  displayName: string
  /** widgetType (directory name) → fetchData for that widget */
  widgets:     Map<string, (creds: Record<string, string>) => Promise<unknown>>
  healthCheck?: (creds: Record<string, string>) => Promise<{ ok: boolean; message: string; latencyMs?: number }>
}

// integrationKey → LoadedIntegration
let REGISTRY: Map<string, LoadedIntegration> | null = null

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loadIntegrationRegistry(): Promise<Map<string, LoadedIntegration>> {
  if (REGISTRY) return REGISTRY

  const registry = new Map<string, LoadedIntegration>()
  const seenKeys = new Map<string, string>() // key → first widget name (for mismatch warning)

  let entries: import('fs').Dirent<string>[]
  try {
    entries = readdirSync(WIDGETS_DIR, { withFileTypes: true, encoding: 'utf8' })
  } catch {
    console.warn('[ctrlPlane] Could not read widgets directory at:', WIDGETS_DIR)
    REGISTRY = registry
    return registry
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const integrationFile = join(WIDGETS_DIR, entry.name as string, 'integration.ts')
    if (!existsSync(integrationFile)) continue

    const widgetType = entry.name as string

    try {
      type IntegrationMod = {
        integration?: {
          key:          string
          displayName:  string
          fetchData:    (creds: Record<string, string>, config?: Record<string, unknown>) => Promise<unknown>
          healthCheck?: (creds: Record<string, string>) => Promise<{ ok: boolean; message: string; latencyMs?: number }>
        }
      }
      const mod = await import(integrationFile) as IntegrationMod
      const def = mod.integration

      if (!def?.key || typeof def.fetchData !== 'function') {
        console.warn(`[ctrlPlane] ${integrationFile}: missing key or fetchData — skipping`)
        continue
      }

      if (!registry.has(def.key)) {
        // First widget to declare this key — create the entry
        registry.set(def.key, {
          key:         def.key,
          displayName: def.displayName,
          widgets:     new Map([[widgetType, (creds) => def.fetchData(creds)]]),
          healthCheck: def.healthCheck,
        })
        seenKeys.set(def.key, widgetType)
        console.log(`[ctrlPlane] Loaded integration "${def.key}" from widget "${widgetType}"`)
      } else {
        // Subsequent widget sharing the same key — add its fetchData
        const existing = registry.get(def.key)!
        if (!existing.widgets.has(widgetType)) {
          existing.widgets.set(widgetType, (creds) => def.fetchData(creds))
          console.log(`[ctrlPlane] Added widget "${widgetType}" to integration "${def.key}"`)
        }
      }
    } catch (err) {
      console.warn(`[ctrlPlane] Failed to load integration from ${integrationFile}:`, err)
    }
  }

  REGISTRY = registry
  console.log(`[ctrlPlane] Integration registry ready — ${registry.size} integration(s) loaded`)
  return registry
}

export function getIntegration(key: string): LoadedIntegration | undefined {
  return REGISTRY?.get(key)
}

export function getAllIntegrations(): LoadedIntegration[] {
  return REGISTRY ? Array.from(REGISTRY.values()) : []
}
