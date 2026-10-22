import { beforeEach, describe, expect, it } from 'vitest'
import {
  addFriend,
  createGroup,
  expensesStore,
  groupsStore,
  recordSettlement,
  resetDataForTests,
  saveExpense,
  setPaidBack,
  updateProfile,
} from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Expense, type Friend, type Group } from '../../domain/types'
import {
  ACTIVITY_FILTERS,
  activityState,
  activityStates,
  filterCounts,
  fold,
  groupByMonth,
  groupStandings,
  isActivityFilter,
  matchesFilter,
  matchesQuery,
  monthLabel,
  openGroupIds,
  resultsLine,
  type SearchContext,
} from './activityView'

let riya: Friend
let sam: Friend

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' })
  sam = addFriend({ name: 'Sam' })
})

function state(e: Expense) {
  const groups = groupsStore.get()
  return activityState(e, groups, openGroupIds(groups, expensesStore.get()))
}

function ctx(): SearchContext {
  const friendsById = Object.fromEntries([riya, sam].map((f) => [f.id, f]))
  const groupsById: Record<string, Group> = Object.fromEntries(groupsStore.get().map((g) => [g.id, g]))
  return { friendsById, groupsById }
}

function bill(): Expense {
  return saveExpense({
    ...draft({ with: [riya.id] }),
    kind: 'bill',
    mode: 'items',
    title: 'Toit',
    total: 150000,
    bill: {
      meta: { merchant: 'Toit', date: null, subtotal: 150000, tax: null, serviceCharge: null, discount: null, tip: null, total: 150000 },
      items: [
        { id: 'i1', name: 'Pizza', quantity: 1, amount: 100000 },
        { id: 'i2', name: 'Beer', quantity: 1, amount: 50000 },
      ],
      assignments: { i1: { [ME_ID]: 1, [riya.id]: 1 }, i2: { [riya.id]: 1 } },
      warnings: [],
    },
  })
}

describe('filters', () => {
  it('lists the six filters in order and recognises them', () => {
    expect(ACTIVITY_FILTERS.map((f) => f.label)).toEqual(['All', 'To collect', 'To pay', 'Bills', 'Groups', 'Settled'])
    expect(isActivityFilter('collect')).toBe(true)
    expect(isActivityFilter('owed')).toBe(false)
    expect(isActivityFilter(null)).toBe(false)
  })
})

describe('activityState', () => {
  it('is "collect" while someone still owes me, "settled" once all have paid', () => {
    const e = saveExpense(draft({ with: [riya.id, sam.id] }))
    expect(state(e)).toBe('collect')
    setPaidBack(e.id, riya.id, true)
    expect(state(expensesStore.get()[0]!)).toBe('collect')
    const done = setPaidBack(e.id, sam.id, true)
    expect(state(done)).toBe('settled')
  })

  it('is "pay" while I owe the payer, "settled" once I have paid them back', () => {
    const e = saveExpense(draft({ payerId: riya.id, with: [riya.id] }))
    expect(state(e)).toBe('pay')
    expect(state(setPaidBack(e.id, ME_ID, true))).toBe('settled')
  })

  it('is "personal" when nobody but the payer has a share', () => {
    expect(state(saveExpense(draft()))).toBe('personal')
    expect(state(saveExpense(draft({ payerId: riya.id, participants: [{ friendId: riya.id, input: null }] })))).toBe('personal')
  })

  it('follows other people between themselves when I am not in it', () => {
    const e = saveExpense(draft({ payerId: riya.id, participants: [riya.id, sam.id].map((friendId) => ({ friendId, input: null })) }))
    expect(state(e)).toBe('open')
    expect(state(setPaidBack(e.id, sam.id, true))).toBe('settled')
  })

  it('follows the group for group expenses: open until the group is square', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    const e = saveExpense(draft({ groupId: goa.id, with: [riya.id] }))
    expect(state(e)).toBe('open')
    recordSettlement(goa.id, { fromId: riya.id, toId: ME_ID, amount: 50000, date: '2026-10-21', method: 'upi' })
    expect(state(e)).toBe('settled')
  })

  it('settles a group expense in another currency person to person', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    const e = saveExpense(draft({ groupId: goa.id, currency: 'USD', with: [riya.id] }))
    expect(state(e)).toBe('collect')
  })

  it('works out every state at once', () => {
    const a = saveExpense(draft({ with: [riya.id] }))
    const b = saveExpense(draft({ payerId: sam.id, with: [sam.id] }))
    const states = activityStates(expensesStore.get(), groupsStore.get())
    expect(states.get(a.id)).toBe('collect')
    expect(states.get(b.id)).toBe('pay')
  })
})

describe('matchesFilter and filterCounts', () => {
  it('counts each filter', () => {
    saveExpense(draft({ with: [riya.id] }))
    saveExpense(draft({ payerId: sam.id, with: [sam.id] }))
    const paid = saveExpense(draft({ with: [sam.id] }))
    setPaidBack(paid.id, sam.id, true)
    bill()
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    saveExpense(draft({ groupId: goa.id, with: [riya.id] }))

    const expenses = expensesStore.get()
    const states = activityStates(expenses, groupsStore.get())
    expect(filterCounts(expenses, states)).toEqual({ all: 5, collect: 2, pay: 1, bills: 1, groups: 1, settled: 1 })
  })

  it('puts bills under Bills and group expenses under Groups whatever their state', () => {
    const b = bill()
    expect(matchesFilter(b, 'bills', 'settled')).toBe(true)
    expect(matchesFilter(b, 'groups', 'settled')).toBe(false)
    expect(matchesFilter({ ...b, groupId: 'g1' }, 'groups', 'open')).toBe(true)
    expect(matchesFilter(b, 'all', undefined)).toBe(true)
  })
})

describe('groupStandings', () => {
  it('lists groups where I am owed or owe, biggest first', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    const flat = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, sam.id] })
    const pub = createGroup({ name: 'Pub', emoji: '🍺', kind: 'event', currency: 'INR', memberIds: [ME_ID, riya.id] })
    saveExpense(draft({ groupId: goa.id, total: 100000, with: [riya.id] }))
    saveExpense(draft({ groupId: pub.id, total: 300000, with: [riya.id] }))
    saveExpense(draft({ groupId: flat.id, payerId: sam.id, total: 40000, with: [sam.id] }))

    const expenses = expensesStore.get()
    const groups = groupsStore.get()
    expect(groupStandings(groups, expenses, 'collect').map((s) => [s.group.name, s.balance])).toEqual([
      ['Pub', 150000],
      ['Goa', 50000],
    ])
    expect(groupStandings(groups, expenses, 'pay').map((s) => [s.group.name, s.balance])).toEqual([['Flat', -20000]])
  })
})

describe('search', () => {
  it('folds case, accents and spaces', () => {
    expect(fold('  Café   DÉJÀ vu ')).toBe('cafe deja vu')
  })

  it('finds by title, note, category, group and people — every word must match', () => {
    const goa = createGroup({ name: 'Goa 2026', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    const e = saveExpense(draft({ title: 'Fish thali', note: 'At Britto’s', groupId: goa.id, with: [riya.id] }))
    const c = ctx()
    for (const q of ['fish', 'THALI', 'britto', 'food', 'goa', 'riya', 'riya fish', '']) expect(matchesQuery(e, q, c)).toBe(true)
    for (const q of ['sam', 'riya pizza', 'rent']) expect(matchesQuery(e, q, c)).toBe(false)
  })

  it('finds the payer by name', () => {
    const e = saveExpense(draft({ title: 'Cab', payerId: sam.id, with: [sam.id] }))
    expect(matchesQuery(e, 'sam', ctx())).toBe(true)
  })

  it('finds amounts as typed: the total or my share, from the start', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240000, with: [riya.id] }))
    const c = ctx()
    expect(matchesQuery(e, '2400', c)).toBe(true)
    expect(matchesQuery(e, '2,400', c)).toBe(true)
    expect(matchesQuery(e, '2400.00', c)).toBe(true)
    expect(matchesQuery(e, '1200', c)).toBe(true) // my share
    expect(matchesQuery(e, '400', c)).toBe(false)
    expect(matchesQuery(e, 'dinner 24', c)).toBe(true)
  })
})

describe('months', () => {
  it('names months, with the year only when it is not this year', () => {
    expect(monthLabel('2026-10', '2026-10-22')).toBe('October')
    expect(monthLabel('2025-12', '2026-10-22')).toBe('December 2025')
    expect(monthLabel('nope', '2026-10-22')).toBe('nope')
  })

  it('splits a newest-first list into month sections in order', () => {
    saveExpense(draft({ title: 'A', date: '2026-10-20' }))
    saveExpense(draft({ title: 'B', date: '2026-10-02' }))
    saveExpense(draft({ title: 'C', date: '2026-09-30' }))
    saveExpense(draft({ title: 'D', date: '2025-10-01' }))
    const sorted = [...expensesStore.get()].sort((a, b) => (a.date < b.date ? 1 : -1))
    const sections = groupByMonth(sorted, '2026-10-22')
    expect(sections.map((s) => [s.label, s.expenses.map((e) => e.title)])).toEqual([
      ['October', ['A', 'B']],
      ['September', ['C']],
      ['October 2025', ['D']],
    ])
  })
})

describe('resultsLine', () => {
  const base = { query: '', groups: [] as Group[], currency: 'INR' }

  it('sums what is left to collect, profile currency first', () => {
    saveExpense(draft({ total: 100000, with: [riya.id] }))
    saveExpense(draft({ total: 300000, with: [sam.id] }))
    saveExpense(draft({ total: 5000, currency: 'USD', with: [sam.id] }))
    const matches = expensesStore.get()
    expect(resultsLine({ ...base, filter: 'collect', matches })).toBe('₹2,000 + $25 to collect on 3 splits')
  })

  it('says what I owe', () => {
    saveExpense(draft({ payerId: riya.id, total: 108000, with: [riya.id] }))
    expect(resultsLine({ ...base, filter: 'pay', matches: expensesStore.get() })).toBe('You owe ₹540 on 1 split')
  })

  it('counts the other filters and search results', () => {
    const e = saveExpense(draft())
    expect(resultsLine({ ...base, filter: 'all', matches: [e] })).toBe('1 expense')
    expect(resultsLine({ ...base, filter: 'bills', matches: [e, e] })).toBe('2 bills')
    expect(resultsLine({ ...base, filter: 'groups', matches: [e] })).toBe('1 group expense')
    expect(resultsLine({ ...base, filter: 'settled', matches: [e, e] })).toBe('2 expenses settled')
    expect(resultsLine({ ...base, filter: 'all', query: ' cab ', matches: [e] })).toBe('1 match for “cab”')
    expect(resultsLine({ ...base, filter: 'all', query: 'cab', matches: [] })).toBe('No matches for “cab”')
  })

  it('says plainly when a filter is empty', () => {
    expect(resultsLine({ ...base, filter: 'collect', matches: [] })).toBe('Nothing to collect')
    expect(resultsLine({ ...base, filter: 'settled', matches: [] })).toBe('Nothing settled yet')
  })
})
