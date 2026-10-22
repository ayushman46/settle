import { describe, expect, it } from 'vitest'
import type { MappedBill } from '../../api/mapScan'
import { EMPTY_META, type BillItem } from '../../types'
import { ITEMIZED_MIN_ITEMS, scanPrefill } from './scanPrefill'

const TODAY = '2026-10-22'
const item = (name: string, amount: number): BillItem => ({ id: name, name, quantity: 1, amount })

function bill(overrides: Partial<MappedBill> = {}, meta: Partial<MappedBill['meta']> = {}): MappedBill {
  return { currency: 'INR', category: null, items: [], warnings: [], ...overrides, meta: { ...EMPTY_META, ...meta } }
}

describe('scanPrefill', () => {
  it('leaves bills with two or more items to the itemized flow', () => {
    expect(ITEMIZED_MIN_ITEMS).toBe(2)
    expect(scanPrefill(bill({ items: [item('Tea', 4000), item('Cake', 9000)] }, { total: 13000 }), TODAY)).toBeNull()
  })

  it('turns a bill with just a total into a prefilled split', () => {
    const prefill = scanPrefill(
      bill({ category: 'utilities', currency: 'INR' }, { merchant: 'BESCOM', total: 184_700, date: '2026-10-05' }),
      TODAY,
    )
    expect(prefill).toEqual({
      title: 'BESCOM',
      total: 184_700,
      currency: 'INR',
      category: 'utilities',
      date: '2026-10-05',
      source: 'scan',
    })
  })

  it('uses the single line’s amount when no total was printed, and keeps what it was for as a note', () => {
    expect(scanPrefill(bill({ items: [item('Airport drop', 84_000)] }, { merchant: 'Uber' }), TODAY)).toEqual({
      title: 'Uber',
      total: 84_000,
      currency: 'INR',
      category: 'transport',
      note: 'Airport drop',
      source: 'scan',
    })
  })

  it('names the split after the line when the bill has no name', () => {
    expect(scanPrefill(bill({ items: [item('Hotel stay', 560_000)] }), TODAY)).toMatchObject({
      title: 'Hotel stay',
      category: 'travel',
    })
  })

  it('prefers the printed total over the single line', () => {
    expect(scanPrefill(bill({ items: [item('Room', 500_000)] }, { total: 560_000 }), TODAY)?.total).toBe(560_000)
  })

  it('leaves out what it can’t tell: an unknown category, a date that isn’t a real past day', () => {
    const prefill = scanPrefill(bill({}, { total: 50_000, merchant: 'Shop 42', date: '05/10/2026' }), TODAY)
    expect(prefill).not.toHaveProperty('category')
    expect(prefill).not.toHaveProperty('date')
    expect(scanPrefill(bill({}, { total: 50_000, date: '2026-12-31' }), TODAY)).not.toHaveProperty('date')
    expect(scanPrefill(bill({}, { total: 50_000 }), TODAY)).toEqual({ total: 50_000, currency: 'INR', source: 'scan' })
  })

  it('has nothing to offer without an amount', () => {
    expect(scanPrefill(bill({}, { merchant: 'Cafe' }), TODAY)).toBeNull()
    expect(scanPrefill(bill({ items: [item('Water', 0)] }, { total: 0 }), TODAY)).toBeNull()
  })
})
