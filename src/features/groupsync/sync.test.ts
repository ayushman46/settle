import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, completeOnboarding, createGroup, saveExpense } from '../../data'
import { flushAllStores, reloadAllStores } from '../../data/store'
import { expensesStore, groupsStore } from '../../data/stores'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { joinGroup, shareGroup, syncLocal } from './local'
import { sharedFor } from './store'
import { resetGroupSyncForTests, syncNow } from './sync'
import { inviteLink, readInvite, roomOf, seal, unseal } from './transport'
import { parseWire, type WireGroup } from './wire'

/** The relay, in memory: what `/api/sync/:room` keeps. `down` makes every request fail. */
const server = { rooms: new Map<string, string>(), down: false, off: false, puts: 0 }

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (server.down) return Promise.reject(new TypeError('Failed to fetch'))
  const url = new URL(String(input), 'http://localhost')
  const room = url.pathname.split('/').pop() ?? ''
  if (server.off) return Promise.resolve(new Response('{}', { status: 503 }))
  const version = (data: string): string => `v${data.length}-${data.slice(-12)}`
  if ((init?.method ?? 'GET') === 'PUT') {
    const { data } = JSON.parse(String(init?.body)) as { data: string }
    server.rooms.set(room, data)
    server.puts++
    return Promise.resolve(Response.json({ ok: true, v: version(data) }))
  }
  const data = server.rooms.get(room) ?? null
  if (data === null) return Promise.resolve(Response.json({ ok: true, v: null, data: null }))
  const v = version(data)
  return Promise.resolve(Response.json({ ok: true, v, data: url.searchParams.get('have') === v ? null : data }))
}

const phones = new Map<string, Record<string, string>>()
let inHand: string | null = null
function pickUp(name: string): void {
  if (inHand === name) return
  flushAllStores()
  if (inHand !== null) {
    const dump: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null) dump[key] = localStorage.getItem(key) ?? ''
    }
    phones.set(inHand, dump)
  }
  localStorage.clear()
  for (const [key, value] of Object.entries(phones.get(name) ?? {})) localStorage.setItem(key, value)
  reloadAllStores()
  // A different phone knows nothing of what the last one learned this visit.
  resetGroupSyncForTests()
  inHand = name
}

const groupId = (): string => groupsStore.get()[0]?.id ?? ''
function expense(title: string, total: number): void {
  const group = groupsStore.get()[0]
  if (!group) throw new Error('no group')
  saveExpense({ kind: 'split', title, category: 'food', currency: 'INR', total, date: '2026-11-14', payerId: ME_ID, mode: 'equal', participants: group.memberIds.map((friendId) => ({ friendId, input: null })), roundedToWhole: false, note: null, groupId: group.id, bill: null, recurringId: null, source: 'manual' })
}
const titles = (): string[] => expensesStore.get().map((e) => e.title).sort()

beforeEach(() => {
  phones.clear()
  inHand = null
  server.rooms.clear()
  server.down = false
  server.off = false
  server.puts = 0
  resetDataForTests()
  resetGroupSyncForTests()
  vi.stubGlobal('fetch', fakeFetch)
})
afterEach(() => vi.unstubAllGlobals())

async function twoPhones(): Promise<void> {
  pickUp('ayush')
  completeOnboarding({ name: 'Ayush', upiId: 'ayush@okaxis' })
  const riya = addFriend({ name: 'Riya' })
  const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id] })
  expense('Villa', 600000)
  const shared = shareGroup(group.id)
  await syncNow(group.id)
  // The invite, as a link that only says which group (the server has the rest).
  const built = syncLocal(group.id, null)?.wire as WireGroup
  const { url, slim } = await inviteLink(built, shared?.key ?? '', 'https://settle.test', true)
  expect(slim).toBe(true)
  const invite = await readInvite(url)
  expect(invite?.wire.x).toEqual([])

  pickUp('riya')
  completeOnboarding({ name: 'Riya', upiId: 'riya@ybl' })
  const id = joinGroup(invite?.wire as WireGroup, invite?.key ?? '', invite?.wire.m.find((m) => m.n === 'Riya')?.i ?? null)
  await syncNow(id)
}

describe('live groups, through the server', () => {
  it('a slim invite plus the room brings the whole group; changes go both ways', async () => {
    await twoPhones()
    expect(titles()).toEqual(['Villa'])
    expense('Cab', 90000)
    await syncNow(groupId())
    pickUp('ayush')
    await syncNow(groupId())
    expect(titles()).toEqual(['Cab', 'Villa'])
    expect(sharedFor(groupId())?.synced).not.toBeNull()
    // Nothing new: another round writes nothing.
    const puts = server.puts
    await syncNow(groupId())
    pickUp('riya')
    await syncNow(groupId())
    expect(server.puts).toBe(puts)
  })

  it('what the server holds can’t be read without the invite’s secret', async () => {
    await twoPhones()
    const key = sharedFor(groupId())?.key ?? ''
    const kept = server.rooms.get(roomOf(key)) ?? ''
    expect(kept).not.toContain('Villa')
    expect(atob(kept.replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('Villa')
    expect(await unseal(kept, 'a-different-secret-entirely')).toBeNull()
    expect((await unseal(kept, key))?.x.map((e) => e.t)).toEqual(['Villa'])
    // A copy sealed twice differs each time (a fresh nonce), and opens to the same thing.
    const again = await seal(JSON.stringify(await unseal(kept, key)), key)
    expect(again).not.toBe(kept)
    expect(parseWire(await unseal(again, key))?.id).toBe((await unseal(kept, key))?.id)
  })

  it('with the server unreachable, changes wait on the phone and go out when it’s back', async () => {
    await twoPhones()
    server.down = true
    expense('Chai', 12000)
    await syncNow(groupId())
    expect(titles()).toEqual(['Chai', 'Villa'])
    pickUp('ayush')
    server.down = false
    await syncNow(groupId())
    expect(titles()).toEqual(['Villa'])
    pickUp('riya')
    await syncNow(groupId())
    pickUp('ayush')
    await syncNow(groupId())
    expect(titles()).toEqual(['Chai', 'Villa'])
  })

  it('a server that keeps no copies: the group still merges from a full link', async () => {
    await twoPhones()
    server.off = true
    expense('Beers', 60000)
    await syncNow(groupId())
    const out = syncLocal(groupId(), null)?.wire as WireGroup
    const { url, slim } = await inviteLink(out, sharedFor(groupId())?.key ?? '', 'https://settle.test')
    expect(slim).toBe(false)
    pickUp('ayush')
    const invite = await readInvite(url)
    syncLocal(groupId(), invite?.wire ?? null)
    expect(titles()).toEqual(['Beers', 'Villa'])
  })
})
