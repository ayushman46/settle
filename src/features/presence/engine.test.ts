import { describe, expect, it } from 'vitest'
import type { Expense, Group } from '../../domain/types'
import { splitAmount } from '../../engine/split'
import {
  fixUpKey,
  isSplitByNights,
  isStayExpense,
  nightsIn,
  nightsPlan,
  outsideStay,
  presenceFixUps,
  spreadsPart,
  tripRange,
  usableStay,
  withoutPerson,
  type Anchors,
  type Stays,
} from './engine'

const NAMES: Record<string, string> = {
  me: 'Ayush',
  riya: 'Riya',
  sam: 'Sam',
  neha: 'Neha',
}
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
function expense(title: string, total: number, date: string, payerId: string, ids: string[], more: Partial<Expense> = {}): Expense {
  n++
  const each = Math.floor(total / ids.length)
  const shares = Object.fromEntries(ids.map((id, i) => [id, i === 0 ? total - each * (ids.length - 1) : each]))
  return {
    id: `e${n}`,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total,
    date,
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'equal',
    participants: ids.map((friendId) => ({ friendId, input: null })),
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
const fix = (expenses: Expense[], stays: Stays, more: { group?: Group; declined?: string[]; anchors?: Anchors } = {}) =>
  presenceFixUps({
    group: more.group ?? group(),
    expenses,
    stays,
    declined: more.declined,
    nameOf,
    anchors: more.anchors,
  })
const sharesOf = (e: Expense, participants = e.participants) =>
  splitAmount({ total: e.total, currency: e.currency, mode: e.mode === 'items' ? 'equal' : e.mode, participants, payerId: e.payerId }).shares
const ALL = ['me', 'riya', 'sam']

describe('stays', () => {
  it('both days count, null means open-ended', () => {
    const stay = { from: '2026-11-12', to: '2026-11-14' }
    expect(outsideStay(stay, '2026-11-11')).toBe('before')
    expect(outsideStay(stay, '2026-11-12')).toBeNull()
    expect(outsideStay(stay, '2026-11-14')).toBeNull()
    expect(outsideStay(stay, '2026-11-15')).toBe('after')
    expect(outsideStay({ from: null, to: '2026-11-14' }, '2020-01-01')).toBeNull()
    expect(outsideStay({ from: '2026-11-12', to: null }, '2030-01-01')).toBeNull()
  })

  it('a stay with no dates, junk dates or from after to says nothing', () => {
    expect(usableStay({ from: null, to: null })).toBeNull()
    expect(usableStay({ from: '2026-11-15', to: '2026-11-12' })).toBeNull()
    expect(usableStay({ from: 'soon', to: '2026-13-40' })).toBeNull()
    expect(outsideStay(undefined, '2026-11-12')).toBeNull()
  })
})

describe('came late, left early', () => {
  it('finds equal and shares splits from before someone came, in name order, newest first', () => {
    const a = expense('Dinner', 90_000, '2026-11-10', 'me', ALL)
    const b = expense('Cab', 60_000, '2026-11-11', 'riya', ALL, {
      mode: 'shares',
      participants: [
        { friendId: 'me', input: 2 },
        { friendId: 'riya', input: 1 },
        { friendId: 'sam', input: 1 },
      ],
    })
    const c = expense('Lunch', 30_000, '2026-11-12', 'me', ALL) // Sam's first day: stays
    const out = fix([a, b, c], { sam: { from: '2026-11-12', to: null } })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      friendId: 'sam',
      side: 'before',
      byHand: [],
    })
    expect(out[0]!.safe.map((e) => e.title)).toEqual(['Cab', 'Dinner'])
  })

  it('after someone left, and both sides', () => {
    const early = expense('Breakfast', 30_000, '2026-11-10', 'me', ALL)
    const late = expense('Dinner', 90_000, '2026-11-16', 'me', ALL)
    expect(fix([early, late], { riya: { from: null, to: '2026-11-14' } })[0]).toMatchObject({ side: 'after', safe: [late] })
    expect(fix([early, late], { riya: { from: '2026-11-11', to: '2026-11-14' } })[0]!.side).toBe('both')
  })

  it('the payer can be away and stay the payer; only the people on it change', () => {
    const villa = expense('Villa', 300_000, '2026-11-10', 'sam', ALL)
    const out = fix([villa], { sam: { from: '2026-11-12', to: null } })
    expect(out[0]!.safe).toEqual([villa])
    expect(withoutPerson(villa, 'sam').map((p) => p.friendId)).toEqual(['me', 'riya'])
    // A payer who was away and wasn't on it: nothing to fix.
    const cab = expense('Cab', 30_000, '2026-11-10', 'sam', ['me', 'riya'])
    expect(fix([cab], { sam: { from: '2026-11-12', to: null } })).toEqual([])
  })

  it('never takes off the last person, or the last with any weight', () => {
    const solo = expense('Sam’s ticket', 50_000, '2026-11-10', 'me', ['sam'])
    const zero = expense('Snacks', 10_000, '2026-11-10', 'me', ['me', 'sam'], {
      mode: 'shares',
      participants: [
        { friendId: 'me', input: 0 },
        { friendId: 'sam', input: 1 },
      ],
    })
    const out = fix([solo, zero], { sam: { from: '2026-11-12', to: null } })
    expect(out[0]!.safe).toEqual([])
    expect(out[0]!.byHand.map((h) => [h.expense.title, h.reason])).toEqual([
      ['Snacks', 'last'], // same day: the one added later first
      ['Sam’s ticket', 'last'],
    ])
  })

  it('percent, exact and “had” splits are one tap too; itemised bills are listed to fix by hand', () => {
    const typedIn = (inputs: number[]) => ({ participants: ALL.map((friendId, i) => ({ friendId, input: inputs[i] ?? 0 })) })
    const exact = expense('Shopping', 50_000, '2026-11-10', 'me', ALL, { mode: 'exact', ...typedIn([20_000, 20_000, 10_000]) })
    const percent = expense('Fuel', 50_000, '2026-11-10', 'me', ALL, { mode: 'percent', ...typedIn([4500, 4500, 1000]) })
    const had = expense('Bar', 50_000, '2026-11-10', 'me', ALL, { mode: 'had', ...typedIn([20_000, 10_000, 15_000]) })
    const bill = expense('Thali place', 50_000, '2026-11-10', 'me', ALL, {
      kind: 'bill',
      mode: 'items',
    })
    // Sam was the only one who had anything: nobody to spread it over.
    const onlySam = expense('Sam’s beer', 50_000, '2026-11-10', 'me', ALL, { mode: 'had', ...typedIn([0, 0, 50_000]) })
    const out = fix([exact, percent, had, bill, onlySam], {
      sam: { from: '2026-11-12', to: null },
    })
    expect(out[0]!.safe.map((e) => e.title).sort()).toEqual(['Bar', 'Fuel', 'Shopping'])
    expect(out[0]!.safe.every(spreadsPart)).toBe(true)
    expect(Object.fromEntries(out[0]!.byHand.map((h) => [h.expense.title, h.reason]))).toEqual({
      'Thali place': 'bill',
      'Sam’s beer': 'last',
    })
  })

  it('taking someone off a percent split spreads their part in proportion, to the basis point and the paisa', () => {
    const ids = ['me', 'riya', 'sam', 'neha']
    const fireworks = expense('Fireworks', 100_001, '2026-11-11', 'me', ids, {
      mode: 'percent',
      participants: [
        { friendId: 'me', input: 3000 },
        { friendId: 'riya', input: 3000 },
        { friendId: 'sam', input: 3000 },
        { friendId: 'neha', input: 1000 },
      ],
    })
    const left = withoutPerson(fireworks, 'neha')
    expect(left.map((p) => p.input)).toEqual([3334, 3333, 3333])
    const shares = sharesOf(fireworks, left)
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100_001)
    expect(shares.neha).toBeUndefined()
    // Uneven parts keep their proportions.
    const uneven = { ...fireworks, participants: fireworks.participants.map((p, i) => ({ ...p, input: [5000, 2500, 1500, 1000][i] ?? 0 })) }
    expect(withoutPerson(uneven, 'neha').map((p) => p.input)).toEqual([5555, 2778, 1667])
  })

  it('taking someone off an exact split spreads their amount in proportion and still adds up to the total', () => {
    const shopping = expense('Shopping', 10_001, '2026-11-10', 'me', ALL, {
      mode: 'exact',
      participants: [
        { friendId: 'me', input: 5000 },
        { friendId: 'riya', input: 2500 },
        { friendId: 'sam', input: 2501 },
      ],
    })
    const left = withoutPerson(shopping, 'sam')
    expect(left.reduce((s, p) => s + (p.input ?? 0), 0)).toBe(10_001)
    expect(left.map((p) => p.input)).toEqual([6667, 3334])
    const had = expense('Bar', 10_000, '2026-11-10', 'me', ALL, {
      mode: 'had',
      participants: [
        { friendId: 'me', input: 4000 },
        { friendId: 'riya', input: 2000 },
        { friendId: 'sam', input: 2000 },
      ],
    })
    // "had": what the others had stays; the total is shared in proportion to it.
    expect(withoutPerson(had, 'sam')).toEqual([
      { friendId: 'me', input: 4000 },
      { friendId: 'riya', input: 2000 },
    ])
  })

  it('someone who already paid their part back is listed, not changed', () => {
    const paid = expense('Dinner', 90_000, '2026-11-10', 'me', ALL, {
      paidBack: { sam: 5 },
    })
    const part = expense('Lunch', 90_000, '2026-11-10', 'me', ALL, {
      partPaid: { sam: 10_000 },
    })
    const out = fix([paid, part], { sam: { from: '2026-11-12', to: null } })
    expect(out[0]!.safe).toEqual([])
    expect(out[0]!.byHand.map((h) => h.reason)).toEqual(['paid', 'paid'])
  })

  it('ignores loans, other groups, archived groups, removed members, bad dates and what was left alone', () => {
    const loan = expense('Cash', 20_000, '2026-11-10', 'me', ['sam'], {
      kind: 'loan',
    })
    const other = expense('Dinner', 90_000, '2026-11-10', 'me', ALL, {
      groupId: 'flat',
    })
    const undated = expense('Odd', 90_000, 'someday', 'me', ALL)
    const kept = expense('Lunch', 90_000, '2026-11-10', 'me', ALL)
    const stays = {
      sam: { from: '2026-11-12', to: null },
      gone: { from: '2026-11-12', to: null },
    }
    expect(fix([loan, other, undated], stays)).toEqual([])
    expect(fix([kept], stays, { group: group({ archived: true }) })).toEqual([])
    expect(fix([kept], stays, { declined: [fixUpKey(kept.id, 'sam')] })).toEqual([])
    expect(fix([expense('X', 100, '2026-11-10', 'me', ['me', 'gone'])], stays)).toEqual([])
    expect(fix([], stays)).toEqual([])
  })

  it('never takes anyone off a stay: it is pointed to Split by nights, and not counted with the rest', () => {
    // p10: the villa is dated on the first night; Sam came on the 12th and slept there 2 nights.
    const villa = expense('Villa', 1_200_000, '2026-11-10', 'riya', ALL, { category: 'other' })
    const breakfast = expense('Breakfast', 60_000, '2026-11-11', 'me', ALL)
    const brunch = expense('Brunch', 30_000, '2026-11-14', 'me', ALL)
    const out = fix([villa, breakfast, brunch], { sam: { from: '2026-11-12', to: null } })
    expect(out[0]!.safe).toEqual([breakfast])
    expect(out[0]!.byHand).toEqual([])
    expect(out[0]!.nightly).toEqual([villa])
    // Only the stay: still a banner, so it can be split by nights.
    expect(fix([villa, brunch], { sam: { from: '2026-11-12', to: null } })[0]).toMatchObject({ safe: [], byHand: [], nightly: [villa] })
    // “Leave them” covers it too.
    expect(fix([villa, brunch], { sam: { from: '2026-11-12', to: null } }, { declined: [fixUpKey(villa.id, 'sam')] })).toEqual([])
  })

  it('a stay already split by nights is left alone and not counted, even after a later expense moves the trip’s last day', () => {
    const stays: Stays = { sam: { from: '2026-11-12', to: null } }
    const brunch = expense('Brunch', 30_000, '2026-11-14', 'me', ALL)
    const villa = expense('Villa', 1_200_000, '2026-11-10', 'riya', ALL, { category: 'other' })
    const plan = nightsPlan(villa, group(), [villa, brunch], stays)!
    expect(plan.rows.map((r) => r.nights)).toEqual([4, 4, 2])
    const split = { ...villa, mode: 'shares' as const, participants: plan.participants, shares: sharesOf({ ...villa, mode: 'shares' }, plan.participants) }
    expect(fix([split, brunch], stays)).toEqual([])
    // A shares bill split by nights that doesn't read as a stay is never re-split by Take off either.
    const renamed = { ...split, title: 'Goa house', category: 'food' as const }
    expect(isSplitByNights(renamed, group(), [renamed, brunch], stays)).toBe(true)
    expect(fix([renamed, brunch], stays)).toEqual([])
    // A dinner on the 15th moves the trip's last day; the range remembered when it was split keeps it split.
    const late = expense('Dinner', 30_000, '2026-11-15', 'me', ALL)
    const anchors = { [villa.id]: plan.range }
    expect(nightsPlan(split, group(), [split, brunch, late], stays)).not.toBeNull()
    expect(nightsPlan(split, group(), [split, brunch, late], stays, plan.range)).toBeNull()
    expect(fix([split, brunch, late], stays, { anchors }).flatMap((p) => p.nightly)).toEqual([])
  })

  it('orders people by name, not id', () => {
    const e = expense('Dinner', 90_000, '2026-11-10', 'me', ALL)
    const out = fix([e], {
      sam: { from: '2026-11-12', to: null },
      me: { from: '2026-11-11', to: null },
      riya: { from: '2026-11-11', to: null },
    })
    expect(out.map((p) => nameOf(p.friendId))).toEqual(['Ayush', 'Riya', 'Sam'])
  })
})

describe('split by nights', () => {
  const stays: Stays = { sam: { from: '2026-11-14', to: null } }
  const trip = () => [expense('Train', 300_000, '2026-11-12', 'me', ALL, { category: 'travel' }), expense('Dinner', 90_000, '2026-11-16', 'me', ALL)]

  it('knows a stay from its title and category', () => {
    expect(isStayExpense({ title: 'Villa in Anjuna', category: 'travel' })).toBe(true)
    expect(isStayExpense({ title: 'Airbnb', category: 'other' })).toBe(true)
    expect(isStayExpense({ title: 'Zostel dorm', category: 'travel' })).toBe(true)
    expect(isStayExpense({ title: 'Flight to Goa', category: 'travel' })).toBe(false)
    expect(isStayExpense({ title: 'Dinner at the hotel', category: 'food' })).toBe(false)
    expect(isStayExpense({ title: 'Restroom', category: 'other' })).toBe(false)
  })

  it('counts nights between the trip’s first and last day; no dates = the whole trip', () => {
    const range = tripRange(group(), trip(), stays)
    expect(range).toEqual({ from: '2026-11-12', to: '2026-11-16' })
    expect(nightsIn(undefined, range!)).toBe(4)
    expect(nightsIn(stays.sam, range!)).toBe(2)
    expect(nightsIn({ from: '2026-11-13', to: '2026-11-14' }, range!)).toBe(1)
    expect(nightsIn({ from: '2026-11-20', to: null }, range!)).toBe(0)
    // Stays stretch the range past the expenses.
    expect(
      tripRange(group(), trip(), {
        riya: { from: '2026-11-10', to: '2026-11-18' },
      }),
    ).toEqual({ from: '2026-11-10', to: '2026-11-18' })
    expect(tripRange(group(), [], {})).toBeNull()
  })

  it('a remembered range stands in for the expenses, and the days people set still widen it', () => {
    const anchor = { from: '2026-11-12', to: '2026-11-14' }
    const later = [...trip(), expense('Dinner', 30_000, '2026-11-20', 'me', ALL)]
    expect(tripRange(group(), later, stays, anchor)).toEqual(anchor)
    expect(tripRange(group(), later, { ...stays, riya: { from: null, to: '2026-11-16' } }, anchor)).toEqual({ from: '2026-11-12', to: '2026-11-16' })
    // The day someone leaves isn't a night: until 13 Nov from 10 Nov is 3 nights.
    expect(nightsIn({ from: '2026-11-10', to: '2026-11-13' }, { from: '2026-11-10', to: '2026-11-14' })).toBe(3)
  })

  it('offers whole-number weights whose shares add up to the total', () => {
    const villa = expense('Villa', 100_001, '2026-11-12', 'riya', ALL, {
      category: 'travel',
    })
    const plan = nightsPlan(villa, group(), [...trip(), villa], stays)!
    expect(plan.rows.map((r) => [r.friendId, r.nights])).toEqual([
      ['me', 4],
      ['riya', 4],
      ['sam', 2],
    ])
    expect(plan.participants).toEqual([
      { friendId: 'me', input: 2 },
      { friendId: 'riya', input: 2 },
      { friendId: 'sam', input: 1 },
    ])
    expect(plan.rows.reduce((s, r) => s + r.share, 0)).toBe(100_001)
    const { shares } = splitAmount({
      total: villa.total,
      currency: 'INR',
      mode: 'shares',
      participants: plan.participants,
      payerId: 'riya',
    })
    expect(plan.rows.map((r) => r.share)).toEqual([shares.me, shares.riya, shares.sam])
  })

  it('nothing to offer: equal nights, no stays, not a stay, a bill, one person, or already split so', () => {
    const villa = expense('Villa', 100_000, '2026-11-12', 'riya', ALL, {
      category: 'travel',
    })
    const all = [...trip(), villa]
    expect(nightsPlan(villa, group(), all, {})).toBeNull()
    expect(
      nightsPlan(villa, group(), all, {
        me: { from: '2026-11-14', to: null },
        riya: { from: '2026-11-14', to: null },
        sam: { from: '2026-11-14', to: null },
      }),
    ).toBeNull()
    expect(nightsPlan({ ...villa, title: 'Scuba', category: 'entertainment' }, group(), all, stays)).toBeNull()
    expect(nightsPlan({ ...villa, kind: 'bill' }, group(), all, stays)).toBeNull()
    expect(nightsPlan({ ...villa, groupId: null }, null, all, stays)).toBeNull()
    expect(
      nightsPlan(
        expense('Room', 100, '2026-11-12', 'me', ['sam'], {
          category: 'travel',
        }),
        group(),
        all,
        stays,
      ),
    ).toBeNull()
    const done = {
      ...villa,
      mode: 'shares' as const,
      participants: [
        { friendId: 'me', input: 4 },
        { friendId: 'riya', input: 4 },
        { friendId: 'sam', input: 2 },
      ],
    }
    expect(nightsPlan(done, group(), all, stays)).toBeNull()
  })
})
