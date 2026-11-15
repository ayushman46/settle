import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, recordPartPayment, recordSettlement, saveExpense, setPaidBack, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import { booksNow, countOutside, deletePlan, finishPlan, fitPlan, payNextPart, payOffPlan, planOutside, planOwed, plansNow, planView, recordBetween, startPlan } from './actions'
import { owedBetween, partPaidSoFar, paymentsSince } from './between'
import { planLeft, planPaid, type KistPlan } from './engine'
import { kistStore, planById, runningPlanWith } from './store'
import { kistToday } from './today'

const START = new Date(2026, 10, 15, 12)
let clock = START.getTime()
/** Moves the clock on, so everything that happens has its own moment. */
function tick(minutes = 1): void {
  clock += minutes * 60_000
  vi.setSystemTime(new Date(clock))
}

let riya: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  clock = START.getTime()
  vi.setSystemTime(START)
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
})

afterEach(() => {
  vi.useRealTimers()
})

/** + Riya owes me, − I owe Riya. */
const net = (): number => netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')
const view = (plan: KistPlan, today = '2026-11-15') => planView(planById(plan.id) ?? plan, plansNow(), booksNow(), today)

/** I borrowed ₹6,000 from Riya (udhaar, outside any group). */
function borrow(amount = 600_000) {
  const loan = saveLoan({ direction: 'borrowed', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
  return loan
}

/** A group where Riya paid ₹12,000 for the two of us: I owe her ₹6,000 there. */
function goa() {
  const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
  saveExpense(draft({ title: 'Villa', total: 1_200_000, payerId: riya, groupId: group.id, participants: everyone(ME_ID, riya) }))
  tick()
  return group
}

function start(total = 600_000, count = 3, direction: 'pay' | 'receive' = 'pay'): KistPlan {
  const plan = startPlan({ friendId: riya, direction, currency: 'INR', every: 'month', total, count, first: '2026-12-01' })
  if (!plan) throw new Error('no plan')
  tick()
  return plan
}

describe('paying a part is one real payment', () => {
  it('pays part of an udhaar and ticks the part with exactly what was recorded', () => {
    const loan = borrow()
    const plan = start()
    expect(net()).toBe(-600_000)

    const change = payNextPart(plan.id, 'upi')
    expect(change?.amount).toBe(200_000)
    expect(net()).toBe(-400_000)
    expect(expensesStore.get().find((e) => e.id === loan.id)?.partPaid).toEqual({ [ME_ID]: 200_000 })
    const after = planById(plan.id)!
    expect(after.parts[0]).toMatchObject({ amount: 200_000, how: 'plan', paidOn: '2026-11-15', records: [{ kind: 'split', expenseId: loan.id, amount: 200_000 }] })
    expect(planPaid(after)).toBe(200_000)
    expect(planLeft(after)).toBe(400_000)
    // Its own payment is never taken for one made elsewhere.
    expect(planOutside(after, plansNow())).toBe(0)
    expect(view(plan)).toMatchObject({ drift: 'none', countable: 0, owed: 400_000, left: 400_000 })
  })

  it('Undo puts the records and the plan back exactly', () => {
    borrow()
    const plan = start()
    const expensesBefore = expensesStore.get()
    const change = payNextPart(plan.id, 'upi')!
    change.undo()
    expect(net()).toBe(-600_000)
    expect(expensesStore.get()).toEqual(expensesBefore)
    expect(planById(plan.id)).toEqual(plan)
  })

  it('in a shared group it records a payment in the group, and Undo takes it out', () => {
    const group = goa()
    const plan = start()
    const change = payNextPart(plan.id, 'cash')!
    const settlements = groupsStore.get().find((g) => g.id === group.id)!.settlements
    expect(settlements).toHaveLength(1)
    expect(settlements[0]).toMatchObject({ fromId: ME_ID, toId: riya, amount: 200_000, method: 'cash', date: '2026-11-15' })
    expect(planById(plan.id)!.parts[0]!.records).toEqual([{ kind: 'group', groupId: group.id, settlementId: settlements[0]!.id, amount: 200_000 }])
    expect(net()).toBe(-400_000)
    change.undo()
    expect(groupsStore.get().find((g) => g.id === group.id)!.settlements).toHaveLength(0)
    expect(net()).toBe(-600_000)
  })

  it('works the other way round: "Got this part" records the friend paying you', () => {
    saveLoan({ direction: 'lent', friendId: riya, amount: 900_000, currency: 'INR', what: 'cash', date: '2026-11-01' })
    tick()
    const plan = start(900_000, 3, 'receive')
    payNextPart(plan.id, 'other')
    expect(net()).toBe(600_000)
    expect(planPaid(planById(plan.id)!)).toBe(300_000)
  })

  it('three parts clear the whole amount, to the paisa', () => {
    borrow(1_000_050)
    const plan = start(1_000_050, 3)
    expect(plan.parts.map((p) => p.amount)).toEqual([333_300, 333_300, 333_450])
    for (let i = 0; i < 3; i += 1) {
      payNextPart(plan.id, 'upi')
      tick()
    }
    expect(net()).toBe(0)
    expect(view(plan)).toMatchObject({ state: 'done', paid: 1_000_050, left: 0 })
    expect(payNextPart(plan.id, 'upi')).toBeNull()
  })

  it('records nothing when nothing is owed', () => {
    const loan = borrow()
    const plan = start()
    setPaidBack(loan.id, ME_ID, true)
    expect(payNextPart(plan.id, 'upi')).toBeNull()
    expect(payOffPlan(plan.id, 'upi')).toBeNull()
    expect(planPaid(planById(plan.id)!)).toBe(0)
  })

  it('never records more than is owed: the last of it is paid, and the plan is finished', () => {
    const loan = borrow()
    const plan = start()
    recordPartPayment(loan.id, ME_ID, 500_000)
    tick()
    expect(view(plan)).toMatchObject({ drift: 'less', owed: 100_000, payNow: 100_000 })
    const change = payNextPart(plan.id, 'upi')!
    expect(change.amount).toBe(100_000)
    expect(net()).toBe(0)
    const after = planById(plan.id)!
    expect(after.parts[0]).toMatchObject({ amount: 100_000, how: 'plan' })
    expect(after.endedAt).not.toBeNull()
    expect(view(plan)).toMatchObject({ state: 'ended', paid: 100_000, left: 0 })
    change.undo()
    expect(net()).toBe(-100_000)
    expect(planById(plan.id)).toEqual(plan)
  })
})

describe('a payment made outside the plan', () => {
  it('a payment recorded in the group is offered as the next part, and counting it records nothing new', () => {
    const group = goa()
    const plan = start()
    payNextPart(plan.id, 'upi')
    tick()
    recordSettlement(group.id, { fromId: ME_ID, toId: riya, amount: 200_000, date: '2026-11-15', method: 'upi' })
    tick()
    expect(planOutside(planById(plan.id)!, plansNow())).toBe(200_000)
    expect(view(plan)).toMatchObject({ drift: 'less', owed: 200_000, left: 400_000, countable: 1, countAmount: 200_000 })

    const change = countOutside(plan.id, 1)!
    expect(change.amount).toBe(0)
    // Still the two payments that were really made: nothing was counted twice.
    expect(groupsStore.get().find((g) => g.id === group.id)!.settlements).toHaveLength(2)
    expect(net()).toBe(-200_000)
    expect(planById(plan.id)!.parts.map((p) => p.how)).toEqual(['plan', 'counted', null])
    expect(planOutside(planById(plan.id)!, plansNow())).toBe(0)
    expect(view(plan)).toMatchObject({ drift: 'none', countable: 0, owed: 200_000, left: 200_000, paid: 400_000 })

    change.undo()
    expect(planById(plan.id)!.parts.map((p) => p.how)).toEqual(['plan', null, null])
    expect(view(plan)).toMatchObject({ countable: 1 })
  })

  it('part of an udhaar paid back from its own page is seen too', () => {
    const loan = borrow()
    const plan = start()
    recordPartPayment(loan.id, ME_ID, 200_000)
    tick()
    expect(planOutside(planById(plan.id)!, plansNow())).toBe(200_000)
    expect(view(plan)).toMatchObject({ drift: 'less', countable: 1 })
  })

  it('what was paid before the plan started is not a payment since', () => {
    const loan = borrow(800_000)
    recordPartPayment(loan.id, ME_ID, 200_000)
    tick()
    const plan = start()
    expect(plan.paidBefore).toEqual({ [loan.id]: 200_000 })
    expect(planOutside(plan, plansNow())).toBe(0)
    expect(view(plan)).toMatchObject({ drift: 'none', countable: 0, owed: 600_000 })
  })

  it('a split settled in full before the plan started is not a payment since', () => {
    const old = saveExpense(draft({ title: 'Old dinner', total: 100_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    setPaidBack(old.id, ME_ID, true)
    tick()
    borrow()
    const plan = start()
    expect(planOutside(plan, plansNow())).toBe(0)
  })

  it('a payment that only cleared a new expense does not stand in for a part', () => {
    borrow()
    const plan = start()
    const lunch = saveExpense(draft({ title: 'Lunch', total: 400_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    tick()
    setPaidBack(lunch.id, ME_ID, true)
    tick()
    // ₹2,000 was paid elsewhere, but what is owed still matches the plan.
    expect(planOutside(planById(plan.id)!, plansNow())).toBe(200_000)
    expect(view(plan)).toMatchObject({ drift: 'none', countable: 0, owed: 600_000, left: 600_000 })
  })

  it('a smaller payment elsewhere is not counted: the plan says the numbers and can be fitted', () => {
    const loan = borrow()
    const plan = start()
    recordPartPayment(loan.id, ME_ID, 50_000)
    tick()
    expect(view(plan)).toMatchObject({ drift: 'less', owed: 550_000, left: 600_000, countable: 0 })
    const change = fitPlan(plan.id)!
    expect(planById(plan.id)!.parts.map((p) => p.amount)).toEqual([183_300, 183_300, 183_400])
    expect(view(plan)).toMatchObject({ drift: 'none', left: 550_000 })
    change.undo()
    expect(planById(plan.id)).toEqual(plan)
  })
})

describe('when what is owed changes', () => {
  it('a new expense: the plan says what is owed and what it covers, and can take the rest in', () => {
    borrow()
    const plan = start()
    saveExpense(draft({ title: 'Cab', total: 280_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    tick()
    expect(view(plan)).toMatchObject({ drift: 'more', owed: 740_000, left: 600_000, gap: 140_000, payNow: 200_000 })
    fitPlan(plan.id)
    expect(planById(plan.id)!.parts.map((p) => p.amount)).toEqual([246_600, 246_600, 246_800])
    expect(view(plan)).toMatchObject({ drift: 'none', left: 740_000 })
  })

  it('everything settled elsewhere: nothing is asked for, and the plan can be finished', () => {
    const loan = borrow()
    const plan = start()
    payNextPart(plan.id, 'upi')
    tick()
    setPaidBack(loan.id, ME_ID, true)
    tick()
    expect(view(plan)).toMatchObject({ drift: 'clear', owed: 0, payNow: 0, payOff: 0, countable: 2 })
    const change = finishPlan(plan.id)!
    expect(view(plan)).toMatchObject({ state: 'ended', paid: 200_000 })
    expect(runningPlanWith(riya)).toBeNull()
    change.undo()
    expect(runningPlanWith(riya)?.id).toBe(plan.id)
  })
})

describe('paying it all off', () => {
  it('records the rest in one payment and ticks every part; Undo puts it all back', () => {
    const group = goa()
    const plan = start()
    payNextPart(plan.id, 'upi')
    tick()
    const before = planById(plan.id)!
    const change = payOffPlan(plan.id, 'upi')!
    expect(change.amount).toBe(400_000)
    expect(net()).toBe(0)
    const settlements = groupsStore.get().find((g) => g.id === group.id)!.settlements
    expect(settlements.map((s) => s.amount)).toEqual([200_000, 400_000])
    const after = planById(plan.id)!
    expect(after.parts.every((p) => p.paidAt !== null)).toBe(true)
    expect(after.parts.map((p) => p.records.length)).toEqual([1, 1, 0])
    expect(planPaid(after)).toBe(600_000)
    change.undo()
    expect(net()).toBe(-400_000)
    expect(planById(plan.id)).toEqual(before)
  })

  it('pays only what is still owed when that is less, and the parts add up to it', () => {
    const loan = borrow()
    const plan = start()
    recordPartPayment(loan.id, ME_ID, 250_050)
    tick()
    const change = payOffPlan(plan.id, 'upi')!
    expect(change.amount).toBe(349_950)
    expect(net()).toBe(0)
    const after = planById(plan.id)!
    expect(after.parts.map((p) => p.amount)).toEqual([116_600, 116_600, 116_750])
    expect(planPaid(after)).toBe(349_950)
  })
})

describe('reading the books', () => {
  it('reports exactly what one payment changed, across a group and splits', () => {
    const group = goa()
    const loan = borrow(300_000)
    // ₹9,000 owed in all: ₹6,000 in the group, ₹3,000 udhaar. Pay ₹7,000.
    const done = recordBetween(riya, 'pay', 700_000, 'INR', 'upi', '2026-11-15')
    expect(done.amount).toBe(700_000)
    expect(done.records).toHaveLength(2)
    expect(done.records).toContainEqual({ kind: 'split', expenseId: loan.id, amount: 100_000 })
    expect(done.records.find((r) => r.kind === 'group')).toMatchObject({ groupId: group.id, amount: 600_000 })
    expect(owedBetween(riya, 'pay', 'INR', booksNow())).toBe(200_000)
    done.undo()
    expect(owedBetween(riya, 'pay', 'INR', booksNow())).toBe(900_000)
  })

  it('owed is never below zero, and is read per direction and per currency', () => {
    borrow()
    expect(owedBetween(riya, 'pay', 'INR', booksNow())).toBe(600_000)
    expect(owedBetween(riya, 'receive', 'INR', booksNow())).toBe(0)
    expect(owedBetween(riya, 'pay', 'USD', booksNow())).toBe(0)
  })

  it('knows which shares were part paid already', () => {
    const loan = borrow()
    expect(partPaidSoFar(booksNow(), ME_ID, riya, 'INR')).toEqual({})
    recordPartPayment(loan.id, ME_ID, 120_000)
    expect(partPaidSoFar(booksNow(), ME_ID, riya, 'INR')).toEqual({ [loan.id]: 120_000 })
    expect(partPaidSoFar(booksNow(), riya, ME_ID, 'INR')).toEqual({})
  })

  it('lists payments since a moment with where and when', () => {
    const group = goa()
    const since = Date.now()
    tick()
    recordSettlement(group.id, { fromId: ME_ID, toId: riya, amount: 150_000, date: '2026-11-14', method: 'upi' })
    // The other way round is not a payment from me.
    recordSettlement(group.id, { fromId: riya, toId: ME_ID, amount: 10_000, date: '2026-11-14', method: 'upi' })
    const seen = paymentsSince(booksNow(), ME_ID, riya, 'INR', { since, paidBefore: {} })
    expect(seen).toEqual([{ amount: 150_000, on: '2026-11-14', where: 'Goa', kind: 'group' }])
    expect(paymentsSince(booksNow(), ME_ID, riya, 'INR', { since: Date.now() + 1, paidBefore: {} })).toEqual([])
  })
})

describe('plans on this phone', () => {
  it('keeps one running plan per friend, and deleting a plan leaves the payments', () => {
    borrow()
    const plan = start()
    expect(runningPlanWith(riya)?.id).toBe(plan.id)
    payNextPart(plan.id, 'upi')
    const undo = deletePlan(plan.id)!
    expect(plansNow()).toEqual([])
    expect(net()).toBe(-400_000)
    undo()
    expect(planPaid(planById(plan.id)!)).toBe(200_000)
    expect(deletePlan('nope')).toBeNull()
  })

  it('does not start a plan from an amount or a date that makes no sense', () => {
    expect(startPlan({ friendId: riya, direction: 'pay', currency: 'INR', every: 'month', total: 0, count: 3, first: '2026-12-01' })).toBeNull()
    expect(startPlan({ friendId: riya, direction: 'pay', currency: 'INR', every: 'month', total: 600_000, count: 3, first: 'someday' })).toBeNull()
    expect(kistStore.get().plans).toEqual([])
  })

  it('planOwed follows the records', () => {
    const loan = borrow()
    const plan = start()
    expect(planOwed(plan)).toBe(600_000)
    recordPartPayment(loan.id, ME_ID, 100_000)
    expect(planOwed(plan)).toBe(500_000)
  })
})

describe('kistToday', () => {
  it('has nothing before the date', () => {
    borrow()
    start()
    expect(kistToday(new Date(2026, 10, 30, 9))).toEqual([])
  })

  it('asks for the part on its date, with the amount', () => {
    borrow()
    const plan = start()
    expect(kistToday(new Date(2026, 11, 1, 9))).toEqual([
      { id: `kist:${plan.id}`, title: 'Kist to Riya is due', body: '₹2,000, part 1 of 3', path: `/app/kist/${plan.id}`, amount: 200_000, currency: 'INR' },
    ])
  })

  it('says how late it is, and how many parts when more than one is due', () => {
    borrow()
    start()
    expect(kistToday(new Date(2026, 11, 4, 9))[0]?.body).toBe('₹2,000, part 1 of 3, 3 days late')
    expect(kistToday(new Date(2027, 0, 2, 9))[0]).toMatchObject({ body: '₹4,000: 2 parts are due, the oldest 32 days late', amount: 400_000 })
  })

  it('names the friend when the money comes to you', () => {
    saveLoan({ direction: 'lent', friendId: riya, amount: 600_000, currency: 'INR', what: 'cash', date: '2026-11-01' })
    tick()
    start(600_000, 3, 'receive')
    expect(kistToday(new Date(2026, 11, 1, 9))[0]?.title).toBe('Riya’s kist is due')
  })

  it('asks for nothing once nothing is owed, and never for more than is owed', () => {
    const loan = borrow()
    start()
    recordPartPayment(loan.id, ME_ID, 450_000)
    expect(kistToday(new Date(2026, 11, 1, 9))[0]).toMatchObject({ amount: 150_000, body: '₹1,500, part 1 of 3' })
    setPaidBack(loan.id, ME_ID, true)
    expect(kistToday(new Date(2026, 11, 1, 9))).toEqual([])
  })
})
