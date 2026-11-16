import { describe, expect, it } from 'vitest'
import type { Expense, Friend, Group } from '../../../domain/types'
import { batches, canonical, emptyShadow, hashOf, planPull, planPush, recordPushed, type LocalData, type Parsers, type Pulled } from './engine'

const friend = (id: string, name: string): Friend => ({ id, name, color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 })
const group = (id: string, name: string): Group => ({
  id,
  name,
  emoji: '🌴',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'f1'],
  settlements: [],
  createdAt: 1,
  updatedAt: 1,
  archived: false,
})
const expense = (id: string, total: number): Expense => ({
  id,
  kind: 'split',
  title: 'Dinner',
  category: 'food',
  currency: 'INR',
  total,
  date: '2026-11-16',
  createdAt: 1,
  updatedAt: 1,
  payerId: 'me',
  mode: 'equal',
  participants: [
    { friendId: 'me', input: null },
    { friendId: 'f1', input: null },
  ],
  shares: { me: total / 2, f1: total / 2 },
  roundedToWhole: false,
  note: null,
  groupId: 'g1',
  bill: null,
  paidBack: {},
  recurringId: null,
  source: 'manual',
})

const local = (over: Partial<LocalData> = {}): LocalData => ({ friends: [], groups: [], expenses: [], stores: { 'settle.v10.tally': undefined }, ...over })
const parse: Parsers = { friend: (v) => v as Friend, group: (v) => v as Group, expense: (v) => v as Expense }
const pulled = (over: Partial<Pulled> = {}): Pulled => ({ friends: [], groups: [], expenses: [], stores: [], cursor: 0, more: false, ...over })

describe('canonical', () => {
  it('ignores key order and missing values', () => {
    expect(canonical({ b: 1, a: { d: 2, c: undefined } })).toBe(canonical({ a: { d: 2 }, b: 1 }))
    expect(hashOf({ x: [1, 2] })).not.toBe(hashOf({ x: [2, 1] }))
  })
})

describe('planPush', () => {
  it('sends everything the first time, then only what changed or was deleted', () => {
    const data = local({ friends: [friend('me', 'Ayush'), friend('f1', 'Riya')], expenses: [expense('e1', 1000)], stores: { 'settle.v10.tally': { v: 1, data: [] } } })
    const first = planPush(emptyShadow(), data, 100)
    expect(first.payload.friends).toHaveLength(2)
    expect(first.payload.expenses[0]).toMatchObject({ id: 'e1', updatedAt: 100, deleted: false, shares: { me: 500, f1: 500 } })
    expect(first.payload.stores).toEqual([{ key: 'settle.v10.tally', data: { v: 1, data: [] }, updatedAt: 100, deleted: false }])

    const shadow = recordPushed(emptyShadow(), first.entries)
    expect(planPush(shadow, data, 200).entries).toHaveLength(0)

    const edited = local({ friends: [friend('me', 'Ayush')], expenses: [expense('e1', 2000)], stores: { 'settle.v10.tally': { v: 1, data: [] } } })
    const second = planPush(shadow, edited, 200)
    expect(second.payload.friends).toEqual([{ id: 'f1', updatedAt: 200, deleted: true }])
    expect(second.payload.expenses[0]).toMatchObject({ id: 'e1', total: 2000, updatedAt: 200 })
    const after = recordPushed(shadow, second.entries)
    expect(after.friends.f1).toBeUndefined()
    expect(after.expenses.e1!.t).toBe(200)
  })

  it('batches big pushes without losing or mixing rows', () => {
    const data = local({ expenses: Array.from({ length: 25 }, (_, i) => expense(`e${i}`, 100 * (i + 1))), friends: [friend('me', 'A')] })
    const plan = planPush(emptyShadow(), data, 1)
    const parts = batches(plan, 10)
    expect(parts).toHaveLength(3)
    expect(parts.flatMap((p) => p.payload.expenses.map((r) => r.id))).toEqual(plan.payload.expenses.map((r) => r.id))
    for (const part of parts) {
      for (const entry of part.entries) expect(part.payload[entry.kind].some((r) => (r.id ?? r.key) === entry.id)).toBe(true)
    }
  })
})

describe('planPull', () => {
  it('a new phone takes everything from the account, even over its own first records', () => {
    const phone = local({ friends: [friend('me', 'Me')], stores: { 'settle.v3.profile': { v: 1, data: { name: 'Me' } } } })
    const res = planPull(
      emptyShadow(),
      phone,
      pulled({
        friends: [{ id: 'me', name: 'Ayush', color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1, updatedAt: 50, rev: 3, deleted: false }],
        groups: [{ ...group('g1', 'Goa'), updatedAt: 60, rev: 4, deleted: false }],
        stores: [{ key: 'settle.v3.profile', data: { v: 1, data: { name: 'Ayush' } }, updatedAt: 70, rev: 5, deleted: false }],
      }),
      'serverWins',
      parse,
    )
    expect(res.friends).toEqual([friend('me', 'Ayush')])
    expect(res.groups?.[0]).toMatchObject({ id: 'g1', name: 'Goa', updatedAt: 60 })
    expect(res.stores['settle.v3.profile']).toEqual({ v: 1, data: { name: 'Ayush' } })
    expect(res.shadow.friends.me!.t).toBe(50)
  })

  it('keeps an unsent change here, skips its own echo, and applies the rest', () => {
    const mine = expense('e1', 1000)
    const theirs = expense('e2', 3000)
    let shadow = recordPushed(emptyShadow(), planPush(emptyShadow(), local({ expenses: [mine, theirs] }), 100).entries)
    const editedHere = { ...mine, total: 1500, shares: { me: 750, f1: 750 } }
    const res = planPull(
      shadow,
      local({ expenses: [editedHere, theirs] }),
      pulled({
        expenses: [
          { ...expense('e1', 9999), updatedAt: 150, rev: 7, deleted: false },
          { ...theirs, updatedAt: 100, rev: 8, deleted: false },
          { ...expense('e3', 400), updatedAt: 160, rev: 9, deleted: false },
        ],
      }),
      'normal',
      parse,
    )
    const totals = Object.fromEntries((res.expenses ?? []).map((e) => [e.id, e.total]))
    expect(totals).toEqual({ e1: 1500, e2: 3000, e3: 400 })
    shadow = res.shadow
    expect(shadow.expenses.e3!.t).toBe(160)
    expect(planPush(shadow, local({ expenses: res.expenses! }), 200).payload.expenses.map((r) => r.id)).toEqual(['e1'])
  })

  it('removes what another phone deleted, unless it was changed here since', () => {
    const shadow = recordPushed(emptyShadow(), planPush(emptyShadow(), local({ groups: [group('g1', 'Goa'), group('g2', 'Flat')] }), 100).entries)
    const res = planPull(
      shadow,
      local({ groups: [group('g1', 'Goa'), { ...group('g2', 'Flat 2') }] }),
      pulled({
        groups: [
          { id: 'g1', updatedAt: 150, deleted: true },
          { id: 'g2', updatedAt: 150, deleted: true },
        ],
      }),
      'normal',
      parse,
    )
    expect(res.groups?.map((g) => g.name)).toEqual(['Flat 2'])
    expect(res.shadow.groups.g1).toBeUndefined()
  })

  it('skips a row the phone can’t read, and stores it doesn’t know', () => {
    const res = planPull(
      emptyShadow(),
      local(),
      pulled({ expenses: [{ id: 'bad', updatedAt: 5 }], stores: [{ key: 'settle.v99.future', data: { v: 1, data: 1 }, updatedAt: 5 }] }),
      'serverWins',
      { ...parse, expense: () => null },
    )
    expect(res.expenses).toBeUndefined()
    expect(res.stores).toEqual({})
  })
})
