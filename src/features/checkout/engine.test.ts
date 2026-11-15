import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances, simplifyDebts, type Transfer } from '../../engine/balances'
import { checkoutProgress, MAX_CHECKOUT_ROWS, reconcile, tripFacts, type CheckoutRow } from './engine'
import { allSquareText, tripDates } from './text'

let n = 0
function expense(total: number, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id: `e${n}`,
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total,
    date: '2026-11-12',
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
const paid = (id: string, fromId: string, toId: string, amount: number): Settlement => ({ id, fromId, toId, amount, date: '2026-11-15', createdAt: ++n, method: 'upi' })
const group = (settlements: Settlement[] = [], memberIds = ['a', 'b', 'c', 'd', 'e']): Group => ({
  id: 'goa',
  name: 'Goa 2026',
  emoji: '🏖️',
  kind: 'trip',
  currency: 'INR',
  memberIds,
  settlements,
  createdAt: 1,
  updatedAt: 1,
  archived: false,
})
const open = (fromId: string, toId: string, amount: number): CheckoutRow => ({ fromId, toId, amount, settlementId: null })
const ids = (g: Group): Set<string> => new Set(g.settlements.map((s) => s.id))

/** A owes 7, B owes 6; C is owed 5, D 4, E 4 (in hundreds of paise). */
const TRIP = [expense(500, 'c', { a: 500 }), expense(400, 'd', { a: 200, b: 200 }), expense(400, 'e', { b: 400 })]

describe('the checklist against the group', () => {
  it('starts from the app’s own fewest payments', () => {
    const g = group()
    expect(groupBalances(g, TRIP)).toEqual({ a: -700, b: -600, c: 500, d: 400, e: 400 })
    const first = reconcile([], groupBalances(g, TRIP), ids(g))
    expect(first).toEqual({
      rows: [open('a', 'c', 500), open('b', 'd', 400), open('a', 'e', 200), open('b', 'e', 200)],
      changed: true,
      revised: false,
      fresh: false,
    })
    expect(first.rows.map(({ settlementId: _s, ...t }) => t)).toEqual(simplifyDebts(groupBalances(g, TRIP)))
  })

  it('uses the order it is given for freshly worked-out payments', () => {
    const g = group()
    const byAmountUp = (list: Transfer[]) => [...list].sort((x, y) => x.amount - y.amount || (x.fromId < y.fromId ? -1 : 1))
    expect(reconcile([], groupBalances(g, TRIP), ids(g), byAmountUp).rows.map((r) => `${r.fromId}>${r.toId}`)).toEqual(['a>e', 'b>e', 'b>d', 'a>c'])
  })

  it('nothing owed: nothing to list, nothing to save', () => {
    const g = group()
    expect(reconcile([], groupBalances(g, []), ids(g))).toEqual({ rows: [], changed: false, revised: false, fresh: false })
  })

  it('stays put while it is ticked, even where the app’s own list would reshuffle', () => {
    const rows = reconcile([], groupBalances(group(), TRIP), new Set()).rows
    // A pays E ₹2 first. Worked out afresh, the fewest payments would now be B→C, A→D, A→E, B→E: a different list.
    const g = group([paid('s1', 'a', 'e', 200)])
    expect(simplifyDebts(groupBalances(g, TRIP))[0]).toEqual({ fromId: 'b', toId: 'c', amount: 500 })
    const ticked = rows.map((r, i) => (i === 2 ? { ...r, settlementId: 's1' } : r))
    const after = reconcile(ticked, groupBalances(g, TRIP), ids(g))
    expect(after).toEqual({ rows: ticked, changed: false, revised: false, fresh: false })
  })

  it('ticking every line in any order ends with everyone exactly square', () => {
    const start = reconcile([], groupBalances(group(), TRIP), new Set()).rows
    for (const order of [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1]]) {
      let rows = start
      const settlements: Settlement[] = []
      for (const index of order) {
        const row = rows[index]!
        settlements.push(paid(`s${index}`, row.fromId, row.toId, row.amount))
        rows = rows.map((r, i) => (i === index ? { ...r, settlementId: `s${index}` } : r))
        const g = group([...settlements])
        const step = reconcile(rows, groupBalances(g, TRIP), ids(g))
        expect(step.changed).toBe(false)
        rows = step.rows
      }
      const done = group(settlements)
      expect(Object.values(groupBalances(done, TRIP)).every((v) => v === 0)).toBe(true)
      expect(checkoutProgress(rows)).toEqual({ total: 4, paid: 4, open: 0 })
    }
  })

  it('a tick whose payment was removed elsewhere is open again, and the list still stands', () => {
    const rows = reconcile([], groupBalances(group(), TRIP), new Set()).rows.map((r, i) => (i === 0 ? { ...r, settlementId: 'gone' } : r))
    const g = group()
    const after = reconcile(rows, groupBalances(g, TRIP), ids(g))
    expect(after.changed).toBe(true)
    expect(after.revised).toBe(false)
    expect(after.rows).toEqual([open('a', 'c', 500), open('b', 'd', 400), open('a', 'e', 200), open('b', 'e', 200)])
  })

  it('a new expense under an unfinished checklist: ticked lines are kept, open ones worked out again', () => {
    const start = reconcile([], groupBalances(group(), TRIP), new Set()).rows
    const ticked = start.map((r, i) => (i === 0 ? { ...r, settlementId: 's1' } : r))
    const g = group([paid('s1', 'a', 'c', 500)])
    // Chai on the way out: D paid ₹1 for A.
    const expenses = [...TRIP, expense(100, 'd', { a: 100 })]
    const after = reconcile(ticked, groupBalances(g, expenses), ids(g))
    expect(after.changed).toBe(true)
    expect(after.revised).toBe(true)
    expect(after.fresh).toBe(false)
    expect(after.rows[0]).toEqual({ fromId: 'a', toId: 'c', amount: 500, settlementId: 's1' })
    const rest = after.rows.slice(1)
    expect(rest.every((r) => r.settlementId === null)).toBe(true)
    expect(rest.map(({ settlementId: _s, ...t }) => t)).toEqual(simplifyDebts(groupBalances(g, expenses)))
    // Paying what is listed squares everyone, to the paisa.
    const settled = group([...g.settlements, ...rest.map((r, i) => paid(`n${i}`, r.fromId, r.toId, r.amount))])
    expect(Object.values(groupBalances(settled, expenses)).every((v) => v === 0)).toBe(true)
  })

  it('a part payment recorded on another screen changes the open line to what is really left', () => {
    const g0 = group([], ['a', 'b'])
    const expenses = [expense(1_000, 'b', { a: 501, b: 499 })]
    const start = reconcile([], groupBalances(g0, expenses), new Set()).rows
    expect(start).toEqual([open('a', 'b', 501)])
    const g = group([paid('part', 'a', 'b', 200)], ['a', 'b'])
    const after = reconcile(start, groupBalances(g, expenses), ids(g))
    expect(after).toEqual({ rows: [open('a', 'b', 301)], changed: true, revised: true, fresh: false })
  })

  it('a payment recorded elsewhere that squares everyone leaves nothing open', () => {
    const g0 = group([], ['a', 'b'])
    const expenses = [expense(1_000, 'b', { a: 500, b: 500 })]
    const start = reconcile([], groupBalances(g0, expenses), new Set()).rows
    const g = group([paid('other', 'a', 'b', 500)], ['a', 'b'])
    expect(reconcile(start, groupBalances(g, expenses), ids(g))).toEqual({ rows: [], changed: true, revised: true, fresh: false })
  })

  it('money that comes up after a finished checklist starts a new one', () => {
    const g = group([paid('s1', 'a', 'b', 500)], ['a', 'b'])
    const done: CheckoutRow[] = [{ fromId: 'a', toId: 'b', amount: 500, settlementId: 's1' }]
    const expenses = [expense(1_000, 'b', { a: 500, b: 500 })]
    expect(reconcile(done, groupBalances(g, expenses), ids(g))).toEqual({ rows: done, changed: false, revised: false, fresh: false })
    const more = [...expenses, expense(300, 'a', { b: 300 })]
    expect(reconcile(done, groupBalances(g, more), ids(g))).toEqual({ rows: [open('b', 'a', 300)], changed: true, revised: false, fresh: true })
  })

  it('odd paise stay exact', () => {
    // ₹100 between three: 3,334 + 3,333 + 3,333.
    const g = group([], ['a', 'b', 'c'])
    const expenses = [expense(10_000, 'a', { a: 3_334, b: 3_333, c: 3_333 })]
    const rows = reconcile([], groupBalances(g, expenses), ids(g)).rows
    expect(rows).toEqual([open('b', 'a', 3_333), open('c', 'a', 3_333)])
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(6_666)
  })

  it('never holds more lines than its cap', () => {
    const people = Array.from({ length: MAX_CHECKOUT_ROWS + 30 }, (_, i) => `p${String(i).padStart(3, '0')}`)
    const shares = Object.fromEntries(people.map((id) => [id, 100]))
    const g = group([], people)
    const rows = reconcile([], groupBalances(g, [expense(100 * people.length, 'p000', shares)]), ids(g)).rows
    expect(rows).toHaveLength(MAX_CHECKOUT_ROWS)
  })

  it('counts what is ticked', () => {
    expect(checkoutProgress([])).toEqual({ total: 0, paid: 0, open: 0 })
    expect(checkoutProgress([open('a', 'b', 1), { ...open('a', 'c', 1), settlementId: 's' }])).toEqual({ total: 2, paid: 1, open: 1 })
  })
})

describe('the trip at a glance', () => {
  it('adds up what was spent, over which days, by how many people', () => {
    const g = group([], ['a', 'b'])
    const expenses = [
      expense(30_000, 'a', { a: 15_000, b: 15_000 }, { date: '2026-11-12' }),
      expense(12_050, 'b', { a: 6_025, b: 6_025 }, { date: '2026-11-15' }),
      // Someone who isn't a member but had a share counts as one of the people.
      expense(9_000, 'a', { a: 3_000, b: 3_000, guest: 3_000 }, { date: '2026-11-13' }),
    ]
    expect(tripFacts(g, expenses)).toEqual({ spent: 51_050, expenseCount: 3, people: 3, from: '2026-11-12', to: '2026-11-15' })
  })

  it('leaves out money lent, other currencies and other groups', () => {
    const g = group([], ['a', 'b'])
    const expenses = [
      expense(30_000, 'a', { a: 15_000, b: 15_000 }),
      expense(50_000, 'a', { b: 50_000 }, { kind: 'loan', date: '2026-11-01' }),
      expense(9_000, 'a', { a: 4_500, b: 4_500 }, { currency: 'USD', date: '2026-10-01' }),
      expense(9_000, 'a', { a: 4_500, b: 4_500 }, { groupId: 'flat', date: '2026-12-01' }),
    ]
    expect(tripFacts(g, expenses)).toEqual({ spent: 30_000, expenseCount: 1, people: 2, from: '2026-11-12', to: '2026-11-12' })
  })

  it('an empty group has no dates and no spending', () => {
    expect(tripFacts(group([], ['a']), [])).toEqual({ spent: 0, expenseCount: 0, people: 1, from: null, to: null })
  })
})

describe('the words on the “All square” card', () => {
  it('writes the dates the short way', () => {
    expect(tripDates('2026-11-15', '2026-11-15')).toBe('15 Nov')
    expect(tripDates('2026-11-12', '2026-11-15')).toBe('12 to 15 Nov')
    expect(tripDates('2026-10-28', '2026-11-02')).toBe('28 Oct to 2 Nov')
    expect(tripDates('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 to 2 Jan 2027')
    expect(tripDates('2028-02-27', '2028-02-29')).toBe('27 to 29 Feb')
    expect(tripDates(null, null)).toBeNull()
    expect(tripDates('soon', 'later')).toBeNull()
  })

  it('the text to share says what is true: the trip, what was spent, how many payments', () => {
    const g = { name: 'Goa 2026', emoji: '🏖️', currency: 'INR' }
    const facts = { spent: 4_800_000, expenseCount: 14, people: 6, from: '2026-11-12', to: '2026-11-15' }
    expect(allSquareText(g, facts, 3)).toBe('🏖️ Goa 2026: all square\n12 to 15 Nov · ₹48,000 spent · 6 people\n3 payments and nobody owes anybody.\n\n— split with Settle')
    expect(allSquareText(g, facts, 1)).toContain('\n1 payment and nobody owes anybody.\n')
    // Square without any payment ticked here: it claims none.
    expect(allSquareText(g, { ...facts, people: 1, from: null, to: null }, 0)).toBe('🏖️ Goa 2026: all square\n₹48,000 spent · 1 person\nNobody owes anybody.\n\n— split with Settle')
  })
})
