import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { ENV } from '../lib/env.js'

const DATA_DIR   = ENV.DATA_DIR
const STATE_FILE = path.join(DATA_DIR, 'state.json')

// Zod schema — permissive enough to not break on future widget additions,
// strict enough to catch corrupted state before it reaches the store.
const WidgetLayoutSchema = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
}).passthrough()

const WidgetInstanceSchema = z.object({
  id:   z.string(),
  type: z.string(),
}).passthrough()

const DashboardPageSchema = z.object({
  id:      z.string(),
  name:    z.string(),
  icon:    z.string().optional(),
  layout:  z.array(WidgetLayoutSchema).default([]),
  widgets: z.array(WidgetInstanceSchema).default([]),
}).passthrough()

const ThemeSchema = z.object({
  name:   z.string(),
  accent: z.string(),
}).passthrough()

const PersistedStateSchema = z.object({
  pages:        z.array(DashboardPageSchema),
  activePageId: z.string(),
  theme:        ThemeSchema,
}).passthrough()

// In-memory cache so reads don't hit disk every time
let cache: string | null = null

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readFromDisk(): Promise<string | null> {
  try {
    return await fs.readFile(STATE_FILE, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function writeToDisk(data: string): Promise<void> {
  await ensureDataDir()
  const tmp = `${STATE_FILE}.tmp`
  await fs.writeFile(tmp, data, 'utf-8')
  await fs.rename(tmp, STATE_FILE)
}

export async function stateRoutes(app: FastifyInstance) {

  try {
    await ensureDataDir()
    cache = await readFromDisk()
    if (cache) {
      app.log.info({ file: STATE_FILE, bytes: cache.length }, 'State loaded from disk')
    } else {
      app.log.info({ file: STATE_FILE }, 'No saved state found, will use defaults')
    }
  } catch (err) {
    app.log.error({ err }, 'Failed to read state from disk on startup')
  }

  // GET /api/state
  app.get('/', async (_req, reply) => {
    const raw = cache ?? await readFromDisk()
    if (!raw) return reply.status(404).send({ data: null })

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      app.log.error({ file: STATE_FILE }, 'State file contains invalid JSON')
      return reply.status(500).send({ error: 'Corrupted state file — reset via DELETE /api/state' })
    }

    const result = PersistedStateSchema.safeParse(parsed)
    if (!result.success) {
      app.log.warn({ issues: result.error.issues }, 'State file failed schema validation')
      // Still return the raw data — client defaults will fill in missing fields
      return { data: parsed, savedAt: new Date().toISOString(), warning: 'State schema mismatch — some fields may be missing' }
    }

    return { data: result.data, savedAt: new Date().toISOString() }
  })

  // PUT /api/state
  app.put<{ Body: unknown }>('/', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' })
    }

    const result = PersistedStateSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(422).send({
        error:   'State failed validation',
        details: result.error.flatten().fieldErrors,
      })
    }

    try {
      const serialized = JSON.stringify(result.data)
      if (serialized.length > 2_000_000) {
        return reply.status(413).send({ error: 'State too large (max 2MB)' })
      }

      cache = serialized
      await writeToDisk(serialized)

      app.log.info({ bytes: serialized.length, file: STATE_FILE }, 'State saved to disk')
      return { ok: true, savedAt: new Date().toISOString(), bytes: serialized.length }
    } catch (err) {
      app.log.error({ err }, 'Failed to save state to disk')
      return reply.status(500).send({ error: `Failed to save: ${(err as Error).message}` })
    }
  })

  // DELETE /api/state — reset to defaults
  app.delete('/', async (_req, reply) => {
    try {
      cache = null
      await fs.unlink(STATE_FILE).catch(() => {})
      return { ok: true, message: 'State cleared' }
    } catch (err) {
      return reply.status(500).send({ error: `Failed to clear: ${(err as Error).message}` })
    }
  })
}
