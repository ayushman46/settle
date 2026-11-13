/**
 * Live groups: `GET /api/sync/:room` and `PUT /api/sync/:room`.
 *
 * A shared group's phones leave their latest copy here and pick up each other's. The server can't
 * read any of it: a copy is encrypted on the phone with a secret that only travels in the invite
 * link's `#fragment`. All the server knows is a room name (a hash of that secret), a token that
 * proves a writer has the secret (stored hashed), and an opaque blob. Phones merge copies
 * themselves, so the server keeps just the last one written; nothing here decides anything.
 *
 * Where it's kept: Upstash Redis over REST when its URL and token are set (Vercel's "KV"), else —
 * on a long-running server — in memory, which is enough for a relay (every phone has the whole
 * group and writes it again). On Vercel without a store, live groups are off and say so.
 */
import type { Hono, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { SyncGetResponse, SyncPutResponse } from '../shared/api'
import type { RateLimitConfig, ServerConfig } from './config'
import { fail, NOT_JSON, readJson, type Logger } from './http'
import { clientKey, rateLimit } from './ratelimit'

/** The biggest encrypted copy kept (a few thousand expenses fit several times over). */
export const MAX_SYNC_BYTES = 400 * 1024
/** A copy nobody has touched for this long is forgotten (every phone still has the group). */
export const SYNC_TTL_SECONDS = 400 * 86_400
export const SYNC_RATE_LIMIT: Readonly<RateLimitConfig> = { max: 240, windowMs: 60_000 }
const MAX_MEMORY_ROOMS = 5000

const ROOM = /^[A-Za-z0-9_-]{22,64}$/
const PutSchema = z.object({
  data: z.string().min(16).max(MAX_SYNC_BYTES).regex(/^[A-Za-z0-9_-]+$/),
  write: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/),
})

export const SYNC_MESSAGES = {
  off: 'Live groups aren’t set up on this server yet. Send the group as a link instead.',
  malformed: 'Something went wrong syncing the group. Please try again.',
  denied: 'This group can only be updated from an invite link to it.',
  down: 'Couldn’t reach the group’s storage. Your changes are safe on this phone and will sync later.',
  tooMany: 'Syncing too often. It will catch up in a minute.',
} as const

/** Where copies are kept: a key, a value, and how long to keep it. */
export interface SyncStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

/** In memory: for a server that stays up (and for tests). The oldest rooms make way for new ones. */
export function memorySyncStore(max = MAX_MEMORY_ROOMS): SyncStore {
  const rooms = new Map<string, string>()
  return {
    get: (key) => Promise.resolve(rooms.get(key) ?? null),
    set: (key, value) => {
      rooms.delete(key)
      rooms.set(key, value)
      if (rooms.size > max) {
        const oldest = rooms.keys().next().value
        if (oldest !== undefined) rooms.delete(oldest)
      }
      return Promise.resolve()
    },
  }
}

/** Upstash Redis over its REST API (what Vercel's KV integration provides). */
export function upstashSyncStore(url: string, token: string, fetchImpl: typeof fetch = fetch): SyncStore {
  const run = async (command: unknown[]): Promise<unknown> => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`Store answered ${response.status}`)
    return ((await response.json()) as { result?: unknown }).result
  }
  return {
    get: async (key) => {
      const value = await run(['GET', key])
      return typeof value === 'string' ? value : null
    },
    set: async (key, value, ttlSeconds) => {
      await run(['SET', key, value, 'EX', ttlSeconds])
    },
  }
}

/** The store the settings ask for, or null when live groups are off. */
export function syncStoreFor(config: ServerConfig, fetchImpl: typeof fetch = fetch): SyncStore | null {
  if (config.sync === null) return null
  return config.sync.kind === 'memory' ? memorySyncStore() : upstashSyncStore(config.sync.url, config.sync.token, fetchImpl)
}

const sha = (text: string): string => createHash('sha256').update(text).digest('base64url')
/** A copy's version: what a phone quotes to ask "anything newer than this?". */
export const syncVersion = (data: string): string => sha(data).slice(0, 22)

interface Kept {
  /** Hash of the write token. */
  w: string
  d: string
}

export interface SyncOptions {
  config: ServerConfig
  log: Logger
  now: () => number
  /** Rejects cross-site and non-JSON requests (see http.ts). */
  ownPageOnly: MiddlewareHandler
  store: SyncStore | null
}

export function registerSync(app: Hono, { config, log, now, ownPageOnly, store }: SyncOptions): void {
  const limited = rateLimit(SYNC_RATE_LIMIT, {
    now,
    keyFor: (c) => clientKey(c, config),
    onLimited: (c) => fail(c, 'rate_limited', { message: SYNC_MESSAGES.tooMany }),
  })
  const key = (room: string): string => `settle:sync:${room}`

  const read = async (room: string): Promise<Kept | null> => {
    const raw = await (store as SyncStore).get(key(room))
    if (raw === null) return null
    try {
      const kept = JSON.parse(raw) as Partial<Kept>
      return typeof kept.w === 'string' && typeof kept.d === 'string' ? { w: kept.w, d: kept.d } : null
    } catch {
      return null
    }
  }

  app.get('/api/sync/:room', limited, async (c) => {
    if (!store) return fail(c, 'not_configured', { message: SYNC_MESSAGES.off })
    const room = c.req.param('room')
    if (!ROOM.test(room)) return fail(c, 'bad_request', { message: SYNC_MESSAGES.malformed })
    try {
      const kept = await read(room)
      if (!kept) return c.json({ ok: true, v: null, data: null } satisfies SyncGetResponse)
      const v = syncVersion(kept.d)
      // Nothing newer than what the phone has: no need to send it again.
      if (c.req.query('have') === v) return c.json({ ok: true, v, data: null } satisfies SyncGetResponse)
      return c.json({ ok: true, v, data: kept.d } satisfies SyncGetResponse)
    } catch (error) {
      log.error(`[sync] read failed: ${error instanceof Error ? error.name : 'error'}`)
      return fail(c, 'upstream_error', { message: SYNC_MESSAGES.down })
    }
  })

  app.put('/api/sync/:room', limited, ownPageOnly, bodyLimit({ maxSize: MAX_SYNC_BYTES + 4096, onError: (c) => fail(c, 'bad_request', { message: SYNC_MESSAGES.malformed }) }), async (c) => {
    if (!store) return fail(c, 'not_configured', { message: SYNC_MESSAGES.off })
    const room = c.req.param('room')
    const body = await readJson(c)
    const parsed = body === NOT_JSON ? null : PutSchema.safeParse(body)
    if (!ROOM.test(room) || !parsed?.success) return fail(c, 'bad_request', { message: SYNC_MESSAGES.malformed })
    const { data, write } = parsed.data
    try {
      const kept = await read(room)
      // Only someone with the group's secret can write to its room (the first writer sets the token).
      if (kept && kept.w !== sha(write)) return fail(c, 'bad_request', { status: 403, message: SYNC_MESSAGES.denied })
      await store.set(key(room), JSON.stringify({ w: sha(write), d: data } satisfies Kept), SYNC_TTL_SECONDS)
      return c.json({ ok: true, v: syncVersion(data) } satisfies SyncPutResponse)
    } catch (error) {
      log.error(`[sync] write failed: ${error instanceof Error ? error.name : 'error'}`)
      return fail(c, 'upstream_error', { message: SYNC_MESSAGES.down })
    }
  })
}
