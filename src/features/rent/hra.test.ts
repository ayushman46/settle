import { describe, expect, it } from 'vitest'
import {
  buildReceipts,
  dayOf,
  equalShares,
  financialYearOf,
  monthName,
  monthsBetween,
  needsLandlordPan,
  needsRevenueStamp,
  normalizePan,
  PAN_PATTERN,
  rupeesInWords,
} from './hra'

describe('financial years (April–March)', () => {
  it('puts April in the year that starts then, and March in the one before', () => {
    expect(financialYearOf('2026-04')).toEqual({ label: '2026-27', from: '2026-04', to: '2027-03' })
    expect(financialYearOf('2027-03')).toEqual({ label: '2026-27', from: '2026-04', to: '2027-03' })
    expect(financialYearOf('2026-03')).toEqual({ label: '2025-26', from: '2025-04', to: '2026-03' })
    expect(financialYearOf('2099-12').label).toBe('2099-00')
  })

  it('lists the months of a range, both ends included', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsBetween('2026-04', '2026-04')).toEqual(['2026-04'])
    expect(monthsBetween('2026-05', '2026-04')).toEqual([])
    expect(monthsBetween('2026-04', '2027-03')).toHaveLength(12)
  })

  it('names months in full, and puts the due day inside the month', () => {
    expect(monthName('2026-04')).toBe('April 2026')
    expect(dayOf('2027-02', 31)).toBe('2027-02-28')
    expect(dayOf('2028-02', 31)).toBe('2028-02-29')
    expect(dayOf('2026-04', 5)).toBe('2026-04-05')
    expect(dayOf('2026-04', 0)).toBe('2026-04-01')
  })
})

describe('the HRA rules', () => {
  it('asks for the landlord’s PAN when a year of your share is more than ₹1,00,000', () => {
    expect(needsLandlordPan(8_333_00)).toBe(false) // ₹99,996 a year
    expect(needsLandlordPan(8_333_34)).toBe(true) // ₹1,00,000.08 a year
    expect(needsLandlordPan(8_334_00)).toBe(true)
    expect(needsLandlordPan(14_000_00)).toBe(true)
  })

  it('puts a revenue stamp only on cash receipts above ₹5,000', () => {
    expect(needsRevenueStamp('cash', 5_000_00)).toBe(false)
    expect(needsRevenueStamp('cash', 5_000_01)).toBe(true)
    expect(needsRevenueStamp('upi', 50_000_00)).toBe(false)
    expect(needsRevenueStamp('bank', 50_000_00)).toBe(false)
    expect(needsRevenueStamp('cheque', 50_000_00)).toBe(false)
  })

  it('recognises a PAN however it was typed', () => {
    expect(PAN_PATTERN.test(normalizePan(' abcde 1234f '))).toBe(true)
    expect(PAN_PATTERN.test(normalizePan('ABCD1234F'))).toBe(false)
    expect(PAN_PATTERN.test(normalizePan('ABCDE12345'))).toBe(false)
  })
})

describe('amounts in words (Indian system)', () => {
  it('writes rupees and paise the way receipts do', () => {
    expect(rupeesInWords(14_000_00)).toBe('Rupees Fourteen Thousand Only')
    expect(rupeesInWords(1_25_000_00)).toBe('Rupees One Lakh Twenty-Five Thousand Only')
    expect(rupeesInWords(8_333_50)).toBe('Rupees Eight Thousand Three Hundred Thirty-Three and Fifty Paise Only')
  })
})

describe('buildReceipts', () => {
  const plan = { rentId: 'fl7q-x9', tenantIndex: 1, monthlyShare: 14_000_00, mode: 'upi' as const }

  it('gives one receipt a month, numbered by rent, flatmate and month', () => {
    const receipts = buildReceipts({ ...plan, months: monthsBetween('2026-04', '2026-06'), per: 'month' })
    expect(receipts.map((r) => [r.number, r.period, r.amount])).toEqual([
      ['R-FL7Q-2-202604', 'April 2026', 14_000_00],
      ['R-FL7Q-2-202605', 'May 2026', 14_000_00],
      ['R-FL7Q-2-202606', 'June 2026', 14_000_00],
    ])
    expect(receipts.every((r) => !r.stamp && r.words === 'Rupees Fourteen Thousand Only')).toBe(true)
  })

  it('gives one receipt a quarter of the financial year, splitting at quarter ends', () => {
    const receipts = buildReceipts({ ...plan, months: monthsBetween('2026-05', '2027-01'), per: 'quarter' })
    expect(receipts.map((r) => [r.period, r.months, r.amount])).toEqual([
      ['May 2026 – June 2026', 2, 28_000_00],
      ['July 2026 – September 2026', 3, 42_000_00],
      ['October 2026 – December 2026', 3, 42_000_00],
      ['January 2027', 1, 14_000_00],
    ])
  })

  it('does not join months across a gap', () => {
    const receipts = buildReceipts({ ...plan, months: ['2026-07', '2026-09'], per: 'quarter' })
    expect(receipts.map((r) => r.period)).toEqual(['July 2026', 'September 2026'])
  })

  it('stamps cash receipts above ₹5,000, ignores bad and repeated months, and caps at 24', () => {
    expect(buildReceipts({ ...plan, mode: 'cash', months: ['2026-04'], per: 'month' })[0]?.stamp).toBe(true)
    expect(buildReceipts({ ...plan, mode: 'cash', monthlyShare: 4_000_00, months: ['2026-04'], per: 'month' })[0]?.stamp).toBe(false)
    expect(buildReceipts({ ...plan, months: ['2026-04', '2026-04', 'nope', '2026-13'], per: 'month' })).toHaveLength(1)
    expect(buildReceipts({ ...plan, months: monthsBetween('2024-04', '2027-03'), per: 'month' })).toHaveLength(24)
  })
})

describe('equalShares', () => {
  it('adds up exactly, the first flatmates taking the extra paise', () => {
    expect(equalShares(42_000_00, 3)).toEqual([14_000_00, 14_000_00, 14_000_00])
    expect(equalShares(100_01, 3)).toEqual([33_34, 33_34, 33_33])
    expect(equalShares(100, 0)).toEqual([])
  })
})
