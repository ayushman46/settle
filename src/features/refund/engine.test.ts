import { describe, expect, it } from 'vitest'
import type { BillSnapshot, Expense, Participant, SplitMode } from '../../domain/types'
import { expenseNet } from '../../engine/balances'
import { convertMinor } from '../../engine/fx'
import { expenseShares } from '../../engine/split'
import { canTakeOff, fullyRefunded, fxAfter, noteAfter, participantsAfter, placeExact, planRefund, refundsOn, type RefundInput, type RefundPlan, type RefundRecord } from './engine'

let n = 0
/** An expense as the app would have saved it: its shares come from the app's own split engine. */
function expense(mode: SplitMode, total: number, participants: Participant[], more: Partial<Expense> = {}): Expense {
  n++
  const base = { total, currency: 'INR', mode, participants, payerId: 'sam', roundedToWhole: false, bill: null, ...more }
  return {
    id: `e${n}`,
    kind: base.bill ? 'bill' : 'split',
    title: 'Dinner',
    category: 'food',
    date: '2026-11-10',
    createdAt: n,
    updatedAt: n,
    note: null,
    groupId: 'goa',
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...base,
    shares: expenseShares(base),
  }
}
const people = (inputs: Record<string, number | null>): Participant[] => Object.entries(inputs).map(([friendId, input]) => ({ friendId, input }))
const refund = (amount: number, more: Partial<RefundInput> = {}): RefundInput => ({ amount, toId: 'sam', noteLine: '', inGroup: true, ...more })
type Planned = Extract<RefundPlan, { ok: true }>
function planned(e: Expense, input: RefundInput): Planned {
  const plan = planRefund(e, input)
  if (!plan.ok) throw new Error(`expected a plan, got ${plan.issue}`)
  return plan
}
const sum = (shares: Record<string, number>): number => Object.values(shares).reduce((a, b) => a + b, 0)
/** The same expense, had the bill been `total` from the start (exact amounts as the plan re-dealt them). */
const smallerTwin = (e: Expense, plan: Planned): Expense => {
  const twin = { ...e, total: plan.newTotal, participants: plan.changes!.participants }
  return { ...twin, shares: expenseShares(twin) }
}

describe('part of it came back: every split mode', () => {
  it('equal: everyone’s share comes down by the same amount', () => {
    const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }))
    const plan = planned(e, refund(30_000))
    expect(plan).toMatchObject({ kind: 'lower', amount: 30_000, newTotal: 210_000, companions: [] })
    expect(plan.shares).toEqual({ sam: 70_000, riya: 70_000, me: 70_000 })
    expect(plan.changes).toEqual({ total: 210_000, participants: e.participants, note: null })
  })

  it('equal: paise that do not divide go to the payer first, and identical people stay within a paisa', () => {
    const e = expense('equal', 10_000, people({ sam: null, riya: null, me: null }))
    const plan = planned(e, refund(3000))
    expect(plan.shares).toEqual({ sam: 2334, riya: 2333, me: 2333 })
    expect(sum(plan.shares)).toBe(7000)
    // One paisa back: 99.99 divides evenly.
    expect(planned(e, refund(1)).shares).toEqual({ sam: 3333, riya: 3333, me: 3333 })
  })

  it('exact: the typed amounts are re-dealt in proportion, to the paisa', () => {
    const e = expense('exact', 240_000, people({ sam: 120_000, riya: 80_000, me: 40_000 }))
    const plan = planned(e, refund(60_000))
    expect(plan.shares).toEqual({ sam: 90_000, riya: 60_000, me: 30_000 })
    expect(plan.changes!.participants).toEqual(people({ sam: 90_000, riya: 60_000, me: 30_000 }))
    // An awkward one: ₹10 back on ₹1,000.01 split 500.01 / 300 / 200.
    const odd = expense('exact', 100_001, people({ sam: 50_001, riya: 30_000, me: 20_000 }))
    const oddPlan = planned(odd, refund(1000))
    expect(sum(oddPlan.shares)).toBe(99_001)
    for (const [id, share] of Object.entries(oddPlan.shares)) expect(Math.abs(share - (odd.shares[id]! * 99_001) / 100_001)).toBeLessThan(1)
    expect(oddPlan.changes!.participants.reduce((a, p) => a + (p.input ?? 0), 0)).toBe(99_001)
    // The original's typed amounts are not touched.
    expect(odd.participants).toEqual(people({ sam: 50_001, riya: 30_000, me: 20_000 }))
  })

  it('exact: two people who typed the same amount still pay the same (within a paisa)', () => {
    const e = expense('exact', 30_000, people({ riya: 10_000, me: 10_000, sam: 10_000 }))
    const plan = planned(e, refund(10_001))
    expect(sum(plan.shares)).toBe(19_999)
    expect(Math.max(...Object.values(plan.shares)) - Math.min(...Object.values(plan.shares))).toBeLessThanOrEqual(1)
  })

  it('percent: the percentages stay, the amounts follow the smaller total', () => {
    const e = expense('percent', 240_000, people({ sam: 5000, riya: 3000, me: 2000 }))
    const plan = planned(e, refund(30_000))
    expect(plan.shares).toEqual({ sam: 105_000, riya: 63_000, me: 42_000 })
    expect(plan.changes!.participants).toEqual(e.participants)
  })

  it('shares: the weights stay', () => {
    const e = expense('shares', 240_000, people({ sam: 2, riya: 1, me: 1 }))
    const plan = planned(e, refund(40_000))
    expect(plan.shares).toEqual({ sam: 100_000, riya: 50_000, me: 50_000 })
    expect(plan.changes!.participants).toEqual(e.participants)
  })

  it('what each had: what they had stays, what was paid comes down', () => {
    // Had ₹500 / ₹300 / ₹200; paid ₹1,100 with tax; ₹110 cashback.
    const e = expense('had', 110_000, people({ sam: 50_000, riya: 30_000, me: 20_000 }))
    const plan = planned(e, refund(11_000))
    expect(plan.shares).toEqual({ sam: 49_500, riya: 29_700, me: 19_800 })
    expect(plan.changes!.participants).toEqual(e.participants)
  })

  const bill = (feeSplit?: 'equal' | 'proportional'): BillSnapshot => ({
    meta: {
      merchant: 'Cafe',
      date: null,
      subtotal: 100_000,
      tax: 5000,
      serviceCharge: null,
      discount: null,
      tip: null,
      total: 111_000,
      ...(feeSplit ? { fees: [{ id: 'f1', kind: 'delivery' as const, label: 'Delivery', amount: 6000 }] } : {}),
    },
    items: [
      { id: 'i1', name: 'Thali', quantity: 2, amount: 70_000 },
      { id: 'i2', name: 'Lassi', quantity: 1, amount: 30_000 },
    ],
    assignments: { i1: { sam: 1, riya: 1 }, i2: { me: 1 } },
    warnings: [],
    ...(feeSplit ? { feeSplit } : {}),
  })

  it('an itemised bill: the items and who had what stay; what was paid is shared by each person’s items', () => {
    const e = expense('items', 105_000, people({ sam: null, riya: null, me: null }), { bill: bill() })
    expect(e.shares).toEqual({ sam: 36_750, riya: 36_750, me: 31_500 })
    const plan = planned(e, refund(21_000))
    expect(plan.shares).toEqual({ sam: 29_400, riya: 29_400, me: 25_200 })
    expect(plan.changes).toEqual({ total: 84_000, participants: e.participants, note: null })
    // Exactly the same proportions as before: 80% of every share.
    for (const [id, share] of Object.entries(plan.shares)) expect(share).toBe(e.shares[id]! * 0.8)
  })

  it('an itemised bill with fees shared equally: as if less had been paid on that same bill', () => {
    const e = expense('items', 111_000, people({ sam: null, riya: null, me: null }), { bill: bill('equal') })
    const plan = planned(e, refund(21_000))
    expect(sum(plan.shares)).toBe(90_000)
    // ₹60 of fees still shared equally (₹20 each); the other ₹840 by items (35 / 35 / 30).
    expect(plan.shares).toEqual({ sam: 31_400, riya: 31_400, me: 27_200 })
    expect(plan.shares).toEqual(smallerTwin(e, plan).shares)
  })

  it('rounded to whole rupees: the others still pay whole rupees and the payer takes the rest', () => {
    const e = expense('equal', 100_000, people({ sam: null, riya: null, me: null }), { roundedToWhole: true })
    const plan = planned(e, refund(5000))
    expect(plan.shares).toEqual({ sam: 31_800, riya: 31_600, me: 31_600 })
    expect(sum(plan.shares)).toBe(95_000)
  })

  it('a currency without paise', () => {
    const e = expense('equal', 1000, people({ sam: null, riya: null, me: null }), { currency: 'JPY' })
    const plan = planned(e, refund(100))
    expect(plan.shares).toEqual({ sam: 300, riya: 300, me: 300 })
  })

  it('one person, and a payer who is not in the split', () => {
    const solo = expense('equal', 50_000, people({ sam: null }))
    expect(planned(solo, refund(20_000)).shares).toEqual({ sam: 30_000 })
    const treat = expense('equal', 50_000, people({ riya: null, me: null }))
    const plan = planned(treat, refund(10_000))
    expect(plan.shares).toEqual({ riya: 20_000, me: 20_000 })
    expect(expenseNet({ ...treat, total: plan.newTotal, shares: plan.shares })).toEqual({ riya: -20_000, me: -20_000, sam: 40_000 })
  })

  it('for every mode and many amounts: sums to the paisa, in proportion, and exactly the bill that was that much smaller', () => {
    let seed = 7
    const rand = (max: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
      return 1 + (seed % max)
    }
    for (let round = 0; round < 300; round++) {
      const a = rand(90_000)
      const b = rand(90_000)
      const c = rand(90_000)
      const total = a + b + c
      const bps = [rand(5000), rand(4000)]
      const cases: Expense[] = [
        expense('equal', total, people({ sam: null, riya: null, me: null })),
        expense('exact', total, people({ riya: a, sam: b, me: c })),
        expense('percent', total, people({ sam: bps[0]!, riya: bps[1]!, me: 10_000 - bps[0]! - bps[1]! })),
        expense('shares', total, people({ sam: rand(5), riya: rand(5), me: rand(5) })),
        expense('had', total, people({ sam: rand(50_000), riya: rand(50_000), me: rand(50_000) })),
      ]
      for (const e of cases) {
        const amount = rand(total - 1)
        const plan = planned(e, refund(amount))
        expect(sum(plan.shares)).toBe(total - amount)
        expect(Object.keys(plan.shares).sort()).toEqual(Object.keys(e.shares).sort())
        // The balances are those of the same bill, had it been that much smaller.
        const twin = smallerTwin(e, plan)
        expect(expenseNet({ ...e, total: plan.newTotal, shares: plan.shares })).toEqual(expenseNet(twin))
        // In the same proportions as before (rounding moves a share by under a paisa or two).
        for (const [id, share] of Object.entries(plan.shares)) {
          expect(Math.abs(share - (e.shares[id]! * (total - amount)) / total)).toBeLessThan(2)
        }
      }
    }
  })
})

describe('all of it came back', () => {
  it('the expense is removed (it cannot be ₹0), with nothing left to share', () => {
    const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }))
    expect(planRefund(e, refund(240_000))).toEqual({ ok: true, kind: 'remove', amount: 240_000, newTotal: 0, changes: null, shares: {}, companions: [] })
  })

  it('one paisa short of all of it still leaves an expense', () => {
    const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }))
    const plan = planned(e, refund(239_999))
    expect(plan.kind).toBe('lower')
    expect(plan.shares).toEqual({ sam: 1, riya: 0, me: 0 })
  })
})

describe('what cannot be refunded', () => {
  const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }))

  it('a loan is not spending', () => {
    const loan = expense('equal', 50_000, people({ riya: null }), { kind: 'loan' })
    expect(planRefund(loan, refund(10_000))).toEqual({ ok: false, issue: 'loan' })
  })

  it('an amount that is not a whole, positive number of paise', () => {
    for (const amount of [0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(planRefund(e, refund(amount))).toEqual({ ok: false, issue: 'bad_amount' })
  })

  it('more than was paid', () => {
    expect(planRefund(e, refund(240_001))).toEqual({ ok: false, issue: 'too_much' })
  })

  it('a split that no longer adds up is left alone', () => {
    const broken = { ...expense('exact', 240_000, people({ sam: 120_000, riya: 120_000 })), mode: 'percent' as const }
    expect(planRefund(broken, refund(1000))).toEqual({ ok: false, issue: 'stuck' })
  })
})

describe('the money went to someone other than the payer', () => {
  it('they hold the payer’s money: one entry, the payer is owed the refund', () => {
    const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }))
    const plan = planned(e, refund(30_000, { toId: 'riya' }))
    expect(plan.shares).toEqual({ sam: 70_000, riya: 70_000, me: 70_000 })
    expect(plan.companions).toEqual([{ kind: 'holder', lenderId: 'sam', borrowerId: 'riya', amount: 30_000 }])
  })

  it('also for someone who was not in the split at all, and for all of it', () => {
    const e = expense('equal', 240_000, people({ sam: null, me: null }))
    expect(planned(e, refund(240_000, { toId: 'neha' })).companions).toEqual([{ kind: 'holder', lenderId: 'sam', borrowerId: 'neha', amount: 240_000 }])
  })
})

describe('outside a group, someone had already paid the payer back', () => {
  const base = (more: Partial<Expense>) => expense('equal', 240_000, people({ sam: null, riya: null, me: null, neha: null }), { groupId: null, ...more })

  it('ticked off: they paid their old share, so the payer owes them the difference', () => {
    const e = base({ paidBack: { riya: 1 } })
    const plan = planned(e, refund(60_000, { inGroup: false }))
    expect(plan.shares.riya).toBe(45_000)
    expect(plan.companions).toEqual([{ kind: 'overpaid', lenderId: 'riya', borrowerId: 'sam', amount: 15_000 }])
  })

  it('part paid: only what is over the new share comes back', () => {
    const e = base({ partPaid: { riya: 50_000, me: 20_000, neha: 45_000 } })
    const plan = planned(e, refund(60_000, { inGroup: false }))
    // Riya paid 500 of a share that is now 450; you paid 200 (still owe 250); Neha paid exactly 450.
    expect(plan.companions).toEqual([{ kind: 'overpaid', lenderId: 'riya', borrowerId: 'sam', amount: 5000 }])
  })

  it('all of it came back: everyone gets back what they had paid', () => {
    const e = base({ paidBack: { riya: 1 }, partPaid: { me: 20_000 } })
    const plan = planned(e, refund(240_000, { inGroup: false, toId: 'neha' }))
    expect(plan.companions).toEqual([
      { kind: 'holder', lenderId: 'sam', borrowerId: 'neha', amount: 240_000 },
      { kind: 'overpaid', lenderId: 'riya', borrowerId: 'sam', amount: 60_000 },
      { kind: 'overpaid', lenderId: 'me', borrowerId: 'sam', amount: 20_000 },
    ])
  })

  it('in a group the ticks do not count: the group’s balances already carry it', () => {
    const e = base({ groupId: 'goa', paidBack: { riya: 1 } })
    expect(planned(e, refund(60_000, { inGroup: true })).companions).toEqual([])
  })

  it('nobody had paid: nothing extra', () => {
    expect(planned(base({}), refund(60_000, { inGroup: false })).companions).toEqual([])
  })
})

describe('the note', () => {
  it('adds the refund on its own line and keeps what was written', () => {
    expect(noteAfter(null, '₹300 refunded on 14 Nov 2026')).toBe('₹300 refunded on 14 Nov 2026')
    expect(noteAfter('  ', '₹300 refunded on 14 Nov 2026')).toBe('₹300 refunded on 14 Nov 2026')
    expect(noteAfter('Paid by card', '₹300 refunded on 14 Nov 2026')).toBe('Paid by card\n₹300 refunded on 14 Nov 2026')
  })

  it('never cuts what was written: a line that will not fit is left out', () => {
    const long = 'x'.repeat(490)
    expect(noteAfter(long, '₹300 refunded on 14 Nov 2026')).toBe(long)
    expect(noteAfter('note', '')).toBe('note')
  })

  it('is part of the plan', () => {
    const e = expense('equal', 240_000, people({ sam: null, riya: null }), { note: 'Barbeque Nation' })
    expect(planned(e, refund(30_000, { noteLine: '₹300 refunded on 14 Nov 2026' })).changes!.note).toBe('Barbeque Nation\n₹300 refunded on 14 Nov 2026')
  })
})

describe('paid in another currency', () => {
  it('the foreign amount comes down in proportion and the smaller total stands', () => {
    const fx = { amount: 100_000, currency: 'THB', rate: '2.4', rateDate: '2026-11-09', source: 'ecb' as const }
    const e = expense('equal', 240_000, people({ sam: null, riya: null, me: null }), { fx })
    const plan = planned(e, refund(60_000))
    expect(plan.changes!.fx).toEqual({ amount: 75_000, currency: 'THB', rate: '2.4', rateDate: null, source: 'manual_total' })
    expect(plan.shares).toEqual({ sam: 60_000, riya: 60_000, me: 60_000 })
  })

  it('a rate that no longer lands on the paisa is replaced by the one that does', () => {
    const next = fxAfter({ amount: 33_333, currency: 'THB', rate: '2.41', rateDate: null, source: 'manual_rate' }, 'INR', 80_333, 70_001)
    expect(next.source).toBe('manual_total')
    expect(next.amount).toBe(29_046)
    expect(convertMinor(next.amount, 'THB', 'INR', next.rate)).toBe(70_001)
  })
})

describe('participantsAfter', () => {
  it('leaves every mode but exact alone', () => {
    for (const mode of ['equal', 'percent', 'shares', 'had', 'items'] as const) {
      const list = people({ sam: 3, riya: 1 })
      expect(participantsAfter({ mode, participants: list, payerId: 'sam' }, 100)).toEqual(list)
    }
  })

  it('gives the odd paisa to the payer first', () => {
    // 200 between three: 66 each and two odd paise, the payer's first.
    expect(participantsAfter({ mode: 'exact', participants: people({ riya: 100, sam: 100, me: 100 }), payerId: 'sam' }, 200)).toEqual(people({ riya: 67, sam: 67, me: 66 }))
    expect(participantsAfter({ mode: 'exact', participants: people({ riya: 100, me: 100, sam: 100 }), payerId: 'sam' }, 199)).toEqual(people({ riya: 66, me: 66, sam: 67 }))
  })
})

describe('the records', () => {
  const before = expense('equal', 240_000, people({ sam: null, riya: null }))
  const record = (id: string, createdAt: number, more: Partial<RefundRecord> = {}): RefundRecord => ({
    id,
    expenseId: before.id,
    kind: 'lower',
    amount: 30_000,
    currency: 'INR',
    toId: 'sam',
    date: '2026-11-14',
    createdAt,
    before,
    afterId: null,
    companionIds: [],
    savedAt: 500,
    ...more,
  })

  it('lists an expense’s refunds newest first', () => {
    const list = [record('a', 1), record('b', 3), record('c', 2), record('z', 9, { expenseId: 'other' })]
    expect(refundsOn(list, before.id).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('only the latest refund can be taken off, and only while the expense is unchanged since', () => {
    const older = record('a', 1, { savedAt: 400 })
    const latest = record('b', 2, { savedAt: 500 })
    const now = { ...before, total: 180_000, updatedAt: 500 }
    expect(canTakeOff(latest, [older, latest], [now])).toBe(true)
    expect(canTakeOff(older, [older, latest], [now])).toBe(false)
    expect(canTakeOff(latest, [older, latest], [{ ...now, updatedAt: 501 }])).toBe(false)
    expect(canTakeOff(latest, [older, latest], [])).toBe(false)
  })

  it('a full refund can be put back while its expense is still out', () => {
    const full = record('f', 5, { kind: 'remove', savedAt: 0 })
    expect(canTakeOff(full, [full], [])).toBe(true)
    expect(canTakeOff(full, [full], [before])).toBe(false)
  })

  it('lists expenses refunded in full by group, and loose ones (no group, or a group that is gone)', () => {
    const inGoa = record('g', 1, { kind: 'remove' })
    const loose = record('l', 2, { kind: 'remove', before: { ...before, id: 'x', groupId: null }, expenseId: 'x' })
    const orphan = record('o', 3, { kind: 'remove', before: { ...before, id: 'y', groupId: 'deleted' }, expenseId: 'y' })
    const part = record('p', 4)
    const all = [inGoa, loose, orphan, part]
    const groups = new Set(['goa'])
    expect(fullyRefunded(all, 'goa', groups).map((r) => r.id)).toEqual(['g'])
    expect(fullyRefunded(all, null, groups).map((r) => r.id)).toEqual(['o', 'l'])
    expect(fullyRefunded([], null, groups)).toEqual([])
  })

  it('puts an expense back in its own place', () => {
    const a = { ...before, id: 'a' }
    const b = { ...before, id: 'b' }
    const c = { ...before, id: 'c' }
    expect(placeExact([a, c], b, 'a')).toEqual([a, b, c])
    expect(placeExact([b, c], a, null)).toEqual([a, b, c])
    expect(placeExact([c], b, 'a')).toEqual([b, c])
    const edited = { ...b, total: 1 }
    expect(placeExact([a, edited, c], b, 'a')).toEqual([a, b, c])
  })
})
