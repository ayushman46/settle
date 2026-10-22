import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, recordSettlement, resetDataForTests, saveExpense, expensesStore, groupsStore } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import {
  acrossGroups,
  GROUP_KIND_ORDER,
  groupStanding,
  groupSummaryText,
  groupTimeline,
  groupTotals,
  kindMeta,
  membersLabel,
  paymentSentence,
  standingLabel,
} from './groupView'

let riya: string
let sam: string
let goa: Group

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => resetDataForTests())

const group = () => groupsStore.get().find((g) => g.id === goa.id)!

describe('kinds and labels', () => {
  it('has a label, emoji, example and tint for every kind', () => {
    expect(GROUP_KIND_ORDER).toEqual(['trip', 'home', 'couple', 'event', 'other'])
    for (const kind of GROUP_KIND_ORDER) {
      expect(kindMeta(kind)).toMatchObject({ kind, label: expect.any(String), emoji: expect.any(String), placeholder: expect.any(String) })
    }
    expect(kindMeta('home').label).toBe('Home')
  })

  it('counts members with you included', () => {
    expect(membersLabel(1)).toBe('Just you')
    expect(membersLabel(2)).toBe('2 people')
  })

  it('words a balance from my side', () => {
    expect(standingLabel(54000, 'INR', true)).toEqual({ caption: 'you’re owed', tone: 'positive', amount: 54000, spoken: 'you’re owed ₹540' })
    expect(standingLabel(-20050, 'INR', true)).toMatchObject({ caption: 'you owe', tone: 'negative', amount: 20050, spoken: 'you owe ₹200.50' })
    expect(standingLabel(0, 'INR', true)).toMatchObject({ caption: 'settled up', amount: null })
    expect(standingLabel(0, 'INR', false)).toMatchObject({ caption: 'no expenses yet', tone: 'muted' })
  })

  it('says who paid whom from the owner’s side', () => {
    expect(paymentSentence(riya, ME_ID, 'Riya', 'You')).toBe('Riya paid you')
    expect(paymentSentence(ME_ID, riya, 'You', 'Riya')).toBe('You paid Riya')
    expect(paymentSentence(sam, riya, 'Sam', 'Riya')).toBe('Sam paid Riya')
    expect(paymentSentence(sam, riya, 'Sam', 'Riya', 'present')).toBe('Sam pays Riya')
    expect(paymentSentence(ME_ID, riya, 'You', 'Riya', 'present')).toBe('You pay Riya')
  })
})

describe('groupStanding', () => {
  it('starts settled with nothing spent', () => {
    expect(groupStanding(group(), [])).toEqual({ mine: 0, spent: 0, expenseCount: 0, settled: true, transfers: [] })
  })

  it('knows my balance, the spend and the payments that square up', () => {
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ total: 30000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya, sam) }))
    // Another currency in the same group is settled person to person, so it isn't counted.
    saveExpense(draft({ total: 5000, currency: 'USD', groupId: goa.id, with: [riya] }))
    const standing = groupStanding(group(), expensesStore.get())
    expect(standing.mine).toBe(50000)
    expect(standing.spent).toBe(120000)
    expect(standing.expenseCount).toBe(2)
    expect(standing.settled).toBe(false)
    expect(standing.transfers).toEqual([
      { fromId: sam, toId: ME_ID, amount: 40000 },
      { fromId: riya, toId: ME_ID, amount: 10000 },
    ])
  })

  it('counts a recorded payment', () => {
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    recordSettlement(goa.id, { fromId: riya, toId: ME_ID, amount: 30000, date: '2026-10-21', method: 'upi' })
    recordSettlement(goa.id, { fromId: sam, toId: ME_ID, amount: 30000, date: '2026-10-21', method: 'cash' })
    expect(groupStanding(group(), expensesStore.get())).toMatchObject({ mine: 0, settled: true, transfers: [] })
  })

  it('adds up across groups per currency', () => {
    const flat = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const nyc = createGroup({ name: 'NYC', emoji: '🗽', kind: 'trip', currency: 'USD', memberIds: [ME_ID, sam] })
    saveExpense(draft({ total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ total: 20000, groupId: flat.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ total: 4000, currency: 'USD', groupId: nyc.id, payerId: sam, participants: everyone(ME_ID, sam) }))
    const list = groupsStore.get().map((g) => ({ group: g, standing: groupStanding(g, expensesStore.get()) }))
    expect(acrossGroups(list)).toEqual({ INR: { owedToMe: 60000, iOwe: 10000 }, USD: { owedToMe: 0, iOwe: 2000 } })
  })
})

describe('groupTotals', () => {
  it('breaks the spend down by category and by person', () => {
    saveExpense(draft({ title: 'Villa', category: 'travel', total: 90000, groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ title: 'Lunch', category: 'food', total: 30000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya, sam) }))
    saveExpense(draft({ title: 'Dinner', category: 'food', total: 15000, groupId: goa.id, payerId: sam, participants: everyone(riya, sam) }))
    saveExpense(draft({ title: 'Cab', currency: 'USD', total: 2000, groupId: goa.id, with: [riya] }))
    const totals = groupTotals(group(), expensesStore.get())
    expect(totals).toMatchObject({ currency: 'INR', spent: 135000, count: 3, elsewhere: 1 })
    expect(totals.byCategory).toEqual([
      { category: 'travel', amount: 90000, count: 1 },
      { category: 'food', amount: 45000, count: 2 },
    ])
    expect(totals.people).toEqual([
      { friendId: riya, paid: 30000, share: 47500 },
      { friendId: sam, paid: 15000, share: 47500 },
      { friendId: ME_ID, paid: 90000, share: 40000 },
    ])
  })

  it('lists every member, even with nothing yet', () => {
    expect(groupTotals(group(), []).people.map((p) => p.friendId)).toEqual([ME_ID, riya, sam])
  })
})

describe('groupTimeline', () => {
  it('mixes expenses and payments by day, newest first', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 21, 9))
    const lunch = saveExpense(draft({ title: 'Lunch', date: '2026-10-20', groupId: goa.id, with: [riya] }))
    const villa = saveExpense(draft({ title: 'Villa', date: '2026-10-21', groupId: goa.id, with: [riya, sam] }))
    saveExpense(draft({ title: 'Elsewhere', date: '2026-10-21', with: [riya] }))
    vi.setSystemTime(new Date(2026, 9, 21, 10))
    const paid = recordSettlement(goa.id, { fromId: riya, toId: ME_ID, amount: 10000, date: '2026-10-21', method: 'upi' })
    vi.useRealTimers()
    const days = groupTimeline(group(), expensesStore.get())
    expect(days.map((d) => d.date)).toEqual(['2026-10-21', '2026-10-20'])
    expect(days[0]?.entries.map((e) => e.id)).toEqual([paid.id, villa.id])
    expect(days[1]?.entries.map((e) => e.id)).toEqual([lunch.id])
  })
})

describe('groupSummaryText', () => {
  it('lists who pays whom for the group chat', () => {
    const text = groupSummaryText({
      name: 'Goa',
      emoji: '🏖️',
      kind: 'trip',
      currency: 'INR',
      total: 4800000,
      expenseCount: 14,
      memberCount: 6,
      transfers: [{ from: { name: 'Sam', color: 1 }, to: { name: 'Riya', color: 2 }, amount: 80000 }],
    })
    expect(text).toBe(['🏖️ Goa', '₹48,000 spent · 14 expenses · 6 people', '', 'To settle up:', 'Sam pays Riya ₹800', '', '— split with Settle'].join('\n'))
  })

  it('says when everyone is square, or nothing has happened yet', () => {
    const base = { name: 'Us', emoji: '💑', kind: 'couple' as const, currency: 'INR', total: 0, expenseCount: 0, memberCount: 1, transfers: [] }
    expect(groupSummaryText(base)).toContain('₹0 spent · 0 expenses · 1 person\n\nNothing to settle yet.')
    expect(groupSummaryText({ ...base, total: 1000, expenseCount: 1, memberCount: 2 })).toContain('Everyone’s settled up ✓')
  })
})
