import { describe, expect, it } from 'vitest'
import { computeSplit } from '../../lib/split'
import { createSession, MAX_FEES } from '../../state/reducer'
import { BILL_FEE_KINDS, EMPTY_META, type BillFee, type BillItem, type Person, type Session } from '../../types'
import {
  defaultFeeLabel,
  explainFeePolicy,
  FEE_EMOJI,
  feeAsItem,
  feeKind,
  feeKindLabel,
  feePolicyFacts,
  feeRowLabel,
  personFeeLines,
  restoreFee,
} from './feeView'

/* Spec 08 §4.1: the Friday-night Swiggy order. */
const ITEMS: BillItem[] = [
  { id: 'biryani', name: 'Chicken Biryani', quantity: 1, amount: 34900 },
  { id: 'pbm', name: 'Paneer Butter Masala', quantity: 1, amount: 28900 },
  { id: 'naan', name: 'Garlic Naan', quantity: 2, amount: 12000 },
  { id: 'gj', name: 'Gulab Jamun (2 pcs)', quantity: 1, amount: 9900 },
]
const PEOPLE: Person[] = ['riya', 'sam', 'ayush', 'kabir'].map((id, color) => ({ id, name: id, color }))
const ASSIGNMENTS = { biryani: { riya: 1 }, pbm: { sam: 1 }, naan: { riya: 1, sam: 1 }, gj: { ayush: 1 } }
const FEES: BillFee[] = [
  { id: 'f1', kind: 'delivery', label: 'Delivery partner fee', amount: 3500 },
  { id: 'f2', kind: 'platform', label: 'Platform fee', amount: 1000 },
  { id: 'f3', kind: 'packaging', label: 'Restaurant packaging', amount: 2500 },
  { id: 'f4', kind: 'surge', label: 'Rain fee', amount: 2000 },
]
const PAID = 88985

function order(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    id: 'bill-1',
    step: 'review',
    source: 'scan',
    items: ITEMS,
    people: PEOPLE,
    assignments: ASSIGNMENTS,
    meta: { ...EMPTY_META, tax: 4285, discount: 10000, total: PAID, fees: FEES },
    feeSplit: 'equal',
    ...overrides,
  }
}

describe('fee kinds', () => {
  it('has an emoji, a kind name and a default name for every kind', () => {
    expect(BILL_FEE_KINDS.map((k) => FEE_EMOJI[k]).join(' ')).toBe('🛵 🧾 📦 🌧️ 🛒 🙏 💚 🏛️ ➕')
    expect(BILL_FEE_KINDS.map(feeKindLabel)).toEqual([
      'Delivery',
      'Platform',
      'Packaging',
      'Surge/rain',
      'Small order',
      'Tip',
      'Donation',
      'GST on fees',
      'Other',
    ])
    expect(BILL_FEE_KINDS.map(defaultFeeLabel)).toEqual([
      'Delivery fee',
      'Platform fee',
      'Packaging',
      'Rain fee',
      'Small order fee',
      'Tip',
      'Donation',
      'GST on fees',
      'Fee',
    ])
  })

  it('reads anything unknown as "other"', () => {
    expect(feeKind('delivery')).toBe('delivery')
    expect(feeKind('convenience')).toBe('other')
    expect(feeKind(undefined)).toBe('other')
  })

  it('names a fee row for screen readers', () => {
    expect(feeRowLabel({ label: 'Delivery fee', amount: 3500 }, 'INR')).toBe('Delivery fee, ₹35, edit')
    expect(feeRowLabel({ label: 'GST on fees', amount: 765 }, 'INR')).toBe('GST on fees, ₹7.65, edit')
  })
})

describe('explainFeePolicy', () => {
  it('says how fees, tax and the coupon are shared — the spec’s two lines', () => {
    expect(explainFeePolicy(feePolicyFacts(order(), 9000))).toBe(
      '₹90 in fees split equally between everyone who ordered — tax and the ₹100 coupon go by what each had.',
    )
    expect(explainFeePolicy(feePolicyFacts(order({ feeSplit: 'proportional' }), 9000))).toBe(
      'Fees, tax and the coupon are all shared by what each person had.',
    )
  })

  it('names only the tax and coupon the bill has', () => {
    const base = { fees: 4500, currency: 'INR' }
    expect(explainFeePolicy({ ...base, feeSplit: 'equal', charges: 0, coupon: 5000 })).toBe(
      '₹45 in fees split equally between everyone who ordered — the ₹50 coupon goes by what each had.',
    )
    expect(explainFeePolicy({ ...base, feeSplit: 'equal', charges: 1200, coupon: 0 })).toBe(
      '₹45 in fees split equally between everyone who ordered — tax goes by what each had.',
    )
    expect(explainFeePolicy({ ...base, feeSplit: 'equal', charges: 0, coupon: 0 })).toBe(
      '₹45 in fees split equally between everyone who ordered.',
    )
    expect(explainFeePolicy({ ...base, feeSplit: 'proportional', charges: 0, coupon: 5000 })).toBe(
      'Fees and the coupon are both shared by what each person had.',
    )
    expect(explainFeePolicy({ ...base, feeSplit: 'proportional', charges: 1200, coupon: 0 })).toBe(
      'Fees and tax are both shared by what each person had.',
    )
    expect(explainFeePolicy({ ...base, feeSplit: 'proportional', charges: 0, coupon: 0 })).toBe(
      'Fees are shared by what each person had.',
    )
  })

  it('keeps paise when the fees have them', () => {
    expect(explainFeePolicy({ feeSplit: 'equal', fees: 4550, charges: 0, coupon: 0, currency: 'INR' })).toBe(
      '₹45.50 in fees split equally between everyone who ordered.',
    )
  })

  it('counts service charge and tip as "tax", and a negative discount as a coupon', () => {
    const facts = feePolicyFacts(order({ meta: { ...EMPTY_META, serviceCharge: 500, discount: -2000, fees: FEES } }), 9000)
    expect(facts).toMatchObject({ charges: 500, coupon: 2000, feeSplit: 'equal' })
    // An older bill without a fee split is shared by what each had.
    expect(feePolicyFacts({ ...order(), feeSplit: undefined }, 9000).feeSplit).toBe('proportional')
  })
})

describe('personFeeLines — spec 08 §4.1', () => {
  it('equal fees: ₹30 each for the three who ordered; tax and the coupon by what each had', () => {
    const split = computeSplit({ items: ITEMS, people: PEOPLE, assignments: ASSIGNMENTS, paid: PAID, fees: 9000, feeSplit: 'equal' })
    expect(split.people.map((p) => p.total)).toEqual([41172, 35573, 12240, 0])
    expect(split.people.map(personFeeLines)).toEqual([
      { fees: 3000, other: -2728, none: false },
      { fees: 3000, other: -2327, none: false },
      { fees: 3000, other: -660, none: false },
      { fees: 0, other: 0, none: true },
    ])
    const lines = split.people.map(personFeeLines)
    expect(lines.reduce((s, l) => s + l.other, 0)).toBe(-5715)
    // Items + fees + other = total, to the paisa.
    split.people.forEach((p, i) => expect(p.itemsSubtotal + (lines[i]?.fees ?? 0) + (lines[i]?.other ?? 0)).toBe(p.total))
  })

  it('fees by what each had: fees shown for display, totals as before', () => {
    const split = computeSplit({ items: ITEMS, people: PEOPLE, assignments: ASSIGNMENTS, paid: PAID, fees: 9000, feeSplit: 'proportional' })
    expect(split.people.map((p) => p.total)).toEqual([42468, 36238, 10279, 0])
    expect(split.people.map((p) => personFeeLines(p).fees)).toEqual([4295, 3665, 1040, 0])
    expect(personFeeLines(split.people[3] as (typeof split.people)[number]).none).toBe(true)
  })

  it('a huge coupon: everything left is fees, split equally', () => {
    const split = computeSplit({ items: ITEMS, people: PEOPLE, assignments: ASSIGNMENTS, paid: 5000, fees: 9000, feeSplit: 'equal' })
    expect(split.people.map((p) => p.total)).toEqual([1667, 1667, 1666, 0])
    expect(split.people.map((p) => personFeeLines(p).fees)).toEqual([1667, 1667, 1666, 0])
  })
})

describe('restoreFee (undo)', () => {
  it('puts a removed fee back in its old place, keeping changes made since', () => {
    const before = order()
    const now = order({ meta: { ...before.meta, fees: [FEES[0], FEES[1], FEES[3]] as BillFee[] }, paid: 80000 })
    const back = restoreFee(now, before, 'f3', MAX_FEES)
    expect(back?.meta.fees?.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4'])
    expect(back?.paid).toBe(80000)
  })

  it('goes first when every earlier fee is gone too', () => {
    const before = order()
    const now = order({ meta: { ...before.meta, fees: [FEES[2], FEES[3]] as BillFee[] } })
    expect(restoreFee(now, before, 'f1', MAX_FEES)?.meta.fees?.map((f) => f.id)).toEqual(['f1', 'f3', 'f4'])
  })

  it('does nothing when it is already back, the bill changed or the fees are full', () => {
    const before = order()
    expect(restoreFee(before, before, 'f1', MAX_FEES)).toBeNull()
    expect(restoreFee({ ...order(), id: 'other' }, before, 'f1', MAX_FEES)).toBeNull()
    expect(restoreFee(order({ currency: 'USD', meta: { ...EMPTY_META } }), before, 'f1', MAX_FEES)).toBeNull()
    expect(restoreFee(order({ meta: { ...EMPTY_META, fees: [FEES[1]] as BillFee[] } }), before, 'f1', 1)).toBeNull()
    expect(restoreFee(order({ meta: { ...EMPTY_META } }), before, 'nope', MAX_FEES)).toBeNull()
  })
})

describe('feeAsItem', () => {
  it('turns a tip into a one-off item with the same name and amount', () => {
    const item = feeAsItem(order(), { id: 'tip', kind: 'tip', label: 'Tip', amount: 3000 })
    expect(item).toMatchObject({ name: 'Tip', quantity: 1, amount: 3000 })
    expect(item?.id).toEqual(expect.any(String))
  })
})
