import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { dueKey, gentleKey, isChhuttaOption, smallBalance, smallDues, unitsToMinor, yearTotals, type ChhuttaEntry } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha' }
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
/** `payerId` paid `total`; each of `owes` owes the amount given (the payer keeps the rest). */
function expense(total: number, payerId: string, owes: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  const others = Object.values(owes).reduce((a, b) => a + b, 0)
  const shares = { ...owes, [payerId]: total - others }
  return {
    id: `e${n}`,
    kind: 'split',
    title: 'Chai',
    category: 'food',
    currency: 'INR',
    total,
    date: '2026-11-14',
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.entries(shares).map(([friendId, input]) => ({ friendId, input })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const group = (more: Partial<Group> = {}): Group => ({
  id: 'goa',
  name: 'Goa',
  emoji: '🏖️',
  kind: 'trip',
  currency: 'INR',
  memberIds: ['me', 'riya', 'sam'],
  settlements: [],
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  ...more,
})
const paid = (fromId: string, toId: string, amount: number): Settlement => ({ id: `s${++n}`, fromId, toId, amount, date: '2026-11-14', createdAt: n, method: 'other' })

describe('unitsToMinor', () => {
  it('turns whole units into the currency’s minor units', () => {
    expect(unitsToMinor(10, 'INR')).toBe(1000)
    expect(unitsToMinor(10, 'JPY')).toBe(10)
    expect(unitsToMinor(5, 'KWD')).toBe(5000)
  })

  it('knows the limits a group can pick', () => {
    expect([0, 5, 10, 20, 50].every(isChhuttaOption)).toBe(true)
    expect([7, -5, 100, 5.5, '10', null, Number.NaN].some(isChhuttaOption)).toBe(false)
  })
})

describe('smallDues', () => {
  it('offers a payment under the group’s limit, and not one at or over it', () => {
    // Riya owes Sam ₹7; you owe Sam ₹10 exactly.
    const expenses = [expense(1700, 'sam', { riya: 700, me: 1000 })]
    expect(smallDues(group(), expenses, 10, [], nameOf)).toEqual([{ key: dueKey('goa', 'riya', 'sam', 700), fromId: 'riya', toId: 'sam', amount: 700, gentle: false }])
    // ₹20: both are under it now, the smaller first.
    expect(smallDues(group(), expenses, 20, [], nameOf).map((d) => [d.fromId, d.amount])).toEqual([
      ['riya', 700],
      ['me', 1000],
    ])
    // ₹5: neither.
    expect(smallDues(group(), expenses, 5, [], nameOf)).toEqual([])
  })

  it('with no rule: one gentle offer under ₹10, the smallest, until it is put away', () => {
    const expenses = [expense(1200, 'sam', { riya: 700, me: 500 })]
    const offers = smallDues(group(), expenses, null, [], nameOf)
    expect(offers).toEqual([{ key: dueKey('goa', 'me', 'sam', 500), fromId: 'me', toId: 'sam', amount: 500, gentle: true }])
    expect(smallDues(group(), expenses, null, [gentleKey('goa')], nameOf)).toEqual([])
    // Another group's offer being used up changes nothing here.
    expect(smallDues(group(), expenses, null, [gentleKey('other')], nameOf)).toHaveLength(1)
  })

  it('offers nothing when the rule is off, the group is archived, or nobody owes', () => {
    const expenses = [expense(700, 'sam', { riya: 700 })]
    expect(smallDues(group(), expenses, 0, [], nameOf)).toEqual([])
    expect(smallDues(group({ archived: true }), expenses, 50, [], nameOf)).toEqual([])
    expect(smallDues(group(), [], 50, [], nameOf)).toEqual([])
    expect(smallDues(group({ memberIds: ['me'] }), [], 50, [], nameOf)).toEqual([])
  })

  it('a due that was kept stays away, and comes back when the amount changes', () => {
    const expenses = [expense(700, 'sam', { riya: 700 })]
    const kept = [dueKey('goa', 'riya', 'sam', 700)]
    expect(smallDues(group(), expenses, 10, kept, nameOf)).toEqual([])
    const more = [...expenses, expense(100, 'sam', { riya: 100 })]
    expect(smallDues(group(), more, 10, kept, nameOf).map((d) => d.amount)).toEqual([800])
  })

  it('counts payments already made, and what is left to the paisa', () => {
    // Riya owed ₹500.50 and paid ₹495: ₹5.50 is left.
    const expenses = [expense(50_050, 'sam', { riya: 50_050 })]
    const g = group({ settlements: [paid('riya', 'sam', 49_500)] })
    expect(smallDues(g, expenses, 10, [], nameOf).map((d) => d.amount)).toEqual([550])
    // After it is called even (a payment of exactly that), nothing is left and the books balance.
    const even = group({ settlements: [...g.settlements, paid('riya', 'sam', 550)] })
    expect(smallDues(even, expenses, 10, [], nameOf)).toEqual([])
    expect(Object.values(groupBalances(even, expenses)).every((v) => v === 0)).toBe(true)
  })

  it('breaks ties by name, so every phone lists them the same way, and shows at most three', () => {
    const g = group({ memberIds: ['me', 'riya', 'sam', 'neha', 'zed', 'yan'] })
    const expenses = [expense(1500, 'me', { sam: 300, riya: 300, neha: 300, zed: 300, yan: 300 })]
    const offers = smallDues(g, expenses, 5, [], nameOf)
    expect(offers.map((d) => nameOf(d.fromId))).toEqual(['Neha', 'Riya', 'Sam'])
  })

  it('ignores expenses in another currency and other groups', () => {
    const expenses = [expense(700, 'sam', { riya: 700 }, { currency: 'USD' }), expense(700, 'sam', { riya: 700 }, { groupId: 'other' })]
    expect(smallDues(group(), expenses, 50, [], nameOf)).toEqual([])
  })

  it('uses the group’s own currency for the limit', () => {
    const g = group({ currency: 'JPY' })
    const expenses = [expense(7, 'sam', { riya: 7 }, { currency: 'JPY' })]
    expect(smallDues(g, expenses, 10, [], nameOf).map((d) => d.amount)).toEqual([7])
    expect(smallDues(g, [expense(10, 'sam', { riya: 10 }, { currency: 'JPY' })], 10, [], nameOf)).toEqual([])
  })
})

describe('smallBalance', () => {
  it('is the balance when it is under ₹20 either way', () => {
    expect(smallBalance([{ currency: 'INR', amount: 1999 }])).toEqual([{ currency: 'INR', amount: 1999 }])
    expect(smallBalance([{ currency: 'INR', amount: -1200 }])).toEqual([{ currency: 'INR', amount: -1200 }])
  })

  it('is null at ₹20, over it, and when nothing is open', () => {
    expect(smallBalance([{ currency: 'INR', amount: 2000 }])).toBeNull()
    expect(smallBalance([{ currency: 'INR', amount: -2500 }])).toBeNull()
    expect(smallBalance([])).toBeNull()
    expect(smallBalance([{ currency: 'INR', amount: 0 }])).toBeNull()
  })

  it('needs every currency to be small', () => {
    expect(smallBalance([{ currency: 'INR', amount: 500 }, { currency: 'USD', amount: 5000 }])).toBeNull()
    expect(smallBalance([{ currency: 'INR', amount: 500 }, { currency: 'USD', amount: -300 }])).toHaveLength(2)
  })
})

describe('yearTotals', () => {
  const entry = (fromId: string, toId: string, amount: number, date: string, currency = 'INR'): ChhuttaEntry => ({
    id: `c${++n}`,
    groupId: 'goa',
    fromId,
    toId,
    amount,
    currency,
    date,
    at: n,
    settlementId: null,
  })

  it('adds what you let go and what you were let off, this year, in one currency', () => {
    const log = [
      entry('riya', 'me', 700, '2026-03-01'),
      entry('sam', 'me', 2700, '2026-11-14'),
      entry('me', 'sam', 2100, '2026-06-30'),
      // Not yours, last year, another currency: not counted.
      entry('riya', 'sam', 900, '2026-06-30'),
      entry('riya', 'me', 500, '2025-12-31'),
      entry('riya', 'me', 300, '2026-01-01', 'USD'),
    ]
    expect(yearTotals(log, '2026', 'INR', 'me')).toEqual({ letGo: 3400, letOff: 2100, count: 3 })
    expect(yearTotals(log, '2025', 'INR', 'me')).toEqual({ letGo: 500, letOff: 0, count: 1 })
    expect(yearTotals([], '2026', 'INR', 'me')).toEqual({ letGo: 0, letOff: 0, count: 0 })
  })
})
