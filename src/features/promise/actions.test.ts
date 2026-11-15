import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { addFriend, createGroup, recordPartPayment, recordSettlement, saveExpense, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { booksNow, recordBetween } from '../kist/actions'
import type { PromiseEntry } from './engine'
import { factsOf, notePromise, promiseStats, promiseViews, removePromise, setOutcome, sweepPromises } from './actions'
import { MAX_PROMISES, promiseSchema, promisesNow, promiseStore, putPromise } from './store'
import { promiseToday } from './today'

/** Sunday 15 Nov 2026, noon. */
const START = new Date(2026, 10, 15, 12)
let clock = START.getTime()
function tick(minutes = 1): void {
  clock += minutes * 60_000
  vi.setSystemTime(new Date(clock))
}
/** Jumps to noon on a day. */
function goTo(year: number, month: number, day: number): Date {
  clock = new Date(year, month - 1, day, 12).getTime()
  vi.setSystemTime(new Date(clock))
  return new Date(clock)
}
const todayIs = (): string => {
  const d = new Date(clock)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

/** Riya owes me ₹2,000 (udhaar). */
function lend(amount = 200_000) {
  const loan = saveLoan({ direction: 'lent', friendId: riya, amount, currency: 'INR', what: 'cash', date: '2026-11-01' })
  tick()
  return loan
}

/** Riya promises ₹500 by Friday 20 Nov. */
function note(amount = 50_000, due = '2026-11-20', direction: 'pay' | 'receive' = 'receive') {
  const noted = notePromise({ friendId: riya, direction, currency: 'INR', amount, due }, new Date(clock))
  if (!noted) throw new Error('not noted')
  tick()
  return noted
}

const stateOf = (id: string): string | undefined => promiseViews(promisesNow(), booksNow(), todayIs()).find((v) => v.promise.id === id)?.state

describe('noting a promise', () => {
  it('measures it against what is owed at that moment', () => {
    const loan = lend()
    recordPartPayment(loan.id, riya, 30_000)
    tick()
    const { promise } = note()
    expect(promise).toMatchObject({ friendId: riya, direction: 'receive', currency: 'INR', amount: 50_000, owedThen: 170_000, due: '2026-11-20', outcome: null })
    // What was paid before the promise is not a payment towards it.
    expect(promise.paidBefore).toEqual({ [loan.id]: 30_000 })
    expect(factsOf(promise)).toEqual({ owedNow: 170_000, paidByDue: 0, paidLate: 0 })
    expect(stateOf(promise.id)).toBe('open')
  })

  it('a new promise with the same friend takes the open one’s place, and Undo puts the old one back', () => {
    lend()
    const first = note()
    const second = note(80_000, '2026-12-01')
    expect(second.replaced?.id).toBe(first.promise.id)
    expect(promisesNow().map((p) => p.id)).toEqual([second.promise.id])
    second.undo()
    expect(promisesNow()).toEqual([first.promise])
  })

  it('does not note an amount or a date that makes no sense', () => {
    expect(notePromise({ friendId: riya, direction: 'receive', currency: 'INR', amount: 0, due: '2026-11-20' })).toBeNull()
    expect(notePromise({ friendId: riya, direction: 'receive', currency: 'INR', amount: 50_000, due: 'Friday' })).toBeNull()
    expect(promisesNow()).toEqual([])
  })

  it('can be removed, with Undo', () => {
    lend()
    const { promise } = note()
    const undo = removePromise(promise.id)!
    expect(promisesNow()).toEqual([])
    expect(promiseStats(riya)).toEqual({ kept: 0, broken: 0, total: 0, open: 0 })
    undo()
    expect(promisesNow()).toEqual([promise])
    expect(removePromise('nope')).toBeNull()
  })
})

describe('kept', () => {
  it('is kept the moment the promised amount is recorded, and open again if that payment is undone', () => {
    lend()
    const { promise } = note()
    const paid = recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-16')
    expect(factsOf(promise)).toEqual({ owedNow: 150_000, paidByDue: 50_000, paidLate: 0 })
    expect(stateOf(promise.id)).toBe('kept')
    // Its date has not passed: nothing is closed yet.
    expect(sweepPromises(new Date(clock))).toBe(0)
    paid.undo()
    expect(stateOf(promise.id)).toBe('open')
  })

  it('stays kept after its date, and a new expense later does not break it', () => {
    lend()
    const { promise } = note()
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-18')
    goTo(2026, 11, 21)
    expect(sweepPromises(new Date(clock))).toBe(1)
    expect(promisesNow()[0]).toMatchObject({ id: promise.id, outcome: 'kept', closedAt: clock })
    saveExpense(draft({ title: 'Dinner', total: 300_000, participants: everyone(ME_ID, riya) }))
    expect(stateOf(promise.id)).toBe('kept')
    expect(promiseStats(riya, new Date(clock))).toEqual({ kept: 1, broken: 0, total: 1, open: 0 })
  })

  it('a payment in a shared group counts, by the date it was paid on', () => {
    const group = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Rent', total: 400_000, groupId: group.id, participants: everyone(ME_ID, riya) }))
    tick()
    const { promise } = note(100_000)
    recordSettlement(group.id, { fromId: riya, toId: ME_ID, amount: 100_000, date: '2026-11-19', method: 'upi' })
    expect(factsOf(promise)).toEqual({ owedNow: 100_000, paidByDue: 100_000, paidLate: 0 })
    expect(stateOf(promise.id)).toBe('kept')
  })

  it('a new expense before the payment does not hide a kept promise', () => {
    lend()
    const { promise } = note()
    saveExpense(draft({ title: 'Dinner', total: 300_000, participants: everyone(ME_ID, riya) }))
    tick()
    expect(stateOf(promise.id)).toBe('open')
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-17')
    // More is owed now than when it was made, and still the ₹500 came.
    expect(factsOf(promise).owedNow).toBe(300_000)
    expect(stateOf(promise.id)).toBe('kept')
  })

  it('works for your own promise too', () => {
    saveLoan({ direction: 'borrowed', friendId: riya, amount: 120_000, currency: 'INR', what: 'cash', date: '2026-11-01' })
    tick()
    const { promise } = note(120_000, '2026-11-20', 'pay')
    expect(promise.owedThen).toBe(120_000)
    recordBetween(riya, 'pay', 120_000, 'INR', 'upi', '2026-11-20')
    expect(stateOf(promise.id)).toBe('kept')
  })
})

describe('broken', () => {
  it('is broken once its date has passed unpaid, and paying later does not change that', () => {
    lend()
    const { promise } = note()
    goTo(2026, 11, 20)
    expect(stateOf(promise.id)).toBe('open')
    expect(sweepPromises(new Date(clock))).toBe(0)
    goTo(2026, 11, 21)
    expect(stateOf(promise.id)).toBe('broken')
    expect(sweepPromises(new Date(clock))).toBe(1)
    expect(promisesNow()[0]).toMatchObject({ outcome: 'broken', closedAt: clock })
    tick()
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi')
    expect(stateOf(promise.id)).toBe('broken')
    expect(promiseStats(riya, new Date(clock))).toEqual({ kept: 0, broken: 1, total: 1, open: 0 })
    // Nothing is left to chase, though.
    expect(promiseViews(promisesNow(), booksNow(), todayIs())[0]).toMatchObject({ unmet: 0, payable: 0 })
  })

  it('part of it is not enough', () => {
    lend()
    const { promise } = note()
    recordBetween(riya, 'receive', 20_000, 'INR', 'upi', '2026-11-18')
    goTo(2026, 11, 22)
    expect(promiseViews(promisesNow(), booksNow(), todayIs())[0]).toMatchObject({ state: 'broken', overdue: 2, unmet: 30_000, payable: 30_000 })
    expect(stateOf(promise.id)).toBe('broken')
  })

  it('a payment dated after its date does not keep it, even when nothing closed it in between', () => {
    const group = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Rent', total: 400_000, groupId: group.id, participants: everyone(ME_ID, riya) }))
    tick()
    const { promise } = note(100_000)
    goTo(2026, 11, 23)
    recordSettlement(group.id, { fromId: riya, toId: ME_ID, amount: 100_000, date: '2026-11-23', method: 'upi' })
    expect(factsOf(promise)).toEqual({ owedNow: 100_000, paidByDue: 0, paidLate: 100_000 })
    expect(stateOf(promise.id)).toBe('broken')
  })

  it('the person can say it was kept after all (paid on time, written down late), with Undo', () => {
    lend()
    const { promise } = note()
    goTo(2026, 11, 21)
    sweepPromises(new Date(clock))
    const undo = setOutcome(promise.id, 'kept')!
    expect(promiseStats(riya, new Date(clock))).toMatchObject({ kept: 1, broken: 0 })
    undo()
    expect(promiseStats(riya, new Date(clock))).toMatchObject({ kept: 0, broken: 1 })
    expect(setOutcome(promise.id, 'broken')).toBeNull()
    expect(setOutcome('nope', 'kept')).toBeNull()
  })

  it('counts each friend’s promises: kept 1 of 2', () => {
    lend(500_000)
    note(50_000, '2026-11-16')
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-16')
    goTo(2026, 11, 17)
    sweepPromises(new Date(clock))
    note(100_000, '2026-11-18')
    goTo(2026, 11, 19)
    note(100_000, '2026-11-25')
    expect(promiseStats(riya, new Date(clock))).toEqual({ kept: 1, broken: 1, total: 2, open: 1 })
    const sam = addFriend({ name: 'Sam' }).id
    expect(promiseStats(sam)).toEqual({ kept: 0, broken: 0, total: 0, open: 0 })
  })
})

describe('promiseToday', () => {
  it('has nothing when there is no promise, or none due today', () => {
    expect(promiseToday(new Date(clock))).toEqual([])
    lend()
    note()
    expect(promiseToday(new Date(clock))).toEqual([])
  })

  it('theirs, on its day: ask them', () => {
    lend()
    const { promise } = note()
    expect(promiseToday(goTo(2026, 11, 20))).toEqual([
      { id: `promise:${promise.id}`, title: 'Riya promised to pay today', body: '₹500 to come. Ask Riya if it hasn’t.', path: '/app/promises', amount: 50_000, currency: 'INR' },
    ])
  })

  it('yours, on its day: with the amount still to pay', () => {
    saveLoan({ direction: 'borrowed', friendId: riya, amount: 120_000, currency: 'INR', what: 'cash', date: '2026-11-01' })
    tick()
    note(100_000, '2026-11-20', 'pay')
    recordBetween(riya, 'pay', 40_000, 'INR', 'upi', '2026-11-16')
    expect(promiseToday(goTo(2026, 11, 20))[0]).toMatchObject({
      title: 'Your promise to Riya is due today',
      body: '₹600 to pay. Pay it today and the promise is kept.',
      amount: 60_000,
    })
  })

  it('asks for nothing once it is kept', () => {
    lend()
    note()
    recordBetween(riya, 'receive', 50_000, 'INR', 'upi', '2026-11-16')
    expect(promiseToday(goTo(2026, 11, 20))).toEqual([])
  })

  it('closes a promise whose date has passed the first time it is asked, without writing while it is being asked', async () => {
    lend()
    const { promise } = note()
    const now = goTo(2026, 11, 21)
    expect(promiseToday(now)).toEqual([])
    expect(promisesNow()[0]?.outcome).toBeNull()
    await Promise.resolve()
    expect(promisesNow()[0]).toMatchObject({ id: promise.id, outcome: 'broken' })
  })
})

describe('what is kept on this phone', () => {
  const good = (i: number, more: Partial<PromiseEntry> = {}): PromiseEntry => ({
    id: `p${i}`,
    friendId: 'riya',
    direction: 'receive',
    currency: 'INR',
    amount: 50_000,
    owedThen: 200_000,
    due: '2026-11-20',
    createdAt: i,
    paidBefore: {},
    outcome: null,
    closedAt: null,
    ...more,
  })

  it('drops what it cannot read and keeps the rest', () => {
    const parsed = z.parse(promiseSchema, {
      promises: [good(1), { id: 'x', amount: -5 }, 'junk', null, good(2, { due: '2026-02-30' }), good(1, { amount: 9 }), { ...good(3), outcome: 'maybe', owedThen: 'lots', paidBefore: { a: 5, b: -1, c: 'x' } }],
    })
    expect(parsed.promises.map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(parsed.promises[0]?.amount).toBe(50_000)
    expect(parsed.promises[1]).toMatchObject({ outcome: null, owedThen: 0, paidBefore: { a: 5 } })
    expect(z.parse(promiseSchema, { promises: 'nope' })).toEqual({ promises: [] })
  })

  it('keeps at most a set number, the open ones before the oldest closed ones', () => {
    for (let i = 0; i < MAX_PROMISES; i += 1) putPromise(good(i + 10, { outcome: 'kept', closedAt: 1 }))
    putPromise(good(5))
    const all = promiseStore.get().promises
    expect(all).toHaveLength(MAX_PROMISES)
    expect(all.some((p) => p.id === 'p5')).toBe(true)
    expect(all.some((p) => p.id === 'p10')).toBe(false)
  })
})
