import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import { loadConfig } from './config'
import { cloudSyncStore, memorySyncStore, syncVersion, upstashSyncStore } from './sync'
import { testConfig } from './testing'

const ROOM = 'r'.repeat(32)
const WRITE = 'w'.repeat(32)
const quiet = { log: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined }
const app = (store = memorySyncStore()) => createApp(testConfig(), { logger: quiet, syncStore: store })
const put = (a: ReturnType<typeof app>, body: unknown, room = ROOM) =>
  a.request(`/api/sync/${room}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: JSON.stringify(body) })

describe('live groups relay', () => {
  it('keeps the last copy written and hands it back; "have" skips sending what the phone already has', async () => {
    const a = app()
    expect(await (await a.request(`/api/sync/${ROOM}`)).json()).toEqual({ ok: true, v: null, data: null })
    const data = 'A'.repeat(64)
    const written = await put(a, { data, write: WRITE })
    expect(written.status).toBe(200)
    const v = syncVersion(data)
    expect(await written.json()).toEqual({ ok: true, v })
    expect(await (await a.request(`/api/sync/${ROOM}`)).json()).toEqual({ ok: true, v, data })
    expect(await (await a.request(`/api/sync/${ROOM}?have=${v}`)).json()).toEqual({ ok: true, v, data: null })
    expect((await a.request(`/api/sync/${ROOM}`)).headers.get('Cache-Control')).toBe('no-store')
  })

  it('only takes writes from someone with the group’s token, and refuses malformed ones', async () => {
    const a = app()
    await put(a, { data: 'A'.repeat(64), write: WRITE })
    expect((await put(a, { data: 'B'.repeat(64), write: 'x'.repeat(32) })).status).toBe(403)
    expect((await put(a, { data: 'B'.repeat(64), write: WRITE })).status).toBe(200)
    expect((await put(a, { data: 'not base64url!', write: WRITE })).status).toBe(400)
    expect((await put(a, { data: 'A'.repeat(64) })).status).toBe(400)
    expect((await put(a, { data: 'A'.repeat(64), write: WRITE }, 'short')).status).toBe(400)
    expect((await a.request('/api/sync/short')).status).toBe(400)
  })

  it('says so when live groups are off, and health reports it', async () => {
    const off = createApp(testConfig({ sync: null }), { logger: quiet })
    expect((await off.request(`/api/sync/${ROOM}`)).status).toBe(503)
    expect(((await (await off.request('/api/health')).json()) as { sync?: boolean }).sync).toBe(false)
    expect(((await (await app().request('/api/health')).json()) as { sync?: boolean }).sync).toBe(true)
  })

  it('a store that’s down is an error the phone can retry, never a lost group', async () => {
    const broken = { get: () => Promise.reject(new Error('down')), set: () => Promise.reject(new Error('down')) }
    const a = app(broken)
    expect((await a.request(`/api/sync/${ROOM}`)).status).toBe(502)
    expect((await put(a, { data: 'A'.repeat(64), write: WRITE })).status).toBe(502)
  })

  it('talks to Upstash over REST', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => new Response(JSON.stringify({ result: JSON.parse(String(init?.body))[0] === 'GET' ? 'value' : 'OK' })))
    const store = upstashSyncStore('https://kv.test', 'token-token-token', fetchImpl as unknown as typeof fetch)
    expect(await store.get('k')).toBe('value')
    await store.set('k', 'v', 60)
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual(['SET', 'k', 'v', 'EX', 60])
    expect((fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer token-token-token')
  })

  it('picks where copies are kept from the settings', () => {
    expect(loadConfig({}).sync).toEqual({ kind: 'memory' })
    expect(loadConfig({ VERCEL: '1', CLOUD_API_URL: 'off' }).sync).toBeNull()
    expect(loadConfig({ VERCEL: '1', KV_REST_API_URL: 'https://x.upstash.io/', KV_REST_API_TOKEN: 't'.repeat(20) }).sync).toEqual({ kind: 'upstash', url: 'https://x.upstash.io', token: 't'.repeat(20) })
    expect(loadConfig({ SYNC_STORE: 'off' }).sync).toBeNull()
    expect(loadConfig({ VERCEL: '1', SYNC_STORE: 'memory' }).sync).toEqual({ kind: 'memory' })
  })

  it('keeps copies in the accounts database through the settle-api function', async () => {
    const rooms = new Map<string, string>()
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      const room = String(url).split('/relay/')[1]!
      if (init?.method === 'POST') {
        const { value } = JSON.parse(String(init.body)) as { value: string }
        const had = rooms.get(room)
        if (had && JSON.parse(had).w !== JSON.parse(value).w) return new Response('{}', { status: 403 })
        rooms.set(room, value)
        return new Response('{"ok":true}')
      }
      return new Response(JSON.stringify({ value: rooms.get(room) ?? null }))
    })
    const a = app(cloudSyncStore('https://cloud.test/functions/v1/settle-api', fetchImpl as unknown as typeof fetch))
    const data = 'c'.repeat(40)
    expect((await put(a, { data, write: 'w'.repeat(30) })).status).toBe(200)
    expect(await (await a.request(`/api/sync/${ROOM}`)).json()).toEqual({ ok: true, v: syncVersion(data), data })
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`https://cloud.test/functions/v1/settle-relay/relay/${ROOM}`)
  })

  it('uses the accounts database on Vercel when there is no Upstash', () => {
    expect(loadConfig({ VERCEL: '1' }).sync).toEqual({ kind: 'cloud' })
    expect(loadConfig({ VERCEL: '1', CLOUD_API_URL: 'off' }).sync).toBeNull()
    expect(loadConfig({ VERCEL: '1', SYNC_STORE: 'off' }).sync).toBeNull()
  })
})
