import { describe, expect, it } from 'vitest'
import { EMPTY_META, type BillItem, type Session } from '../types'
import { createSession } from './reducer'
import {
  assignedCount,
  billBreakdown,
  billCategory,
  billDate,
  canContinue,
  clampStep,
  computedBillTotal,
  defaultPaid,
  effectivePaid,
  firstUnassignedIndex,
  furthestReachableStep,
  hasProgress,
  isAssigned,
  itemsTotal,
  nextStep,
  prevStep,
  resumeStep,
  stepIndex,
  stepProgress,
  suggestedCategory,
  unassignedItems,
} from './selectors'

const item = (id: string, amount: number, name = id): BillItem => ({ id, name, quantity: 1, amount })

function session(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    source: 'manual',
    step: 'review',
    items: [item('x', 1000), item('y', 2000)],
    people: [
      { id: 'a', name: 'A', color: 0 },
      { id: 'b', name: 'B', color: 1 },
    ],
    ...overrides,
  }
}

describe('amount selectors', () => {
  it('itemsTotal / defaultPaid / effectivePaid', () => {
    const s = session()
    expect(itemsTotal(s)).toBe(3000)
    expect(defaultPaid(s)).toBe(3000)
    expect(effectivePaid(s)).toBe(3000)
    const withTotal = session({ meta: { ...EMPTY_META, total: 3300 } })
    expect(defaultPaid(withTotal)).toBe(3300)
    expect(effectivePaid({ ...withTotal, paid: 2500 })).toBe(2500)
    expect(effectivePaid({ ...withTotal, paid: 0 })).toBe(0)
    expect(defaultPaid(session({ meta: { ...EMPTY_META, total: 0 } }))).toBe(3000)
  })
})

describe('without a printed total', () => {
  // The sample bill: ₹2,305 of items, service charge, tax and a 10% discount; prints ₹2,299.
  const sampleMeta = { ...EMPTY_META, serviceCharge: 11525, tax: 10949, discount: 23050 }
  const sample = (total: number | null) => session({ items: [item('a', 230500)], meta: { ...sampleMeta, total } })

  it('computedBillTotal adds the charges and takes off the discount', () => {
    expect(computedBillTotal(sample(null))).toBe(229924)
    expect(computedBillTotal(session({ meta: { ...EMPTY_META, tip: 300 } }))).toBe(3300)
    expect(computedBillTotal(session({ meta: { ...EMPTY_META, discount: -500 } }))).toBe(2500)
    expect(computedBillTotal(session())).toBe(3000)
  })

  it('defaultPaid uses what the bill adds up to, not just the items', () => {
    expect(defaultPaid(sample(null))).toBe(229924)
    expect(effectivePaid(sample(null))).toBe(229924)
    // A printed total still wins; an explicit amount still wins over both.
    expect(defaultPaid(sample(229900))).toBe(229900)
    expect(effectivePaid({ ...sample(null), paid: 200000 })).toBe(200000)
    // A zero total is no total.
    expect(defaultPaid(sample(0))).toBe(229924)
  })

  it('defaultPaid falls back to the items when there are no charges, or they make no sense', () => {
    expect(defaultPaid(session())).toBe(3000)
    expect(defaultPaid(session({ meta: { ...EMPTY_META, tax: 0, discount: 0 } }))).toBe(3000)
    expect(defaultPaid(session({ meta: { ...EMPTY_META, discount: 5000 } }))).toBe(3000)
  })

  it('billBreakdown ends with what the lines add up to', () => {
    const rows = billBreakdown(sample(null))
    expect(rows.map((r) => [r.key, r.label, r.amount, r.kind])).toEqual([
      ['items', 'Items', 230500, 'items'],
      ['serviceCharge', 'Service charge', 11525, 'charge'],
      ['tax', 'Tax', 10949, 'charge'],
      ['discount', 'Discount', -23050, 'discount'],
      ['total', 'Adds up to', 229924, 'total'],
    ])
    expect(rows.at(-1)?.amount).toBe(defaultPaid(sample(null)))
  })
})

describe('assignment selectors', () => {
  const s = session({ assignments: { x: { a: 1 }, y: { ghost: 1 } } })

  it('knows what is assigned (ignoring people who are gone)', () => {
    expect(isAssigned(s, 'x')).toBe(true)
    expect(isAssigned(s, 'y')).toBe(false)
    expect(unassignedItems(s).map((i) => i.id)).toEqual(['y'])
    expect(assignedCount(s)).toBe(1)
    expect(firstUnassignedIndex(s)).toBe(1)
    expect(firstUnassignedIndex(session({ assignments: { x: { a: 1 }, y: { b: 1 } } }))).toBe(-1)
  })
})

describe('canContinue', () => {
  it('review needs named items', () => {
    expect(canContinue(session(), 'review')).toBe(true)
    expect(canContinue(session({ items: [] }), 'review')).toBe(false)
    expect(canContinue(session({ items: [item('x', 1, '  ')] }), 'review')).toBe(false)
  })

  it('paid needs a positive amount', () => {
    expect(canContinue(session(), 'paid')).toBe(true)
    expect(canContinue(session({ paid: 0 }), 'paid')).toBe(false)
    expect(canContinue(session({ items: [item('x', 0)] }), 'paid')).toBe(false)
  })

  it('people needs two', () => {
    expect(canContinue(session(), 'people')).toBe(true)
    expect(canContinue(session({ people: [{ id: 'a', name: 'A', color: 0 }] }), 'people')).toBe(false)
  })

  it('assign needs every item assigned', () => {
    expect(canContinue(session({ assignments: { x: { a: 1 } } }), 'assign')).toBe(false)
    expect(canContinue(session({ assignments: { x: { a: 1 }, y: { b: 1 } } }), 'assign')).toBe(true)
    expect(canContinue(session({ items: [] }), 'assign')).toBe(false)
  })

  it('other steps are always fine', () => {
    expect(canContinue(session(), 'scan')).toBe(true)
    expect(canContinue(session(), 'result')).toBe(true)
  })
})

describe('steps', () => {
  it('orders and numbers steps', () => {
    expect(stepIndex('scan')).toBe(0)
    expect(stepIndex('result')).toBe(5)
    expect(nextStep('scan')).toBe('review')
    expect(nextStep('result')).toBeNull()
    expect(prevStep('review')).toBe('scan')
    expect(prevStep('scan')).toBeNull()
    expect(stepProgress('scan')).toBeNull()
    expect(stepProgress('review')).toEqual({ current: 1, total: 5 })
    expect(stepProgress('result')).toEqual({ current: 5, total: 5 })
  })

  it('hasProgress means there is a bill with items', () => {
    expect(hasProgress(session())).toBe(true)
    expect(hasProgress(session({ items: [] }))).toBe(false)
  })

  it('furthestReachableStep follows the data', () => {
    expect(furthestReachableStep(createSession('INR'))).toBe('scan')
    expect(furthestReachableStep(session({ items: [] }))).toBe('review')
    expect(furthestReachableStep(session({ paid: 0 }))).toBe('paid')
    expect(furthestReachableStep(session({ people: [] }))).toBe('people')
    expect(furthestReachableStep(session())).toBe('result')
  })

  it('clampStep never goes past the data', () => {
    expect(clampStep(createSession('INR'), 'result')).toBe('scan')
    expect(clampStep(session({ people: [] }), 'assign')).toBe('people')
    expect(clampStep(session({ people: [] }), 'paid')).toBe('paid')
  })

  it('resumeStep returns to the furthest step reached, at least review', () => {
    const s = session({ step: 'scan' })
    expect(resumeStep(s)).toBe('review')
    expect(resumeStep(s, 'assign')).toBe('assign')
    expect(resumeStep(session({ step: 'scan', people: [] }), 'result')).toBe('people')
    expect(resumeStep(createSession('INR'))).toBe('scan')
  })
})

describe('billBreakdown', () => {
  it('explains the sample bill, with round-off', () => {
    const s = session({
      items: [item('a', 230500)],
      meta: { ...EMPTY_META, serviceCharge: 11525, tax: 10949, discount: 23050, total: 229900 },
    })
    const rows = billBreakdown(s)
    expect(rows.map((r) => [r.key, r.label, r.amount, r.kind])).toEqual([
      ['items', 'Items', 230500, 'items'],
      ['serviceCharge', 'Service charge', 11525, 'charge'],
      ['tax', 'Tax', 10949, 'charge'],
      ['discount', 'Discount', -23050, 'discount'],
      ['roundoff', 'Round-off', -24, 'roundoff'],
      ['total', 'Bill total', 229900, 'total'],
    ])
    const sum = rows.filter((r) => r.kind !== 'total').reduce((a, r) => a + r.amount, 0)
    expect(sum).toBe(229900)
  })

  it('labels big differences as other charges/discounts', () => {
    const more = billBreakdown(session({ meta: { ...EMPTY_META, total: 3500 } }))
    expect(more.find((r) => r.key === 'roundoff')).toMatchObject({ label: 'Other charges', amount: 500, kind: 'other' })
    const less = billBreakdown(session({ meta: { ...EMPTY_META, total: 2500 } }))
    expect(less.find((r) => r.key === 'roundoff')).toMatchObject({ label: 'Other discounts', amount: -500, kind: 'other' })
    // Just under one rupee either way is still round-off; exactly one is not.
    const nearly = billBreakdown(session({ meta: { ...EMPTY_META, total: 3099 } }))
    expect(nearly.find((r) => r.key === 'roundoff')).toMatchObject({ label: 'Round-off', amount: 99, kind: 'roundoff' })
    const rupee = billBreakdown(session({ meta: { ...EMPTY_META, total: 2900 } }))
    expect(rupee.find((r) => r.key === 'roundoff')).toMatchObject({ label: 'Other discounts', amount: -100, kind: 'other' })
  })

  it('leaves out the adjustment when the printed total adds up', () => {
    const rows = billBreakdown(session({ meta: { ...EMPTY_META, tax: 300, total: 3300 } }))
    expect(rows.map((r) => [r.key, r.label, r.amount])).toEqual([
      ['items', 'Items', 3000],
      ['tax', 'Tax', 300],
      ['total', 'Bill total', 3300],
    ])
  })

  it('uses the computed total when the bill has none, and skips zero charges', () => {
    const rows = billBreakdown(session({ meta: { ...EMPTY_META, tip: 300, tax: 0 } }))
    expect(rows.map((r) => [r.key, r.label, r.amount])).toEqual([
      ['items', 'Items', 3000],
      ['tip', 'Tip', 300],
      ['total', 'Adds up to', 3300],
    ])
  })

  it('uses the currency for the round-off threshold', () => {
    const jpy = session({ currency: 'JPY', items: [item('x', 1000)], meta: { ...EMPTY_META, total: 1001 } })
    expect(billBreakdown(jpy).find((r) => r.key === 'roundoff')).toMatchObject({ label: 'Other charges', kind: 'other' })
  })
})

describe('billDate', () => {
  const today = '2026-10-22'
  it('uses the day picked, else the printed date, else today', () => {
    expect(billDate(session({ date: '2026-10-01' }), today)).toBe('2026-10-01')
    expect(billDate(session({ meta: { ...EMPTY_META, date: '2026-10-19' } }), today)).toBe('2026-10-19')
    expect(billDate(session({ meta: { ...EMPTY_META, date: ' 2026-10-19 ' } }), today)).toBe('2026-10-19')
    expect(billDate(session(), today)).toBe(today)
  })

  it('ignores a printed date that isn’t a real day or is in the future', () => {
    expect(billDate(session({ meta: { ...EMPTY_META, date: '19 Oct' } }), today)).toBe(today)
    expect(billDate(session({ meta: { ...EMPTY_META, date: '2026-02-30' } }), today)).toBe(today)
    expect(billDate(session({ meta: { ...EMPTY_META, date: '2026-12-25' } }), today)).toBe(today)
  })
})

describe('billCategory / suggestedCategory', () => {
  it('prefers the category on the bill, then what its name says, then food', () => {
    expect(billCategory(session({ category: 'travel' }))).toBe('travel')
    expect(billCategory(session({ meta: { ...EMPTY_META, merchant: 'Blinkit' } }))).toBe('groceries')
    expect(suggestedCategory(session({ meta: { ...EMPTY_META, merchant: 'Blinkit' } }))).toBe('groceries')
    expect(billCategory(session({ meta: { ...EMPTY_META, merchant: 'Saffron Table' } }))).toBe('food')
    expect(billCategory(session())).toBe('food')
  })
})
