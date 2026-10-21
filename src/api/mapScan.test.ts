import { describe, expect, it } from 'vitest'
import type { ScanResponse } from '../../shared/api'
import { resolveCurrency, scanToBill } from './mapScan'
import { SAMPLE_SCAN } from './sample'

const base: ScanResponse = {
  merchant: null,
  date: null,
  currency: null,
  category: null,
  items: [],
  subtotal: null,
  tax: null,
  serviceCharge: null,
  discount: null,
  tip: null,
  total: null,
  warnings: [],
  model: 'm',
}

describe('SAMPLE_SCAN', () => {
  it('is internally consistent', () => {
    const items = SAMPLE_SCAN.items.reduce((s, i) => s + i.amount, 0)
    expect(items).toBe(SAMPLE_SCAN.subtotal)
    const computed = items + (SAMPLE_SCAN.serviceCharge ?? 0) + (SAMPLE_SCAN.tax ?? 0) - (SAMPLE_SCAN.discount ?? 0)
    expect(Math.abs(computed - (SAMPLE_SCAN.total ?? 0))).toBeLessThan(1) // round-off
    expect(SAMPLE_SCAN.items).toHaveLength(8)
  })
})

describe('scanToBill', () => {
  it('converts the sample into minor units with fresh ids', () => {
    const bill = scanToBill(SAMPLE_SCAN, 'USD')
    expect(bill.currency).toBe('INR')
    expect(bill.items.map((i) => i.amount)).toEqual([34500, 49500, 32500, 30000, 24500, 24000, 16500, 19000])
    expect(bill.items.map((i) => i.quantity)).toEqual([1, 1, 1, 4, 1, 2, 1, 2])
    expect(new Set(bill.items.map((i) => i.id)).size).toBe(8)
    expect(bill.meta).toEqual({
      merchant: 'Saffron Table',
      date: '2026-10-18',
      subtotal: 230500,
      tax: 10949,
      serviceCharge: 11525,
      discount: 23050,
      tip: null,
      total: 229900,
    })
    expect(bill.warnings).toEqual([])
    expect(bill.category).toBe('food')
    expect(scanToBill(SAMPLE_SCAN, 'USD').items[0]?.id).not.toBe(bill.items[0]?.id)
  })

  it('uses the fallback currency for unknown codes and converts with its digits', () => {
    const bill = scanToBill({ ...base, currency: 'XYZ', items: [{ name: 'Ramen', quantity: 1, amount: 980.4 }] }, 'JPY')
    expect(bill.currency).toBe('JPY')
    expect(bill.items[0]?.amount).toBe(980)
    expect(scanToBill({ ...base, currency: 'usd' }, 'INR').currency).toBe('USD')
  })

  it('cleans names, quantities, amounts and warnings', () => {
    const bill = scanToBill(
      {
        ...base,
        merchant: '   ',
        items: [
          { name: '  Masala   Dosa ', quantity: 0, amount: 120.005 },
          { name: '   ', quantity: 1, amount: 50 },
          { name: 'Water', quantity: Number.NaN, amount: Number.NaN },
          { name: 'X'.repeat(120), quantity: 1.5, amount: -10 },
        ],
        discount: -50,
        total: 1e20,
        warnings: ['  check  this ', '', 'two', 'three', 'four'],
      },
      'INR',
    )
    expect(bill.items.map((i) => [i.name.length > 20 ? i.name.length : i.name, i.quantity, i.amount])).toEqual([
      ['Masala Dosa', 1, 12001],
      ['Water', 1, 0],
      [80, 1.5, 1000],
    ])
    expect(bill.meta.merchant).toBeNull()
    expect(bill.meta.discount).toBe(5000)
    expect(bill.meta.total).toBe(1e12)
    expect(bill.warnings).toEqual(['check this', 'two', 'three'])
  })
})

describe('scanToBill category', () => {
  it('keeps a known category and drops anything else', () => {
    expect(scanToBill({ ...base, category: 'utilities', total: 1840 }, 'INR')).toMatchObject({
      category: 'utilities',
      items: [],
      meta: { total: 184000 },
    })
    expect(scanToBill({ ...base, category: 'bogus' } as unknown as ScanResponse, 'INR').category).toBeNull()
    expect(scanToBill(base, 'INR').category).toBeNull()
  })
})

describe('resolveCurrency', () => {
  it('prefers the bill, then the fallback, then INR', () => {
    expect(resolveCurrency(' eur ', 'INR')).toBe('EUR')
    expect(resolveCurrency(null, 'GBP')).toBe('GBP')
    expect(resolveCurrency('???', 'bad')).toBe('INR')
  })
})
