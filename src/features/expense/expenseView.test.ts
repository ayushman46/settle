import { describe, expect, it } from 'vitest'
import { ME_ID, type BillSnapshot } from '../../domain/types'
import { makeExpense, makeGroup } from '../../share/testing'
import { EMPTY_META } from '../../types'
import { addedLine, billExtraLines, owingIds, primaryAction, standingPill } from './expenseView'

const goa = makeGroup()

describe('standingPill', () => {
  it('says what is still owed to you', () => {
    expect(standingPill(makeExpense(), 'You', [])).toEqual({ label: 'You’re owed ₹1,383', tone: 'positive', done: false })
  })

  it('says when it has all come back', () => {
    const all = makeExpense({ paidBack: { riya: 1, sam: 1, neha: 1 } })
    expect(standingPill(all, 'You', [])).toEqual({ label: 'All collected', tone: 'positive', done: true })
  })

  it('stays quiet when it was just you', () => {
    const solo = makeExpense({ participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 276_600 }, paidBack: {} })
    expect(standingPill(solo, 'You', [])).toBeNull()
  })

  it('says what you owe and when you have paid it back', () => {
    const theirs = makeExpense({ payerId: 'riya', paidBack: {} })
    expect(standingPill(theirs, 'Riya', [])).toEqual({ label: 'You owe Riya ₹691.50', tone: 'negative', done: false })
    const paid = makeExpense({ payerId: 'riya', paidBack: { [ME_ID]: 1 } })
    expect(standingPill(paid, 'Riya', [])).toEqual({ label: 'You paid Riya back', tone: 'positive', done: true })
  })

  it('says when you are not in it', () => {
    const notMine = makeExpense({
      payerId: 'riya',
      participants: [{ friendId: 'riya', input: null }, { friendId: 'sam', input: null }],
      shares: { riya: 100, sam: 100 },
    })
    expect(standingPill(notMine, 'Riya', [])).toEqual({ label: 'You’re not in this one', tone: 'neutral', done: false })
  })

  it('speaks in lent and borrowed for group expenses', () => {
    expect(standingPill(makeExpense({ groupId: 'g1' }), 'You', [goa])).toEqual({ label: 'You lent ₹2,074.50', tone: 'positive', done: false })
    expect(standingPill(makeExpense({ groupId: 'g1', payerId: 'riya' }), 'Riya', [goa])).toEqual({
      label: 'You borrowed ₹691.50',
      tone: 'negative',
      done: false,
    })
    const solo = makeExpense({ groupId: 'g1', participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 500 } })
    expect(standingPill(solo, 'You', [goa])).toBeNull()
  })
})

describe('primaryAction', () => {
  it('shares a pay link while friends still owe you', () => {
    expect(primaryAction(makeExpense(), [])).toEqual({ kind: 'share', payLink: true })
    expect(primaryAction(makeExpense({ paidBack: { riya: 1, sam: 1, neha: 1 } }), [])).toEqual({ kind: 'share', payLink: false })
  })

  it('pays the payer over UPI when you owe rupees', () => {
    expect(primaryAction(makeExpense({ payerId: 'riya', paidBack: {} }), [])).toEqual({ kind: 'pay', amount: 69_150 })
  })

  it('marks you paid when you owe another currency', () => {
    expect(primaryAction(makeExpense({ payerId: 'riya', paidBack: {}, currency: 'EUR' }), [])).toEqual({ kind: 'mark-paid', amount: 69_150 })
  })

  it('shares for the record once you have paid back', () => {
    expect(primaryAction(makeExpense({ payerId: 'riya', paidBack: { [ME_ID]: 1 } }), [])).toEqual({ kind: 'share', payLink: false })
  })

  it('settles group expenses in the group', () => {
    expect(primaryAction(makeExpense({ groupId: 'g1' }), [goa])).toEqual({ kind: 'group', group: goa })
    // In another currency it's settled person to person.
    expect(primaryAction(makeExpense({ groupId: 'g1', currency: 'USD' }), [goa])).toEqual({ kind: 'share', payLink: true })
  })
})

describe('owingIds', () => {
  it('lists who still owes the payer', () => {
    expect(owingIds(makeExpense())).toEqual(['sam', 'neha'])
    expect(owingIds(makeExpense({ shares: { [ME_ID]: 100, riya: 0, sam: 50 }, paidBack: {} }))).toEqual(['sam'])
  })
})

describe('billExtraLines', () => {
  const bill = (meta: Partial<BillSnapshot['meta']>): BillSnapshot => ({
    meta: { ...EMPTY_META, ...meta },
    items: [
      { id: 'a', name: 'Pizza', quantity: 1, amount: 60_000 },
      { id: 'b', name: 'Beer', quantity: 2, amount: 40_000 },
    ],
    assignments: {},
    warnings: [],
  })

  it('lists tax, service, tip and discount as printed', () => {
    const lines = billExtraLines({ total: 112_000, currency: 'INR', bill: bill({ tax: 5_000, serviceCharge: 10_000, tip: 2_000, discount: 5_000 }) })
    expect(lines).toEqual([
      { key: 'tax', label: 'Tax', amount: 5_000 },
      { key: 'service', label: 'Service charge', amount: 10_000 },
      { key: 'tip', label: 'Tip', amount: 2_000 },
      { key: 'discount', label: 'Discount', amount: -5_000 },
    ])
  })

  it('adds a round-off or unnamed charges so it adds up to what was paid', () => {
    expect(billExtraLines({ total: 105_040, currency: 'INR', bill: bill({ tax: 5_000 }) })).toEqual([
      { key: 'tax', label: 'Tax', amount: 5_000 },
      { key: 'other', label: 'Round-off', amount: 40 },
    ])
    expect(billExtraLines({ total: 110_000, currency: 'INR', bill: bill({}) })).toEqual([{ key: 'other', label: 'Other charges', amount: 10_000 }])
    expect(billExtraLines({ total: 90_000, currency: 'INR', bill: bill({}) })).toEqual([{ key: 'other', label: 'Other discounts', amount: -10_000 }])
  })

  it('has nothing to add for an exact bill or a plain split', () => {
    expect(billExtraLines({ total: 100_000, currency: 'INR', bill: bill({}) })).toEqual([])
    expect(billExtraLines({ total: 100_000, currency: 'INR', bill: null })).toEqual([])
  })
})

describe('addedLine', () => {
  const at = (y: number, m: number, d: number, h = 21, min = 41) => new Date(y, m, d, h, min).getTime()
  const now = at(2026, 9, 22, 12, 0)

  it('says when it was added and where from', () => {
    const line = addedLine({ createdAt: at(2026, 9, 18), updatedAt: at(2026, 9, 18), source: 'scan' }, now)
    expect(line).toMatch(/^Added .*18.* · from a scanned bill$/)
    expect(line).not.toMatch(/2026/)
  })

  it('names the year for older expenses and says when it last changed', () => {
    const line = addedLine({ createdAt: at(2025, 11, 30), updatedAt: at(2026, 0, 2), source: 'manual' }, now)
    expect(line).toMatch(/^Added .*2025.* · last changed .*2/)
  })

  it('ignores a change within a minute of adding it', () => {
    const created = at(2026, 9, 18)
    expect(addedLine({ createdAt: created, updatedAt: created + 30_000, source: 'describe' }, now)).toMatch(/^Added .* · with “Just say it”$/)
  })
})
