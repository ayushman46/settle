import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  groupsStore,
  recordSettlement,
  recurringStore,
  resetDataForTests,
  saveExpense,
  saveRecurring,
  setPaidBack,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { friendBalance, netIn, removalBlockers, settleWithFriend, sourcesTitle } from './friendBalance'

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => resetDataForTests())

const balanceOf = (id: string, currency = 'INR') => friendBalance(id, expensesStore.get(), groupsStore.get(), currency)

describe('friendBalance', () => {
  it('is empty when nothing is open', () => {
    expect(balanceOf(riya)).toEqual({ sources: [], totals: [] })
  })

  it('nets unpaid shares outside groups, both ways', () => {
    saveExpense(draft({ title: 'Dinner', total: 90000, date: '2026-10-20', with: [riya, sam] })) // Riya owes me 300
    saveExpense(draft({ title: 'Cab', total: 20000, date: '2026-10-21', payerId: riya, participants: everyone(ME_ID, riya) })) // I owe Riya 100
    saveExpense(draft({ title: 'Movie', total: 40000, payerId: riya, participants: everyone(riya, sam) })) // not mine
    const balance = balanceOf(riya)
    expect(balance.totals).toEqual([{ currency: 'INR', amount: 20000 }])
    expect(balance.sources).toHaveLength(1)
    expect(balance.sources[0]).toMatchObject({ kind: 'splits', currency: 'INR', amount: 20000, count: 2, titles: ['Cab', 'Dinner'] })
  })

  it('leaves out shares already paid back', () => {
    const dinner = saveExpense(draft({ total: 90000, with: [riya, sam] }))
    setPaidBack(dinner.id, riya, true)
    expect(balanceOf(riya).sources).toEqual([])
    expect(netIn(balanceOf(sam), 'INR')).toBe(30000)
  })

  it('takes group money from the simplified payments between us', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    const balance = balanceOf(riya)
    expect(balance.sources).toEqual([expect.objectContaining({ kind: 'group', currency: 'INR', amount: 30000, group: expect.objectContaining({ id: goa.id }) })])
  })

  it('agrees with the overall summary, per friend', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ total: 33300, groupId: goa.id, payerId: sam, participants: everyone(ME_ID, riya, sam) }))
    saveExpense(draft({ total: 12345, payerId: riya, participants: everyone(ME_ID, riya, sam) }))
    saveExpense(draft({ total: 50000, with: [sam] }))
    saveExpense(draft({ total: 7000, currency: 'USD', with: [riya] }))
    const summary = overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR')
    for (const id of [riya, sam]) expect(netIn(balanceOf(id), 'INR')).toBe(summary.byFriend[id] ?? 0)
    expect(balanceOf(riya).totals).toEqual([
      { currency: 'INR', amount: summary.byFriend[riya] },
      { currency: 'USD', amount: 3500 },
    ])
  })

  it('puts the asked-for currency first', () => {
    saveExpense(draft({ total: 7000, currency: 'USD', with: [riya] }))
    saveExpense(draft({ total: 1000, currency: 'EUR', with: [riya] }))
    saveExpense(draft({ total: 2000, with: [riya] }))
    expect(balanceOf(riya, 'USD').totals.map((t) => t.currency)).toEqual(['USD', 'EUR', 'INR'])
  })

  it('never lists the owner against themselves', () => {
    saveExpense(draft({ total: 2000, with: [riya] }))
    expect(balanceOf(ME_ID)).toEqual({ sources: [], totals: [] })
  })
})

describe('settleWithFriend', () => {
  it('ticks off splits and records group payments, with an undo', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    saveExpense(draft({ total: 90000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya, sam) }))
    const dinner = saveExpense(draft({ total: 40000, with: [riya] }))
    const cab = saveExpense(draft({ total: 10000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const before = balanceOf(riya)
    expect(before.totals).toEqual([{ currency: 'INR', amount: -15000 }])

    const undo = settleWithFriend(riya, before.sources, { method: 'upi', date: '2026-10-22' })
    expect(balanceOf(riya)).toEqual({ sources: [], totals: [] })
    const expenses = expensesStore.get()
    expect(expenses.find((e) => e.id === dinner.id)?.paidBack[riya]).toBeTypeOf('number')
    expect(expenses.find((e) => e.id === cab.id)?.paidBack[ME_ID]).toBeTypeOf('number')
    expect(groupsStore.get()[0]?.settlements).toEqual([
      expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 30000, method: 'upi', date: '2026-10-22' }),
    ])

    undo()
    expect(balanceOf(riya).totals).toEqual([{ currency: 'INR', amount: -15000 }])
    expect(groupsStore.get()[0]?.settlements).toEqual([])
  })

  it('records a payment to me when they owed', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 50000, groupId: goa.id, with: [riya] }))
    settleWithFriend(riya, balanceOf(riya).sources, { method: 'cash', date: '2026-10-22' })
    expect(groupsStore.get()[0]?.settlements[0]).toMatchObject({ fromId: riya, toId: ME_ID, amount: 25000, method: 'cash' })
  })

  it('skips what disappeared in the meantime', () => {
    const dinner = saveExpense(draft({ total: 40000, with: [riya] }))
    const sources = balanceOf(riya).sources
    expensesStore.set(expensesStore.get().filter((e) => e.id !== dinner.id))
    expect(() => settleWithFriend(riya, sources, { method: 'upi', date: '2026-10-22' })()).not.toThrow()
  })
})

describe('sourcesTitle', () => {
  it('names the one place the money is from, else says "our splits"', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ total: 50000, groupId: goa.id, with: [riya] }))
    expect(sourcesTitle(balanceOf(riya).sources)).toBe('Goa')
    saveExpense(draft({ title: 'Movie night', total: 10000, with: [sam] }))
    expect(sourcesTitle(balanceOf(sam).sources)).toBe('Movie night')
    saveExpense(draft({ title: 'Dinner', total: 10000, with: [riya] }))
    expect(sourcesTitle(balanceOf(riya).sources)).toBe('our splits')
  })
})

describe('removalBlockers', () => {
  it('names the groups, splits and recurring splits keeping someone in', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    // Riya and Sam only owe each other here — still a reason to keep Riya.
    saveExpense(draft({ total: 20000, groupId: goa.id, payerId: sam, participants: everyone(riya, sam) }))
    saveExpense(draft({ total: 20000, payerId: riya, participants: everyone(riya, sam) }))
    saveRecurring({
      title: 'Rent',
      category: 'rent',
      currency: 'INR',
      total: 3000000,
      payerId: ME_ID,
      mode: 'equal',
      participants: everyone(ME_ID, riya),
      dayOfMonth: 5,
      groupId: null,
      active: true,
    })
    const blockers = removalBlockers(riya, expensesStore.get(), groupsStore.get(), recurringStore.get())
    expect(blockers.groups.map((g) => g.name)).toEqual(['Goa'])
    expect(blockers.splits).toBe(1)
    expect(blockers.recurring.map((r) => r.title)).toEqual(['Rent'])

    recordSettlement(goa.id, { fromId: riya, toId: sam, amount: 10000, date: '2026-10-22', method: 'cash' })
    expect(removalBlockers(riya, expensesStore.get(), groupsStore.get(), []).groups).toEqual([])
  })
})
