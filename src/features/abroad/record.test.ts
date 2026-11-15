import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, STORAGE_KEYS, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import { recordAbroadPaid, type AbroadPaidInput } from './record'
import { abroadFor, abroadStore, clearAbroad, logSent, MAX_ABROAD_SENT, removeSent, setAbroad, type AbroadSent } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string

const net = (currency = 'INR'): number => netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), currency)
const input = (patch: Partial<AbroadPaidInput> = {}): AbroadPaidInput => ({
  friendId: riya,
  currency: 'INR',
  settled: 400_000,
  cost: 400_000,
  theirCurrency: 'USD',
  rate: '0.0125',
  date: '2026-11-14',
  ...patch,
})

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
})

/** You owe Riya ₹4,000 on a split she paid. */
function iOweRiya(): void {
  saveExpense(draft({ title: 'Flights', total: 800_000, payerId: riya, participants: everyone(ME_ID, riya) }))
}

describe('recordAbroadPaid', () => {
  it('clears what you owed, keeps what it cost, and Undo puts everything back', () => {
    iOweRiya()
    expect(net()).toBe(-400_000)
    const before = expensesStore.get()

    const paid = recordAbroadPaid(input({ cost: 408_500 }), 5_000)
    expect(net()).toBe(0)
    expect(paid?.left).toBe(0)
    expect(paid?.sent).toMatchObject({
      friendId: riya,
      settled: 400_000,
      cost: 408_500,
      currency: 'INR',
      theirAmount: 5000,
      theirCurrency: 'USD',
      date: '2026-11-14',
      createdAt: 5_000,
    })
    expect(abroadStore.get().sent).toEqual([paid?.sent])

    paid?.undo()
    expect(net()).toBe(-400_000)
    expect(abroadStore.get().sent).toEqual([])
    expect(expensesStore.get().map((e) => [e.id, e.paidBack, e.partPaid])).toEqual(before.map((e) => [e.id, e.paidBack, e.partPaid]))
  })

  it('a part leaves the rest owed, and the amount in their currency is for the part', () => {
    iOweRiya()
    const paid = recordAbroadPaid(input({ settled: 100_000, cost: 100_000 }))
    expect(net()).toBe(-300_000)
    expect(paid?.left).toBe(300_000)
    expect(paid?.sent).toMatchObject({ settled: 100_000, cost: 100_000, theirAmount: 1250 })
    paid?.undo()
    expect(net()).toBe(-400_000)
  })

  it('never clears more than is owed', () => {
    iOweRiya()
    const paid = recordAbroadPaid(input({ settled: 999_999, cost: 999_999 }))
    expect(paid?.sent.settled).toBe(400_000)
    expect(net()).toBe(0)
  })

  it('in a group it is a real payment, marked “Other”', () => {
    const trip = createGroup({ name: 'NYC', emoji: '🗽', kind: 'trip', currency: 'INR', memberIds: [riya] })
    saveExpense(draft({ groupId: trip.id, title: 'Hotel', total: 800_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const paid = recordAbroadPaid(input())
    const payments = groupsStore.get().find((g) => g.id === trip.id)?.settlements ?? []
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ fromId: ME_ID, toId: riya, amount: 400_000, method: 'other', date: '2026-11-14' })
    paid?.undo()
    expect(groupsStore.get().find((g) => g.id === trip.id)?.settlements).toEqual([])
  })

  it('without a rate the cost is still kept; the amount in their currency is left unknown', () => {
    iOweRiya()
    expect(recordAbroadPaid(input({ rate: null }))?.sent.theirAmount).toBeNull()
  })

  it('nothing owed to them (even, or they owe you): nothing is recorded', () => {
    expect(recordAbroadPaid(input())).toBeNull()
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    const before = expensesStore.get()
    expect(recordAbroadPaid(input())).toBeNull()
    expect(recordAbroadPaid(input({ settled: 0 }))).toBeNull()
    expect(expensesStore.get()).toEqual(before)
    expect(abroadStore.get().sent).toEqual([])
  })

  it('a due in another currency is settled in that currency', () => {
    saveExpense(draft({ title: 'Museum', currency: 'USD', total: 4_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    const paid = recordAbroadPaid(input({ currency: 'USD', settled: 2_000, cost: 2_000, rate: null }))
    expect(paid?.sent).toMatchObject({ currency: 'USD', settled: 2_000, theirAmount: 2_000 })
    expect(net('USD')).toBe(0)
  })
})

describe('abroadStore', () => {
  it('saves, replaces and forgets a friend’s set-up; forgetting returns it for Undo', () => {
    expect(abroadFor(riya)).toBeNull()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    expect(abroadFor(riya)).toEqual({ currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    setAbroad(riya, { currency: 'AED', via: 'other', handle: 'Bank transfer' })
    expect(abroadFor(riya)).toEqual({ currency: 'AED', via: 'other', handle: 'Bank transfer' })
    const had = clearAbroad(riya)
    expect(had).toEqual({ currency: 'AED', via: 'other', handle: 'Bank transfer' })
    expect(abroadFor(riya)).toBeNull()
    expect(clearAbroad(riya)).toBeNull()
  })

  it('ignores a set-up it can’t read', () => {
    setAbroad(riya, { currency: 'usd', via: 'paypal', handle: 'x' })
    setAbroad('', { currency: 'USD', via: 'paypal', handle: 'x' })
    expect(abroadStore.get().friends).toEqual({})
  })

  it('reads what it can from storage and drops the rest, one entry at a time', () => {
    const sent: AbroadSent = {
      id: 's1',
      friendId: 'f1',
      settled: 400_000,
      cost: 408_500,
      currency: 'INR',
      theirAmount: 5000,
      theirCurrency: 'USD',
      date: '2026-11-14',
      createdAt: 10,
    }
    window.localStorage.setItem(
      STORAGE_KEYS.abroad,
      JSON.stringify({
        v: 1,
        data: {
          friends: {
            f1: { currency: 'USD', via: 'paypal', handle: 'riyasharma' },
            f2: { currency: 'dollars', via: 'paypal', handle: 'x' },
            f3: 7,
            f4: { currency: 'GBP', via: 'carrier-pigeon', handle: 42 },
          },
          sent: [sent, null, { ...sent, id: 's2', settled: 0 }, { ...sent, id: 's3', date: 'soon' }, { ...sent, id: 's4', createdAt: 20, theirAmount: 'lots' }, { ...sent }],
        },
      }),
    )
    abroadStore.reload()
    expect(abroadStore.get().friends).toEqual({
      f1: { currency: 'USD', via: 'paypal', handle: 'riyasharma' },
      // An unknown service is read as "other" with no note; the currency is still good.
      f4: { currency: 'GBP', via: 'other', handle: '' },
    })
    expect(abroadStore.get().sent.map((s) => [s.id, s.theirAmount])).toEqual([
      ['s4', null],
      ['s1', 5000],
    ])
  })

  it('starts empty from junk', () => {
    window.localStorage.setItem(STORAGE_KEYS.abroad, JSON.stringify({ v: 1, data: { friends: [1, 2], sent: 'no' } }))
    abroadStore.reload()
    expect(abroadStore.get()).toEqual({ friends: {}, sent: [] })
  })

  it('keeps the newest payments up to the cap', () => {
    const base: AbroadSent = { id: 'x', friendId: 'f1', settled: 100, cost: 100, currency: 'INR', theirAmount: null, theirCurrency: 'USD', date: '2026-11-14', createdAt: 0 }
    for (let i = 0; i < MAX_ABROAD_SENT + 3; i++) logSent({ ...base, id: `s${i}`, createdAt: i })
    expect(abroadStore.get().sent).toHaveLength(MAX_ABROAD_SENT)
    expect(abroadStore.get().sent[0]?.id).toBe(`s${MAX_ABROAD_SENT + 2}`)
    logSent({ ...base, id: 'bad', cost: -1 })
    expect(abroadStore.get().sent.some((s) => s.id === 'bad')).toBe(false)
    removeSent(`s${MAX_ABROAD_SENT + 2}`)
    removeSent('never-there')
    expect(abroadStore.get().sent).toHaveLength(MAX_ABROAD_SENT - 1)
  })
})
