import { describe, expect, it } from 'vitest'
import {
  closePassed,
  daysOverdue,
  defaultDue,
  metByDue,
  metEver,
  nextFriday,
  promiseState,
  promiseView,
  quickDates,
  shownPromise,
  sortHistory,
  sortOpen,
  statsOf,
  weekday,
  type PromiseEntry,
  type PromiseFacts,
} from './engine'

let n = 0
function promise(more: Partial<PromiseEntry> = {}): PromiseEntry {
  n += 1
  return {
    id: `p${n}`,
    friendId: 'riya',
    direction: 'receive',
    currency: 'INR',
    amount: 50_000,
    owedThen: 200_000,
    due: '2026-11-20',
    createdAt: n,
    paidBefore: {},
    outcome: null,
    closedAt: null,
    ...more,
  }
}

const facts = (more: Partial<PromiseFacts> = {}): PromiseFacts => ({ owedNow: 200_000, paidByDue: 0, paidLate: 0, ...more })

describe('the one-tap dates', () => {
  it('knows the day of the week', () => {
    expect(weekday('2026-11-15')).toBe(0)
    expect(weekday('2026-11-20')).toBe(5)
    expect(weekday('2027-01-01')).toBe(5)
    expect(weekday('2026-02-30')).toBe(-1)
  })

  it('Friday is the coming Friday, and a week on when today is Friday', () => {
    expect(nextFriday('2026-11-15')).toBe('2026-11-20')
    expect(nextFriday('2026-11-19')).toBe('2026-11-20')
    expect(nextFriday('2026-11-20')).toBe('2026-11-27')
    expect(nextFriday('2026-11-28')).toBe('2026-12-04')
    expect(defaultDue('2026-11-15')).toBe('2026-11-20')
  })

  it('offers tomorrow, Friday and the 1st', () => {
    expect(quickDates('2026-11-15')).toEqual([
      { id: 'tomorrow', date: '2026-11-16' },
      { id: 'friday', date: '2026-11-20' },
      { id: 'first', date: '2026-12-01' },
    ])
  })

  it('offers a day once when two of them fall on it', () => {
    // Thursday: tomorrow is Friday.
    expect(quickDates('2026-11-19').map((q) => q.id)).toEqual(['tomorrow', 'first'])
    // The last day of the month: tomorrow is the 1st.
    expect(quickDates('2026-11-30')).toEqual([
      { id: 'tomorrow', date: '2026-12-01' },
      { id: 'friday', date: '2026-12-04' },
    ])
    // 31 Dec 2026 is a Thursday: tomorrow, Friday and the 1st are all 1 Jan 2027.
    expect(quickDates('2026-12-31')).toEqual([{ id: 'tomorrow', date: '2027-01-01' }])
  })

  it('crosses the leap day and has nothing for a date that is not real', () => {
    expect(quickDates('2028-02-28')).toEqual([
      { id: 'tomorrow', date: '2028-02-29' },
      { id: 'friday', date: '2028-03-03' },
      { id: 'first', date: '2028-03-01' },
    ])
    expect(quickDates('soon')).toEqual([])
  })
})

describe('kept or broken', () => {
  it('is open until its date has passed, the date itself included', () => {
    const p = promise()
    expect(promiseState(p, facts(), '2026-11-15')).toBe('open')
    expect(promiseState(p, facts(), '2026-11-20')).toBe('open')
    expect(promiseState(p, facts(), '2026-11-21')).toBe('broken')
  })

  it('is kept once the promised amount is paid by its date', () => {
    const p = promise()
    expect(promiseState(p, facts({ owedNow: 150_000, paidByDue: 50_000 }), '2026-11-18')).toBe('kept')
    expect(promiseState(p, facts({ owedNow: 150_000, paidByDue: 50_000 }), '2026-12-25')).toBe('kept')
    // More than promised is kept too.
    expect(promiseState(p, facts({ owedNow: 0, paidByDue: 200_000 }), '2026-11-18')).toBe('kept')
  })

  it('is not kept by paying part of it', () => {
    const p = promise()
    const part = facts({ owedNow: 170_000, paidByDue: 30_000 })
    expect(promiseState(p, part, '2026-11-20')).toBe('open')
    expect(promiseState(p, part, '2026-11-21')).toBe('broken')
    expect(promiseView(p, part, '2026-11-21')).toMatchObject({ state: 'broken', overdue: 1, unmet: 20_000, payable: 20_000 })
  })

  it('a payment dated after the date does not keep it', () => {
    const p = promise()
    const late = facts({ owedNow: 150_000, paidLate: 50_000 })
    expect(metByDue(p, late)).toBe(0)
    expect(promiseState(p, late, '2026-11-25')).toBe('broken')
    // It is paid all the same: nothing is left to ask for.
    expect(metEver(p, late)).toBe(50_000)
    expect(promiseView(p, late, '2026-11-25')).toMatchObject({ unmet: 0, payable: 0 })
  })

  it('a new expense after a paid promise does not break it', () => {
    const p = promise()
    // ₹500 paid on time, then a new ₹1,000 expense: more is owed than when it was made.
    expect(promiseState(p, facts({ owedNow: 250_000, paidByDue: 50_000 }), '2026-11-25')).toBe('kept')
  })

  it('a new expense does not keep an unpaid promise either', () => {
    expect(promiseState(promise(), facts({ owedNow: 300_000 }), '2026-11-25')).toBe('broken')
  })

  it('is kept when what was owed went down by that much some other way', () => {
    const p = promise()
    expect(metByDue(p, facts({ owedNow: 150_000 }))).toBe(50_000)
    expect(promiseState(p, facts({ owedNow: 150_000 }), '2026-11-18')).toBe('kept')
    expect(promiseState(p, facts({ owedNow: 150_100 }), '2026-11-18')).toBe('open')
  })

  it('keeps the outcome it was closed with, whatever happens later', () => {
    const broken = promise({ outcome: 'broken', closedAt: 9 })
    expect(promiseState(broken, facts({ owedNow: 0, paidByDue: 200_000 }), '2026-12-01')).toBe('broken')
    const kept = promise({ outcome: 'kept', closedAt: 9 })
    expect(promiseState(kept, facts({ owedNow: 900_000 }), '2026-12-01')).toBe('kept')
  })

  it('never asks for more than is owed now', () => {
    expect(promiseView(promise(), facts({ owedNow: 10_000 }), '2026-11-18')).toMatchObject({ state: 'kept', unmet: 0, payable: 0 })
    expect(promiseView(promise({ owedThen: 30_000, amount: 30_000 }), facts({ owedNow: 20_000 }), '2026-11-18')).toMatchObject({ state: 'open', unmet: 20_000, payable: 20_000 })
    expect(promiseView(promise(), facts({ owedNow: -5 }), '2026-11-18').payable).toBe(0)
  })

  it('counts the days past its date', () => {
    expect(daysOverdue(promise(), '2026-11-20')).toBe(0)
    expect(daysOverdue(promise(), '2026-11-22')).toBe(2)
    expect(daysOverdue(promise({ due: '2026-12-31' }), '2027-01-02')).toBe(2)
    expect(daysOverdue(promise(), '2026-11-01')).toBe(0)
  })
})

describe('closing the ones whose date has passed', () => {
  it('closes them as the records have it, and leaves the rest open', () => {
    const paid = promise({ id: 'paid' })
    const unpaid = promise({ id: 'unpaid' })
    const later = promise({ id: 'later', due: '2026-12-05' })
    const factsOf = (p: PromiseEntry): PromiseFacts => (p.id === 'paid' ? facts({ owedNow: 150_000, paidByDue: 50_000 }) : facts())
    const out = closePassed([paid, unpaid, later], factsOf, '2026-11-21', 777)
    expect(out.map((p) => [p.id, p.outcome, p.closedAt])).toEqual([
      ['paid', 'kept', 777],
      ['unpaid', 'broken', 777],
      ['later', null, null],
    ])
  })

  it('does not close a promise on its own date, even a paid one: an undone payment can still take it back', () => {
    const list = [promise()]
    expect(closePassed(list, () => facts({ owedNow: 150_000, paidByDue: 50_000 }), '2026-11-20', 1)).toBe(list)
  })

  it('hands back the same list when nothing changed', () => {
    const list = [promise({ outcome: 'kept', closedAt: 4 }), promise({ due: '2027-01-01' })]
    expect(closePassed(list, () => facts(), '2026-11-21', 1)).toBe(list)
    expect(closePassed([], () => facts(), '2026-11-21', 1)).toEqual([])
  })
})

describe('reading', () => {
  it('counts kept and broken: "Kept 3 of 4"', () => {
    expect(statsOf(['kept', 'kept', 'broken', 'kept', 'open'])).toEqual({ kept: 3, broken: 1, total: 4, open: 1 })
    expect(statsOf([])).toEqual({ kept: 0, broken: 0, total: 0, open: 0 })
  })

  it('a row shows the open promise; failing that, the last broken one while it is unpaid', () => {
    const old = promiseView(promise({ createdAt: 1, outcome: 'broken' }), facts(), '2026-12-01')
    const open = promiseView(promise({ createdAt: 2, due: '2026-12-05' }), facts(), '2026-12-01')
    expect(shownPromise([old, open])).toBe(open)
    expect(shownPromise([old])).toBe(old)
    // Paid late: broken, but there is nothing left to chase.
    const paidLate = promiseView(promise({ createdAt: 3, outcome: 'broken' }), facts({ owedNow: 150_000, paidLate: 50_000 }), '2026-12-01')
    expect(shownPromise([paidLate])).toBeNull()
    // The last one was kept: an older broken one is history.
    const kept = promiseView(promise({ createdAt: 4, outcome: 'kept' }), facts(), '2026-12-01')
    expect(shownPromise([old, kept])).toBeNull()
    expect(shownPromise([])).toBeNull()
  })

  it('orders open promises by date, then by name (not by id)', () => {
    const names: Record<string, string> = { z1: 'Asha', a9: 'Zoya', m5: 'meera' }
    const nameOf = (id: string): string => names[id] ?? id
    const view = (friendId: string, due: string) => promiseView(promise({ friendId, due }), facts(), '2026-11-15')
    const sorted = sortOpen([view('a9', '2026-11-20'), view('z1', '2026-11-20'), view('m5', '2026-11-18')], nameOf)
    expect(sorted.map((v) => nameOf(v.promise.friendId))).toEqual(['meera', 'Asha', 'Zoya'])
  })

  it('orders the past with the latest date first', () => {
    const view = (due: string) => promiseView(promise({ due, outcome: 'kept' }), facts(), '2026-12-15')
    expect(sortHistory([view('2026-11-18'), view('2026-12-01'), view('2026-11-20')]).map((v) => v.promise.due)).toEqual(['2026-12-01', '2026-11-20', '2026-11-18'])
  })
})
