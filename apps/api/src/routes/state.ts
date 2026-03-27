import type { FastifyInstance } from 'fastify'
import { promises as fs } from 'fs'
import path from 'path'

// Persist to a file on a Docker volume — survives container rebuilds
const DATA_DIR   = process.env.DATA_DIR ?? '/data'
const STATE_FILE = path.join(DATA_DIR, 'state.json')

// In-memory cache so reads don't hit disk every time
let cache: string | null = null

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readFromDisk(): Promise<string | null> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8')
    return data
  } catch (err: unknown) {
    // ENOENT = file doesn't exist yet, that's fine
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function writeToDisk(data: string): Promise<void> {
  await ensureDataDir()
  // Write to a temp file first, then rename — atomic, prevents corruption
  // if the process is killed mid-write
  const tmp = `${STATE_FILE}.tmp`
  await fs.writeFile(tmp, data, 'utf-8')
  await fs.rename(tmp, STATE_FILE)
}

export async function stateRoutes(app: FastifyInstance) {

  // Warm the cache on startup
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
    // Serve from cache if available
    const data = cache ?? await readFromDisk()
    if (!data) return reply.status(404).send({ data: null })
    try {
      return { data: JSON.parse(data), savedAt: new Date().toISOString() }
    } catch {
      return reply.status(500).send({ error: 'Corrupted state file' })
    }
  })

  // PUT /api/state
  app.put<{ Body: unknown }>('/', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object') {
      return reply.status(400).send({ error: 'Invalid body' })
    }
    try {
      const serialized = JSON.stringify(req.body)
      if (serialized.length < 10)        return reply.status(400).send({ error: 'State too small' })
      if (serialized.length > 2_000_000) return reply.status(413).send({ error: 'State too large (max 2MB)' })

      // Update cache immediately, write to disk async
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
      await fs.unlink(STATE_FILE).catch(() => {}) // ignore if already gone
      return { ok: true, message: 'State cleared' }
    } catch (err) {
      return reply.status(500).send({ error: `Failed to clear: ${(err as Error).message}` })
    }
  })
}
