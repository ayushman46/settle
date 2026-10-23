/**
 * Delivery-app fees on the bill being split (spec 08 §3): reducer actions and repairs, the
 * session store on disk, selectors (fees in the computed total and the breakdown), and the round
 * trip through a saved expense.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFriend, expensesStore, resetDataForTests, saveExpense } from '../data'
import { ME_ID } from '../domain/types'
import { computeSplit } from '../lib/split'
import { billExpenseDraft, billSessionFromExpense } from '../features/bill/billExpense'
import { EMPTY_META, type BillFee, type BillItem, type Person, type Session } from '../types'
import { parseSession } from './persist'
import { createSession, MAX_FEES, reducer, repairSession, type Action } from './reducer'
import { billBreakdown, computedBillTotal, defaultPaid, feesTotal } from './selectors'

const item = (id: string, amount: number): BillItem => ({ id, name: id, quantity: 1, amount })
const person = (id: string): Person => ({ id, name: id.toUpperCase(), color: 0 })
const fee = (id: string, amount: number, kind: BillFee['kind'] = 'delivery', label = 'Delivery fee'): BillFee => ({ id, kind, label, amount })

function base(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    id: 'sess',
    step: 'review',
    source: 'scan',
    items: [item('biryani', 34900), item('pbm', 28900)],
    people: [person('riya'), person('sam')],
    ...overrides,
  }
}

const run = (state: Session, ...actions: Action[]): Session => actions.reduce(reducer, state)

describe('reducer — fees', () => {
  it('adds, updates and removes fees, cleaning each', () => {
    let s = run(base(), { type: 'addFee', fee: fee('f1', 3500) }, { type: 'addFee', fee: { id: 'f2', kind: 'rain' as never, label: '  Rain   fee ', amount: 2000.4 } })
    expect(s.meta.fees).toEqual([fee('f1', 3500), { id: 'f2', kind: 'other', label: 'Rain fee', amount: 2000 }])
    s = run(s, { type: 'updateFee', fee: { ...fee('f2', 2500), kind: 'surge', label: 'Rain fee' } })
    expect(s.meta.fees?.[1]).toEqual({ id: 'f2', kind: 'surge', label: 'Rain fee', amount: 2500 })
    s = run(s, { type: 'removeFee', feeId: 'f1' }, { type: 'removeFee', feeId: 'f2' })
    expect(Object.hasOwn(s.meta, 'fees')).toBe(false)
  })

  it('returns the same session when nothing changes', () => {
    const s = run(base(), { type: 'addFee', fee: fee('f1', 3500) })
    expect(reducer(s, { type: 'addFee', fee: fee('f1', 9999) })).toBe(s) // same id
    expect(reducer(s, { type: 'addFee', fee: fee('f9', 0) })).toBe(s) // nothing to add
    expect(reducer(s, { type: 'addFee', fee: fee('', 100) })).toBe(s)
    expect(reducer(s, { type: 'updateFee', fee: fee('f1', 3500) })).toBe(s)
    expect(reducer(s, { type: 'updateFee', fee: fee('nope', 100) })).toBe(s)
    expect(reducer(s, { type: 'removeFee', feeId: 'nope' })).toBe(s)
    expect(reducer(s, { type: 'setFeeSplit', feeSplit: 'proportional' })).toBe(s)
    expect(reducer(s, { type: 'setFeeSplit', feeSplit: 'half' as never })).toBe(s)
  })

  it('stops at 15 fees', () => {
    let s = base()
    for (let i = 0; i < MAX_FEES + 3; i++) s = reducer(s, { type: 'addFee', fee: fee(`f${i}`, 100) })
    expect(s.meta.fees).toHaveLength(MAX_FEES)
  })

  it('sets how fees are shared', () => {
    const s = run(base(), { type: 'setFeeSplit', feeSplit: 'equal' })
    expect(s.feeSplit).toBe('equal')
    expect(run(s, { type: 'setFeeSplit', feeSplit: 'proportional' }).feeSplit).toBe('proportional')
  })

  it('a scanned bill with fees shares them equally by default; others by what each had', () => {
    const fees = [fee('f1', 3500), fee('f2', 1000, 'platform', 'Platform fee')]
    const scanned = reducer(base({ feeSplit: 'proportional' }), { type: 'loadBill', source: 'scan', currency: 'INR', meta: { ...EMPTY_META, fees }, items: [item('a', 100)], warnings: [] })
    expect(scanned.meta.fees).toEqual(fees)
    expect(scanned.feeSplit).toBe('equal')
    const manual = reducer(base({ feeSplit: 'equal' }), { type: 'loadBill', source: 'manual', currency: 'INR', meta: { ...EMPTY_META, fees }, items: [], warnings: [] })
    expect(manual.feeSplit).toBeUndefined()
    const noFees = reducer(base({ feeSplit: 'equal' }), { type: 'loadBill', source: 'scan', currency: 'INR', meta: { ...EMPTY_META }, items: [], warnings: [] })
    expect(noFees.feeSplit).toBeUndefined()
    expect(Object.hasOwn(noFees.meta, 'fees')).toBe(false)
  })

  it('rescales fees with the currency (dropping ones that round to nothing)', () => {
    const s = run(base(), { type: 'addFee', fee: fee('f1', 3550) }, { type: 'addFee', fee: fee('f2', 40, 'tip', 'Tip') }, { type: 'setCurrency', currency: 'JPY' })
    expect(s.meta.fees).toEqual([fee('f1', 36)])
  })

  it('repairSession cleans fees and a bad fee split, and leaves good ones alone', () => {
    const good = run(base(), { type: 'addFee', fee: fee('f1', 3500) }, { type: 'setFeeSplit', feeSplit: 'equal' })
    expect(repairSession(good)).toBe(good)
    const bad = { ...good, feeSplit: 'half' as never, meta: { ...good.meta, fees: [fee('f1', 3500), fee('f1', 10), fee('f3', -5), { ...fee('f4', 99), kind: 'x' as never }] } }
    const fixed = repairSession(bad)
    expect(fixed.meta.fees).toEqual([fee('f1', 3500), { ...fee('f4', 99), kind: 'other' }])
    expect(fixed.feeSplit).toBeUndefined()
    expect(Object.hasOwn(repairSession({ ...good, meta: { ...good.meta, fees: [] } }).meta, 'fees')).toBe(false)
  })
})

describe('persist — fees', () => {
  it('loads saved fees and the fee split, repairing them', () => {
    const saved = run(base(), { type: 'addFee', fee: fee('f1', 3500) }, { type: 'setFeeSplit', feeSplit: 'equal' })
    expect(parseSession(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    const old = JSON.parse(JSON.stringify(base()))
    const loaded = parseSession(old)
    expect(loaded?.feeSplit).toBeUndefined()
    expect(loaded && Object.hasOwn(loaded.meta, 'fees')).toBe(false)
    const messy = { ...old, feeSplit: 7, meta: { ...old.meta, fees: 'lots' } }
    expect(parseSession(messy)).toMatchObject({ items: old.items })
    expect(parseSession(messy)?.feeSplit).toBeUndefined()
  })
})

describe('selectors — fees', () => {
  const withFees = run(base({ meta: { ...EMPTY_META, tax: 4285, discount: 10000, fees: [fee('f1', 3500), fee('f2', 1000, 'platform', 'Platform fee')] } }))

  it('feesTotal and the computed total include fees', () => {
    expect(feesTotal(withFees)).toBe(4500)
    expect(feesTotal(base())).toBe(0)
    expect(computedBillTotal(withFees)).toBe(34900 + 28900 + 4285 + 4500 - 10000)
    expect(defaultPaid(withFees)).toBe(computedBillTotal(withFees))
  })

  it('billBreakdown lists each fee after tax, before the discount', () => {
    expect(billBreakdown(withFees).map((r) => [r.key, r.label, r.amount, r.kind])).toEqual([
      ['items', 'Items', 63800, 'items'],
      ['tax', 'Tax', 4285, 'charge'],
      ['fee:f1', 'Delivery fee', 3500, 'fee'],
      ['fee:f2', 'Platform fee', 1000, 'fee'],
      ['discount', 'Discount', -10000, 'discount'],
      ['total', 'Adds up to', 62585, 'total'],
    ])
  })
})

describe('saving a bill with fees, and opening it again', () => {
  beforeEach(resetDataForTests)
  afterEach(resetDataForTests)

  it('keeps the fees and their split both ways, and the shares follow the split', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const sam = addFriend({ name: 'Sam' }).id
    let s = base({
      people: [{ id: riya, name: 'Riya', color: 0 }, { id: sam, name: 'Sam', color: 1 }, { id: ME_ID, name: 'You', color: 2 }],
      meta: { ...EMPTY_META, total: 70300, fees: [fee('f1', 6000), fee('f2', 600, 'platform', 'Platform fee')] },
      assignments: {},
    })
    s = run(s, { type: 'setShares', itemId: 'biryani', shares: { [riya]: 1 } }, { type: 'setShares', itemId: 'pbm', shares: { [sam]: 1 } }, { type: 'setFeeSplit', feeSplit: 'equal' })
    const draft = billExpenseDraft(s, '2026-10-21')
    expect(draft.bill?.feeSplit).toBe('equal')
    expect(draft.bill?.meta.fees).toEqual(s.meta.fees)
    const saved = saveExpense(draft)
    // Equal: ₹33 of fees each for Riya and Sam (you had nothing), the rest by what each had.
    const split = computeSplit({ items: s.items, people: s.people, assignments: s.assignments, paid: 70300, fees: 6600, feeSplit: 'equal' })
    expect(saved.shares).toEqual(Object.fromEntries(split.people.map((p) => [p.person.id, p.total])))
    expect(saved.shares[ME_ID]).toBe(0)
    expect(saved.shares[riya]).toBe(3300 + Math.round((70300 - 6600) * 34900 / 63800))
    const back = billSessionFromExpense(expensesStore.get()[0]!)
    expect(back?.feeSplit).toBe('equal')
    expect(back?.meta.fees).toEqual(s.meta.fees)
  })

  it('leaves the fee split out of bills without fees', () => {
    expect(billExpenseDraft(run(base(), { type: 'setFeeSplit', feeSplit: 'equal' }), '2026-10-21').bill).not.toHaveProperty('feeSplit')
  })
})
