import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, resetDataForTests } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { BillBreakdown } from './BillBreakdown'
import { billExtraLines, feesByPerson } from './expenseView'

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

/** A Swiggy order: ₹600 of food, ₹90 of fees, ₹30 tax, a ₹100 coupon → ₹620 paid. */
function order(feeSplit?: 'equal' | 'proportional'): Expense {
  return {
    id: 'e1',
    kind: 'bill',
    title: 'Swiggy',
    category: 'food',
    currency: 'INR',
    total: 62_000,
    date: '2026-10-21',
    createdAt: 1,
    updatedAt: 1,
    payerId: ME_ID,
    mode: 'items',
    participants: [ME_ID, riya, sam].map((friendId) => ({ friendId, input: null })),
    shares: {},
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: {
      meta: {
        merchant: 'Swiggy',
        date: null,
        subtotal: 60_000,
        tax: 3_000,
        serviceCharge: null,
        discount: 10_000,
        tip: null,
        total: 62_000,
        fees: [
          { id: 'f1', kind: 'delivery', label: 'Delivery fee', amount: 6_000 },
          { id: 'f2', kind: 'platform', label: 'Platform fee', amount: 3_000 },
        ],
      },
      items: [
        { id: 'i1', name: 'Biryani', quantity: 1, amount: 40_000 },
        { id: 'i2', name: 'Kebab', quantity: 1, amount: 20_000 },
      ],
      assignments: { i1: { [riya]: 1 }, i2: { [sam]: 1 } },
      warnings: [],
      ...(feeSplit ? { feeSplit } : {}),
    },
    paidBack: {},
    recurringId: null,
    source: 'scan',
  }
}

describe('BillBreakdown — delivery fees (spec 08 §2.6)', () => {
  it('lists each fee between tax and the discount, so the receipt adds up', () => {
    expect(billExtraLines(order()).map((l) => [l.key, l.label, l.amount])).toEqual([
      ['tax', 'Tax', 3_000],
      ['fee', 'Delivery fee', 6_000],
      ['fee', 'Platform fee', 3_000],
      ['discount', 'Discount', -10_000],
    ])
  })

  it('works out each person’s fees from the saved split: equally between people who ordered', () => {
    expect(feesByPerson(order('equal'))).toEqual([
      { id: riya, amount: 4_500 },
      { id: sam, amount: 4_500 },
    ])
    // By what each had (also older bills without a fee split): 2 : 1.
    expect(feesByPerson(order())).toEqual([
      { id: riya, amount: 6_000 },
      { id: sam, amount: 3_000 },
    ])
  })

  it('shows a Fees line per person who paid any', () => {
    render(<BillBreakdown expense={order('equal')} />)
    const fees = screen.getByRole('group', { name: 'Fees, shared equally' })
    expect(within(fees).getByText('Fees · Riya')).toBeInTheDocument()
    expect(within(fees).getByText('Fees · Sam')).toBeInTheDocument()
    expect(within(fees).queryByText('Fees · You')).not.toBeInTheDocument()
    expect(screen.getByText('Delivery fee')).toBeInTheDocument()
  })

  it('shows no fees section for a restaurant bill', () => {
    const e = order()
    const plain: Expense = { ...e, bill: { ...e.bill!, meta: { ...e.bill!.meta, fees: undefined } } }
    render(<BillBreakdown expense={plain} />)
    expect(screen.queryByRole('group', { name: /^Fees/ })).not.toBeInTheDocument()
    expect(feesByPerson(plain)).toEqual([])
  })
})
