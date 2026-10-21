import { beforeEach, describe, expect, it } from 'vitest'
import { ME_ID } from '../domain/types'
import { groupBalances } from '../engine/balances'
import { DataError } from './errors'
import { saveExpense } from './expenses'
import { addFriend } from './friends'
import {
  createGroup,
  deleteGroup,
  deleteSettlement,
  recordSettlement,
  restoreGroup,
  setGroupArchived,
  updateGroup,
} from './groups'
import { updateProfile } from './profile'
import { saveRecurring } from './recurring'
import { expensesStore, groupsStore, recurringStore } from './stores'
import { draft, everyone } from './testKit'
import { resetDataForTests } from './testing'

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

const goa = () => createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya, sam] })
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)

describe('createGroup', () => {
  it('creates a group with ME first and tidy fields', () => {
    const g = createGroup({ name: '  Flat   302 ', emoji: '🏠🔑', kind: 'home', currency: 'INR', memberIds: [riya, ME_ID, riya, ''] })
    expect(g).toMatchObject({ name: 'Flat 302', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya], settlements: [], archived: false })
    expect(groupsStore.get()[0]).toEqual(g)
  })

  it('fills sensible defaults for missing details', () => {
    updateProfile({ currency: 'EUR' })
    const g = createGroup({ name: ' ', emoji: '', kind: 'party' as never, currency: '???', memberIds: [] })
    expect(g).toMatchObject({ name: 'New group', emoji: '👥', kind: 'other', currency: 'EUR', memberIds: [ME_ID] })
  })
})

describe('updateGroup', () => {
  it('renames, re-emojis and changes kind', () => {
    const g = goa()
    expect(updateGroup(g.id, { name: 'Goa 2026', emoji: '🌴', kind: 'event' })).toMatchObject({ name: 'Goa 2026', emoji: '🌴', kind: 'event' })
    expect(updateGroup(g.id, { name: '' }).name).toBe('Goa 2026')
    expect(() => updateGroup('missing', { name: 'x' })).toThrow(DataError)
  })

  it('keeps members who still owe or are owed', () => {
    const g = goa()
    saveExpense(draft({ groupId: g.id, with: [riya] }))
    const next = updateGroup(g.id, { memberIds: [sam] })
    expect(next.memberIds).toEqual([ME_ID, sam, riya])
  })

  it('relabels expenses and payments when the currency was picked wrong', () => {
    const g = goa()
    const e = saveExpense(draft({ groupId: g.id, with: [riya, sam], total: 90000 }))
    recordSettlement(g.id, { fromId: riya, toId: ME_ID, amount: 10000, date: '2026-10-21', method: 'cash' })
    const usd = updateGroup(g.id, { currency: 'USD' })
    const relabelled = expensesStore.get().find((x) => x.id === e.id)
    expect(relabelled).toMatchObject({ currency: 'USD', total: 90000, shares: e.shares })
    expect(usd.settlements[0]?.amount).toBe(10000)
    expect(sum(groupBalances(usd, expensesStore.get()))).toBe(0)
  })

  it('rescales exactly into a currency with different minor units', () => {
    const g = goa()
    saveExpense(draft({ groupId: g.id, with: [riya, sam], total: 100001 }))
    saveExpense(draft({ groupId: g.id, mode: 'exact', participants: [{ friendId: ME_ID, input: 30050 }, { friendId: riya, input: 69950 }], total: 100000 }))
    const yen = updateGroup(g.id, { currency: 'JPY' })
    for (const e of expensesStore.get()) {
      expect(e.currency).toBe('JPY')
      expect(sum(e.shares)).toBe(e.total)
      if (e.mode === 'exact') expect(e.participants.reduce((a, p) => a + (p.input ?? 0), 0)).toBe(e.total)
    }
    expect(expensesStore.get().map((e) => e.total).sort()).toEqual([1000, 1000])
    expect(sum(groupBalances(yen, expensesStore.get()))).toBe(0)
  })
})

describe('archive, delete & restore', () => {
  it('archives and unarchives', () => {
    const g = goa()
    const archived = setGroupArchived(g.id, true)
    expect(archived.archived).toBe(true)
    expect(setGroupArchived(g.id, true)).toBe(archived)
    expect(setGroupArchived(g.id, false).archived).toBe(false)
  })

  it('deletes a group with its expenses and undoes it completely', () => {
    const g = goa()
    const inGroup = saveExpense(draft({ groupId: g.id, with: [riya] }))
    const outside = saveExpense(draft({ with: [sam] }))
    const rent = saveRecurring({ title: 'Rent', category: 'rent', currency: 'INR', total: 100000, payerId: ME_ID, mode: 'equal', participants: everyone(ME_ID, riya), dayOfMonth: 1, groupId: g.id, active: true })
    const snapshot = deleteGroup(g.id)
    expect(snapshot.group).toMatchObject({ id: g.id, name: g.name })
    expect(snapshot.expenses).toEqual([inGroup])
    expect(snapshot.recurringIds).toEqual([rent.id])
    expect(groupsStore.get()).toEqual([])
    expect(expensesStore.get().map((e) => e.id)).toEqual([outside.id])
    expect(recurringStore.get()[0]?.groupId).toBeNull()
    restoreGroup(snapshot)
    expect(groupsStore.get().map((x) => x.id)).toEqual([g.id])
    expect(expensesStore.get().map((e) => e.id).sort()).toEqual([inGroup.id, outside.id].sort())
    expect(recurringStore.get()[0]?.groupId).toBe(g.id)
    expect(() => deleteGroup('missing')).toThrow(DataError)
  })
})

describe('settlements', () => {
  it('records a payment that moves the balances', () => {
    const g = goa()
    saveExpense(draft({ groupId: g.id, with: [riya], total: 100000 }))
    const s = recordSettlement(g.id, { fromId: riya, toId: ME_ID, amount: 20000, date: 'bad', method: 'gpay' as never })
    expect(s).toMatchObject({ fromId: riya, toId: ME_ID, amount: 20000, method: 'other' })
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const group = groupsStore.get().find((x) => x.id === g.id)
    expect(group && groupBalances(group, expensesStore.get())).toEqual({ [ME_ID]: 30000, [riya]: -30000, [sam]: 0 })
  })

  it('rejects nonsense payments', () => {
    const g = goa()
    const base = { fromId: riya, toId: ME_ID, amount: 100, date: '2026-10-21', method: 'upi' as const }
    expect(() => recordSettlement(g.id, { ...base, toId: riya })).toThrow(expect.objectContaining({ code: 'invalid' }))
    expect(() => recordSettlement(g.id, { ...base, amount: 0 })).toThrow(DataError)
    expect(() => recordSettlement(g.id, { ...base, amount: 1.5 })).toThrow(DataError)
    expect(() => recordSettlement('missing', base)).toThrow(expect.objectContaining({ code: 'not_found' }))
  })

  it('deletes a payment', () => {
    const g = goa()
    const s = recordSettlement(g.id, { fromId: riya, toId: ME_ID, amount: 100, date: '2026-10-21', method: 'upi' })
    deleteSettlement(g.id, 'nope')
    deleteSettlement('nope', s.id)
    expect(groupsStore.get()[0]?.settlements).toHaveLength(1)
    deleteSettlement(g.id, s.id)
    expect(groupsStore.get()[0]?.settlements).toEqual([])
  })
})
