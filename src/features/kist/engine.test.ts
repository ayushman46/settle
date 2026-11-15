import { describe, expect, it } from 'vitest'
import {
  countParts,
  countedTotal,
  defaultFirstDue,
  draftParts,
  duePlans,
  endPlan,
  isRunning,
  kistView,
  makePlan,
  MAX_PARTS,
  mostParts,
  nextFirst,
  partDates,
  planLeft,
  planPaid,
  planRecords,
  planTotal,
  refitPlan,
  sortPlans,
  splitParts,
  tickPart,
  type KistPlan,
} from './engine'

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0)

function plan(total: number, count: number, first = '2026-12-01', more: Partial<Parameters<typeof makePlan>[0]> = {}): KistPlan {
  const made = makePlan({ id: 'p1', friendId: 'riya', direction: 'pay', currency: 'INR', every: 'month', total, count, first, now: 1_000, ...more })
  if (!made) throw new Error('no plan')
  return made
}

const paidPart = (p: KistPlan, index: number, today = '2026-12-01'): KistPlan => tickPart(p, index, { now: 2_000 + index, today, how: 'plan' })

describe('parts in whole rupees', () => {
  it('splits evenly when it divides', () => {
    expect(splitParts(600_000, 3)).toEqual([200_000, 200_000, 200_000])
  })

  it('gives the last part what is left over, so the parts add up', () => {
    expect(splitParts(1_000_000, 3)).toEqual([333_300, 333_300, 333_400])
    expect(splitParts(100_000, 12)).toEqual([...new Array<number>(11).fill(8_300), 8_700])
  })

  it('keeps every part but the last in whole rupees, and puts the paise on the last', () => {
    const parts = splitParts(1_000_050, 4)
    expect(parts).toEqual([250_000, 250_000, 250_000, 250_050])
    expect(sum(parts)).toBe(1_000_050)
    for (const p of parts.slice(0, -1)) expect(p % 100).toBe(0)
  })

  it('adds up for every count from 1 to 12, on awkward totals', () => {
    for (const total of [100, 199, 12_345, 99_999, 700_001, 123_456_789]) {
      for (let count = 1; count <= MAX_PARTS; count += 1) {
        const parts = splitParts(total, count)
        expect(sum(parts)).toBe(total)
        expect(parts.every((p) => p > 0)).toBe(true)
        expect(parts.slice(0, -1).every((p) => p % 100 === 0)).toBe(true)
      }
    }
  })

  it('makes fewer parts when there are not enough rupees to go round', () => {
    expect(splitParts(250, 3)).toEqual([100, 150])
    expect(splitParts(50, 3)).toEqual([50])
    expect(mostParts(250, 100)).toBe(2)
    expect(mostParts(50, 100)).toBe(1)
    expect(mostParts(10_000_000, 100)).toBe(MAX_PARTS)
  })

  it('has nothing to split for zero, a negative amount or a broken number', () => {
    expect(splitParts(0, 3)).toEqual([])
    expect(splitParts(-500, 3)).toEqual([])
    expect(splitParts(Number.NaN, 3)).toEqual([])
    expect(splitParts(10.5, 3)).toEqual([])
  })

  it('uses the currency’s own whole unit: yen have no paise, dinars have three places', () => {
    expect(splitParts(1_000, 3, 1)).toEqual([333, 333, 334])
    expect(splitParts(10_000, 3, 1_000)).toEqual([3_000, 3_000, 4_000])
  })
})

describe('dates', () => {
  it('starts a monthly plan on the next 1st, even from the 1st itself', () => {
    expect(nextFirst('2026-11-15')).toBe('2026-12-01')
    expect(nextFirst('2026-12-01')).toBe('2027-01-01')
    expect(nextFirst('2026-12-31')).toBe('2027-01-01')
    expect(defaultFirstDue('2026-11-15', 'month')).toBe('2026-12-01')
  })

  it('starts a weekly plan a week from today', () => {
    expect(defaultFirstDue('2026-11-15', 'week')).toBe('2026-11-22')
    expect(defaultFirstDue('2026-12-28', 'week')).toBe('2027-01-04')
  })

  it('goes month by month across the year end', () => {
    expect(partDates('2026-11-01', 'month', 4)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
  })

  it('the 31st means the last day in a shorter month, and is the 31st again after', () => {
    expect(partDates('2027-01-31', 'month', 5)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31'])
  })

  it('knows the leap day', () => {
    expect(partDates('2028-01-31', 'month', 2)).toEqual(['2028-01-31', '2028-02-29'])
    expect(partDates('2028-02-29', 'month', 13).at(-1)).toBe('2029-02-28')
  })

  it('goes week by week across a month end', () => {
    expect(partDates('2026-11-22', 'week', 3)).toEqual(['2026-11-22', '2026-11-29', '2026-12-06'])
  })

  it('has no dates for a date that is not real', () => {
    expect(partDates('2026-02-30', 'month', 3)).toEqual([])
    expect(draftParts(600_000, 3, 'soon', 'month')).toEqual([])
    expect(makePlan({ id: 'x', friendId: 'riya', direction: 'pay', currency: 'INR', every: 'month', total: 600_000, count: 3, first: '', now: 1 })).toBeNull()
  })
})

describe('a plan', () => {
  it('is made of dated parts that add up to its amount, none paid', () => {
    const p = plan(1_000_000, 3)
    expect(p.parts.map((x) => [x.amount, x.due])).toEqual([
      [333_300, '2026-12-01'],
      [333_300, '2027-01-01'],
      [333_400, '2027-02-01'],
    ])
    expect(planTotal(p)).toBe(1_000_000)
    expect(planPaid(p)).toBe(0)
    expect(planLeft(p)).toBe(1_000_000)
    expect(isRunning(p)).toBe(true)
  })

  it('is not made from nothing', () => {
    expect(makePlan({ id: 'x', friendId: 'riya', direction: 'pay', currency: 'INR', every: 'month', total: 0, count: 3, first: '2026-12-01', now: 1 })).toBeNull()
  })

  it('shows what is paid, what is next and what is late', () => {
    const p = paidPart(plan(600_000, 3), 0)
    const view = kistView(p, 400_000, 0, '2027-01-04')
    expect(view.parts.map((x) => x.state)).toEqual(['paid', 'late', 'later'])
    expect(view.parts[1]).toMatchObject({ daysLate: 3 })
    expect(view).toMatchObject({ count: 3, paidCount: 1, total: 600_000, paid: 200_000, left: 400_000, next: 1, state: 'running', drift: 'none' })
    expect(view).toMatchObject({ payNow: 200_000, payOff: 400_000, dueCount: 1, dueAmount: 200_000, daysLate: 3 })
  })

  it('a part is due today on its date, and only "next" before it', () => {
    const p = plan(600_000, 3)
    expect(kistView(p, 600_000, 0, '2026-11-15').parts.map((x) => x.state)).toEqual(['next', 'later', 'later'])
    expect(kistView(p, 600_000, 0, '2026-12-01').parts.map((x) => x.state)).toEqual(['today', 'later', 'later'])
    expect(kistView(p, 600_000, 0, '2027-01-01').parts.map((x) => x.state)).toEqual(['late', 'today', 'later'])
  })

  it('is done once every part is ticked', () => {
    let p = plan(600_000, 3)
    for (let i = 0; i < 3; i += 1) p = paidPart(p, i)
    const view = kistView(p, 0, 0, '2027-02-01')
    expect(view).toMatchObject({ state: 'done', drift: 'none', left: 0, paid: 600_000, next: -1, payNow: 0, payOff: 0 })
    expect(isRunning(p)).toBe(false)
  })

  it('ticking a part twice changes nothing, and neither does a part that is not there', () => {
    const p = paidPart(plan(600_000, 3), 0)
    expect(paidPart(p, 0)).toBe(p)
    expect(paidPart(p, 9)).toBe(p)
  })

  it('a part shows what was really recorded when that is not its own amount', () => {
    const p = tickPart(plan(600_000, 3), 0, { now: 5, today: '2026-12-01', how: 'plan', amount: 150_000 })
    expect(p.parts[0]).toMatchObject({ amount: 150_000, paidAt: 5, paidOn: '2026-12-01', how: 'plan' })
    expect(planPaid(p)).toBe(150_000)
  })
})

describe('when what is owed changes', () => {
  it('says more is owed than the plan covers', () => {
    const view = kistView(plan(600_000, 3), 740_000, 0, '2026-11-15')
    expect(view).toMatchObject({ drift: 'more', owed: 740_000, left: 600_000, gap: 140_000, countable: 0, payNow: 200_000, payOff: 600_000 })
  })

  it('says less is owed than the plan has left, and never asks for more than is owed', () => {
    const view = kistView(plan(600_000, 3), 150_000, 0, '2026-11-15')
    expect(view).toMatchObject({ drift: 'less', owed: 150_000, left: 600_000, gap: 450_000, payNow: 150_000, payOff: 150_000 })
  })

  it('says nothing is owed any more', () => {
    const view = kistView(plan(600_000, 3), 0, 0, '2026-11-15')
    expect(view).toMatchObject({ drift: 'clear', owed: 0, payNow: 0, payOff: 0 })
    // A balance that has swung the other way is nothing owed on this side.
    expect(kistView(plan(600_000, 3), -5_000, 0, '2026-11-15').drift).toBe('clear')
  })

  it('offers to count a payment made elsewhere that covers the next part', () => {
    const p = paidPart(plan(600_000, 3), 0)
    // ₹2,000 was paid outside the plan: ₹2,000 is owed, the plan still has ₹4,000 left.
    const view = kistView(p, 200_000, 200_000, '2026-12-05')
    expect(view).toMatchObject({ drift: 'less', gap: 200_000, countable: 1, countAmount: 200_000 })
  })

  it('counts two parts when the payment covers two', () => {
    const view = kistView(plan(600_000, 3), 200_000, 400_000, '2026-11-20')
    expect(view).toMatchObject({ countable: 2, countAmount: 400_000 })
  })

  it('does not offer to count a payment smaller than the part', () => {
    expect(kistView(plan(600_000, 3), 550_000, 50_000, '2026-11-20')).toMatchObject({ drift: 'less', countable: 0, countAmount: 0 })
  })

  it('does not count a payment that only cleared something new: the plan is not behind', () => {
    // ₹2,000 was paid elsewhere, but a new ₹2,000 expense came in too: owed still matches the plan.
    expect(kistView(plan(600_000, 3), 600_000, 200_000, '2026-11-20')).toMatchObject({ drift: 'none', countable: 0 })
    // What is owed fell by ₹500 only: a ₹2,000 payment elsewhere cannot stand for a ₹2,000 part.
    expect(kistView(plan(600_000, 3), 550_000, 200_000, '2026-11-20')).toMatchObject({ drift: 'less', countable: 0 })
  })

  it('does not count a drop that no payment explains (an expense was edited)', () => {
    expect(kistView(plan(600_000, 3), 400_000, 0, '2026-11-20')).toMatchObject({ drift: 'less', gap: 200_000, countable: 0 })
  })

  it('counting ticks the next parts without any record of a payment', () => {
    const p = countParts(plan(600_000, 3), 2, 9_000, '2026-11-20')
    expect(p.parts.map((x) => x.how)).toEqual(['counted', 'counted', null])
    expect(p.parts[0]).toMatchObject({ paidAt: 9_000, paidOn: '2026-11-20', records: [] })
    expect(countedTotal(p)).toBe(400_000)
    expect(planLeft(p)).toBe(200_000)
    expect(kistView(p, 200_000, 0, '2026-11-20')).toMatchObject({ drift: 'none', paidCount: 2 })
    expect(kistView(p, 200_000, 0, '2026-11-20').parts.map((x) => x.state)).toEqual(['counted', 'counted', 'next'])
  })

  it('counting more parts than are left stops at the end', () => {
    const p = countParts(plan(600_000, 3), 7, 9_000, '2026-11-20')
    expect(p.parts.every((x) => x.how === 'counted')).toBe(true)
  })

  it('fits the parts still to pay to what is owed now, keeping their dates', () => {
    const p = paidPart(plan(600_000, 3), 0)
    const more = refitPlan(p, 540_000, 100, 7)
    expect(more.parts.map((x) => [x.amount, x.due])).toEqual([
      [200_000, '2026-12-01'],
      [270_000, '2027-01-01'],
      [270_000, '2027-02-01'],
    ])
    const less = refitPlan(p, 100_050, 100, 7)
    expect(less.parts.map((x) => x.amount)).toEqual([200_000, 50_000, 50_050])
    expect(planLeft(less)).toBe(100_050)
    expect(less.parts[0]).toBe(p.parts[0])
  })

  it('drops parts from the end when too little is owed to go round', () => {
    const fitted = refitPlan(plan(600_000, 3), 150, 100, 7)
    expect(fitted.parts.map((x) => [x.amount, x.due])).toEqual([[150, '2026-12-01']])
  })

  it('fitting to nothing finishes the plan; a finished plan is left alone', () => {
    const p = paidPart(plan(600_000, 3), 0)
    const ended = refitPlan(p, 0, 100, 7)
    expect(ended.endedAt).toBe(7)
    expect(refitPlan(ended, 300_000, 100, 8)).toBe(ended)
    const all = paidPart(paidPart(p, 1), 2)
    expect(refitPlan(all, 300_000, 100, 8)).toBe(all)
  })

  it('a plan finished early asks for nothing more', () => {
    const p = endPlan(paidPart(plan(600_000, 3), 0), 50)
    expect(isRunning(p)).toBe(false)
    expect(planLeft(p)).toBe(0)
    const view = kistView(p, 0, 0, '2027-03-01')
    expect(view).toMatchObject({ state: 'ended', drift: 'none', next: -1, paid: 200_000, left: 0, dueCount: 0, payNow: 0 })
    expect(view.parts.map((x) => x.state)).toEqual(['paid', 'dropped', 'dropped'])
    expect(endPlan(p, 60)).toBe(p)
  })

  it('remembers what each of its own payments recorded', () => {
    const records = [{ kind: 'group' as const, groupId: 'goa', settlementId: 's1', amount: 200_000 }]
    const p = tickPart(plan(600_000, 3), 0, { now: 5, today: '2026-12-01', how: 'plan', records })
    expect(planRecords([p, plan(300_000, 3)])).toEqual(records)
  })
})

describe('what is due', () => {
  it('lists running plans with a part due today or earlier, the longest overdue first', () => {
    const a = plan(600_000, 3, '2026-12-01', { id: 'a' })
    const b = plan(300_000, 3, '2026-11-20', { id: 'b', every: 'week' })
    const later = plan(300_000, 3, '2027-03-01', { id: 'c' })
    const due = duePlans([a, b, later], '2026-12-01')
    expect(due.map((d) => [d.plan.id, d.index, d.count, d.amount, d.daysLate])).toEqual([
      ['b', 0, 2, 200_000, 11],
      ['a', 0, 1, 200_000, 0],
    ])
  })

  it('has nothing for a plan that is paid, finished early, or not yet due', () => {
    let done = plan(600_000, 3)
    for (let i = 0; i < 3; i += 1) done = paidPart(done, i)
    expect(duePlans([done, endPlan(plan(600_000, 3), 5), plan(600_000, 3)], '2026-11-30')).toEqual([])
    expect(duePlans([], '2026-11-30')).toEqual([])
  })

  it('skips the paid parts: the next one sets the date', () => {
    const p = paidPart(plan(600_000, 3), 0)
    expect(duePlans([p], '2026-12-15')).toEqual([])
    expect(duePlans([p], '2027-01-01')[0]).toMatchObject({ index: 1, count: 1, daysLate: 0 })
  })

  it('orders plans by the next date, then by name (not by id)', () => {
    const names: Record<string, string> = { z1: 'Asha', a9: 'Zoya', m5: 'meera' }
    const nameOf = (id: string): string => names[id] ?? id
    const zoya = plan(600_000, 3, '2026-12-01', { id: '1', friendId: 'a9' })
    const asha = plan(600_000, 3, '2026-12-01', { id: '2', friendId: 'z1' })
    const meera = plan(600_000, 3, '2026-11-25', { id: '3', friendId: 'm5' })
    expect(sortPlans([zoya, asha, meera], nameOf).map((p) => nameOf(p.friendId))).toEqual(['meera', 'Asha', 'Zoya'])
  })
})
