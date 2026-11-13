import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, completeOnboarding, createGroup, deleteExpense, recordSettlement, restoreExpense, saveExpense, updateGroup } from '../../data'
import { flushAllStores, reloadAllStores } from '../../data/store'
import { expensesStore, friendsStore, groupsStore, profileStore } from '../../data/stores'
import { resetDataForTests } from '../../data/testing'
import { ME_ID, type Expense } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { joinGroup, shareGroup, syncLocal } from './local'
import { groupSyncStore, sharedFor } from './store'
import { canonical, mergeWire, parseWire, type WireGroup } from './wire'

/* Several phones in one test: each has its own storage, swapped in while it's "in hand". */
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
  inHand = name
}

let clock = 1_800_000_000_000
const tick = (): number => (clock += 1000)

function expense(groupId: string, title: string, total: number, payerId: string, people: string[]): Expense {
  return saveExpense({
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total,
    date: '2026-11-14',
    payerId,
    mode: 'equal',
    participants: people.map((friendId) => ({ friendId, input: null })),
    roundedToWhole: false,
    note: null,
    groupId,
    bill: null,
    recurringId: null,
    source: 'manual',
  })
}

const groupId = (): string => groupsStore.get()[0]?.id ?? ''
const idOf = (name: string): string => friendsStore.get().find((f) => f.name === name)?.id ?? `no ${name}`
/** Balances by name ("You" is the phone's owner's real name), for comparing phones. */
function balances(): Record<string, number> {
  const group = groupsStore.get()[0]
  if (!group) return {}
  const raw = groupBalances(group, expensesStore.get())
  const out: Record<string, number> = {}
  for (const id of group.memberIds) out[id === ME_ID ? profileStore.get().name : (friendsStore.get().find((f) => f.id === id)?.name ?? '?')] = raw[id] ?? 0
  return out
}

/** A copy as it arrives: through JSON and the parser, like a link or the server. */
const sent = (wire: WireGroup): WireGroup => parseWire(JSON.parse(JSON.stringify(wire))) as WireGroup

beforeEach(() => {
  phones.clear()
  inHand = null
  resetDataForTests()
})

/** Ayush makes "Goa" with Riya and Sam and shares it; Riya and Sam join on their phones. */
function threePhones(): { key: string; wire: WireGroup } {
  pickUp('ayush')
  completeOnboarding({ name: 'Ayush', upiId: 'ayush@okaxis' })
  const riya = addFriend({ name: 'Riya' })
  const sam = addFriend({ name: 'Sam' })
  const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id, sam.id] })
  expense(group.id, 'Dinner', 240000, ME_ID, [ME_ID, riya.id, sam.id])
  const shared = shareGroup(group.id, tick())
  const invite = sent(syncLocal(group.id, null, tick())?.wire as WireGroup)
  const key = shared?.key ?? ''

  pickUp('riya')
  completeOnboarding({ name: 'Riya', upiId: 'riya@ybl' })
  joinGroup(invite, key, invite.m.find((m) => m.n === 'Riya')?.i ?? null, tick())

  pickUp('sam')
  completeOnboarding({ name: 'Sam' })
  joinGroup(invite, key, invite.m.find((m) => m.n === 'Sam')?.i ?? null, tick())
  return { key, wire: invite }
}

/** One round through a shared place (the server, or the latest link): take what's there, merge, leave the result. */
function round(place: { wire: WireGroup | null }, phone: string): void {
  pickUp(phone)
  const out = syncLocal(groupId(), place.wire, tick())
  if (out) place.wire = sent(out.wire)
}

describe('merging copies', () => {
  it('is the same whatever the order, and merging again changes nothing', () => {
    threePhones()
    pickUp('ayush')
    const a = syncLocal(groupId(), null, tick())?.wire as WireGroup
    pickUp('riya')
    expense(groupId(), 'Cab', 60000, ME_ID, [ME_ID, idOf('Ayush')])
    const b = syncLocal(groupId(), null, tick())?.wire as WireGroup
    pickUp('sam')
    expense(groupId(), 'Chai', 9000, ME_ID, [ME_ID, idOf('Riya'), idOf('Ayush')])
    const c = syncLocal(groupId(), null, tick())?.wire as WireGroup
    const one = canonical(mergeWire(mergeWire(a, b), c))
    expect(canonical(mergeWire(a, mergeWire(b, c)))).toBe(one)
    expect(canonical(mergeWire(mergeWire(c, a), b))).toBe(one)
    expect(canonical(mergeWire(mergeWire(a, b), mergeWire(mergeWire(a, b), c)))).toBe(one)
  })

  it('refuses a copy that isn’t one, and drops what’s malformed inside one', () => {
    expect(parseWire(null)).toBeNull()
    expect(parseWire({ v: 1, id: 'abcd', n: 'x', c: 'INR', m: [] })).toBeNull()
    const ok = parseWire({
      v: 1,
      id: 'abcdef',
      n: 'Goa',
      e: '🏖️',
      k: 'trip',
      c: 'INR',
      u: 5,
      m: [{ i: 'aaaa', n: 'A', u: 'not a upi id', c: 1, v: 1, j: 0 }, { i: 'bbbb', n: 'B', u: 'bee@ybl', c: 2, v: 1, j: 0 }, 'junk'],
      x: [
        { i: 'e111', t: 'Fine', a: 100, d: '2026-11-01', p: 'aaaa', s: { aaaa: 50, bbbb: 50 }, g: 'food', k: 'split', m: 'equal', q: {}, o: null, c: 1, u: 2, b: null },
        { i: 'e222', t: 'Doesn’t add up', a: 100, d: '2026-11-01', p: 'aaaa', s: { aaaa: 50, bbbb: 40 }, g: 'food', k: 'split', m: 'equal', q: {}, o: null, c: 1, u: 2, b: null },
        { i: 'e333', t: 'Stranger paid', a: 100, d: '2026-11-01', p: 'zzzz', s: { aaaa: 100 }, g: 'food', k: 'split', m: 'equal', q: {}, o: null, c: 1, u: 2, b: null },
      ],
      s: [{ i: 's111', f: 'aaaa', t: 'aaaa', a: 5, d: '2026-11-01', m: 'upi', c: 1, u: 1 }],
      z: { e999: 4, '<script>': 9 },
    })
    expect(ok?.m.map((m) => [m.i, m.u])).toEqual([['aaaa', null], ['bbbb', 'bee@ybl']])
    expect(ok?.x.map((e) => e.i)).toEqual(['e111'])
    expect(ok?.s).toEqual([])
    expect(ok?.z).toEqual({ e999: 4 })
  })
})

describe('three phones, one group', () => {
  it('joining brings the group, its people and its expenses, with you as the name you picked', () => {
    threePhones()
    pickUp('riya')
    const group = groupsStore.get()[0]
    expect(group?.name).toBe('Goa')
    expect(group?.memberIds[0]).toBe(ME_ID)
    expect((group?.memberIds ?? []).map((id) => (id === ME_ID ? 'me' : friendsStore.get().find((f) => f.id === id)?.name)).sort()).toEqual(['Ayush', 'Sam', 'me'])
    expect(balances()).toEqual({ Riya: -80000, Ayush: 160000, Sam: -80000 })
    // Ayush's UPI ID came with the group: Riya can pay him straight away.
    expect(friendsStore.get().find((f) => f.name === 'Ayush')?.upiId).toBe('ayush@okaxis')
  })

  it('an expense added on any phone reaches all of them, and everyone’s balances agree', () => {
    threePhones()
    const server = { wire: null as WireGroup | null }
    pickUp('riya')
    expense(groupId(), 'Cab', 90000, ME_ID, [ME_ID, idOf('Ayush'), idOf('Sam')])
    pickUp('sam')
    expense(groupId(), 'Beer', 30000, ME_ID, [ME_ID, idOf('Ayush')])
    for (const phone of ['riya', 'sam', 'ayush', 'riya', 'sam']) round(server, phone)
    const want = { Ayush: 240000 - 80000 - 30000 - 15000, Riya: 90000 - 80000 - 30000, Sam: 30000 - 80000 - 30000 - 15000 }
    for (const phone of ['ayush', 'riya', 'sam']) {
      pickUp(phone)
      expect(expensesStore.get().map((e) => e.title).sort()).toEqual(['Beer', 'Cab', 'Dinner'])
      expect(balances()).toEqual(want)
    }
    // Riya's UPI ID, from her own phone, is on everyone's.
    pickUp('sam')
    expect(friendsStore.get().find((f) => f.name === 'Riya')?.upiId).toBe('riya@ybl')
    // Nothing left to say: another round changes no copy.
    const before = canonical(server.wire as WireGroup)
    for (const phone of ['ayush', 'riya', 'sam']) round(server, phone)
    expect(canonical(server.wire as WireGroup)).toBe(before)
  })

  it('an edit, a delete (and its undo) and a recorded payment travel too', () => {
    threePhones()
    const server = { wire: null as WireGroup | null }
    for (const phone of ['ayush', 'riya', 'sam']) round(server, phone)

    pickUp('riya')
    const dinner = expensesStore.get().find((e) => e.title === 'Dinner') as Expense
    clock += 5000
    expensesStore.update((list) => list.map((e) => (e.id === dinner.id ? { ...e, title: 'Dinner at Fisherman’s', updatedAt: clock } : e)))
    recordSettlement(groupId(), { fromId: ME_ID, toId: idOf('Ayush'), amount: 80000, date: '2026-11-14', method: 'upi' })
    round(server, 'riya')
    round(server, 'ayush')
    expect(expensesStore.get()[0]?.title).toBe('Dinner at Fisherman’s')
    expect(groupsStore.get()[0]?.settlements.map((s) => [s.fromId === idOf('Riya'), s.toId, s.amount])).toEqual([[true, ME_ID, 80000]])
    expect(balances()).toEqual({ Ayush: 80000, Riya: 0, Sam: -80000 })

    // Sam deletes it; it goes everywhere.
    pickUp('sam')
    round(server, 'sam')
    const gone = deleteExpense(dinner.id) as Expense
    round(server, 'sam')
    round(server, 'ayush')
    expect(expensesStore.get()).toEqual([])
    // Undo on Sam's phone: back everywhere.
    pickUp('sam')
    restoreExpense(gone)
    round(server, 'sam')
    round(server, 'ayush')
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Dinner at Fisherman’s'])
    round(server, 'riya')
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Dinner at Fisherman’s'])
  })

  it('someone not on the list joins under their own name; a renamed group and a new member reach everyone', () => {
    const { key } = threePhones()
    const server = { wire: null as WireGroup | null }
    for (const phone of ['ayush', 'riya', 'sam']) round(server, phone)

    pickUp('zoya')
    completeOnboarding({ name: 'Zoya', upiId: 'zoya@oksbi' })
    joinGroup(server.wire as WireGroup, key, null, tick())
    round(server, 'zoya')
    pickUp('ayush')
    clock += 5000
    updateGroup(groupId(), { name: 'Goa 2026' })
    const dev = addFriend({ name: 'Dev' })
    updateGroup(groupId(), { memberIds: [...(groupsStore.get()[0]?.memberIds ?? []), dev.id] })
    for (const phone of ['ayush', 'zoya', 'riya', 'sam', 'ayush']) round(server, phone)
    for (const phone of ['ayush', 'riya', 'sam', 'zoya']) {
      pickUp(phone)
      const group = groupsStore.get()[0]
      expect(group?.name).toBe('Goa 2026')
      const names = (group?.memberIds ?? []).map((id) => (id === ME_ID ? profileStore.get().name : friendsStore.get().find((f) => f.id === id)?.name))
      expect([...names].sort()).toEqual(['Ayush', 'Dev', 'Riya', 'Sam', 'Zoya'])
    }
    pickUp('riya')
    expect(friendsStore.get().find((f) => f.name === 'Zoya')?.upiId).toBe('zoya@oksbi')
    expect(sharedFor(groupId())?.seen[sharedFor(groupId())?.me ?? '']?.j).toBeGreaterThan(0)
  })

  it('two phones changing the same expense: the later change wins on both', () => {
    threePhones()
    const server = { wire: null as WireGroup | null }
    for (const phone of ['ayush', 'riya']) round(server, phone)
    pickUp('ayush')
    const id = expensesStore.get()[0]?.id
    expensesStore.update((list) => list.map((e) => (e.id === id ? { ...e, title: 'Ayush’s name for it', updatedAt: clock + 10_000 } : e)))
    pickUp('riya')
    expensesStore.update((list) => list.map((e) => (e.id === id ? { ...e, title: 'Riya’s name for it', updatedAt: clock + 20_000 } : e)))
    clock += 30_000
    for (const phone of ['ayush', 'riya', 'ayush']) round(server, phone)
    for (const phone of ['ayush', 'riya']) {
      pickUp(phone)
      expect(expensesStore.get()[0]?.title).toBe('Riya’s name for it')
    }
  })

  it('a group that isn’t shared is left alone, and each phone keeps one record per shared group', () => {
    threePhones()
    pickUp('ayush')
    const other = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [] })
    expect(syncLocal(other.id, null)).toBeNull()
    expect(Object.keys(groupSyncStore.get())).toHaveLength(1)
  })
})
