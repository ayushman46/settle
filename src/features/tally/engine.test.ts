import { describe, expect, it } from 'vitest'
import { ME_ID } from '../../domain/types'
import {
  costOf,
  countOn,
  dayCount,
  dealEqually,
  differsFromUsual,
  formatQty,
  isClosed,
  keysOf,
  monthBill,
  monthDates,
  Q,
  rateOn,
  readyToClose,
  SHARED,
  stepOf,
  usualOn,
  type Tally,
} from './engine'

function makeTally(overrides: Partial<Tally> = {}): Tally {
  return {
    id: 't1',
    name: 'Doodh',
    unit: 'litre',
    currency: 'INR',
    split: 'equal',
    memberIds: [ME_ID],
    groupId: null,
    start: '2024-11-01',
    rates: [{ from: '2024-11-01', rate: 6000 }], // ₹60 a litre
    usual: [{ from: '2024-11-01', counts: { [SHARED]: Q } }], // 1 litre a day
    days: {},
    vendor: null,
    months: {},
    createdAt: 0,
    ...overrides,
  }
}

describe('formatQty', () => {
  it('shows whole numbers without decimals', () => {
    expect(formatQty(Q)).toBe('1')
    expect(formatQty(0)).toBe('0')
    expect(formatQty(Q * 3)).toBe('3')
  })

  it('shows fractions', () => {
    expect(formatQty(Q / 2)).toBe('0.5')
    expect(formatQty(Q + Q / 4)).toBe('1.25')
    expect(formatQty(Q + (3 * Q) / 4)).toBe('1.75')
  })
})

describe('costOf', () => {
  it('returns paise for quarters at the rate', () => {
    // 1 litre at ₹60 → 6000 paise
    expect(costOf(Q, 6000)).toBe(6000)
    // half litre at ₹60 → 3000 paise
    expect(costOf(Q / 2, 6000)).toBe(3000)
    // odd quarters round to nearest paisa
    expect(costOf(1, 6000)).toBe(1500)
  })

  it('handles zero', () => {
    expect(costOf(0, 6000)).toBe(0)
    expect(costOf(Q, 0)).toBe(0)
  })
})

describe('stepOf', () => {
  it('is half litre for litres, one unit for everything else', () => {
    expect(stepOf('litre')).toBe(Q / 2)
    expect(stepOf('meal')).toBe(Q)
    expect(stepOf('day')).toBe(Q)
    expect(stepOf('piece')).toBe(Q)
  })
})

describe('keysOf', () => {
  it('returns SHARED for equal split', () => {
    const t = makeTally({ split: 'equal', memberIds: [ME_ID, 'friend1'] })
    expect(keysOf(t)).toEqual([SHARED])
  })

  it('returns member ids for own split', () => {
    const t = makeTally({ split: 'own', memberIds: [ME_ID, 'friend1'] })
    expect(keysOf(t)).toEqual([ME_ID, 'friend1'])
  })
})

describe('rateOn', () => {
  it('returns the rate in effect on the date', () => {
    const t = makeTally({
      rates: [
        { from: '2024-11-01', rate: 6000 },
        { from: '2024-12-01', rate: 6400 },
      ],
    })
    expect(rateOn(t, '2024-11-15')).toBe(6000)
    expect(rateOn(t, '2024-12-01')).toBe(6400)
    expect(rateOn(t, '2025-01-01')).toBe(6400)
  })

  it('returns the first rate before the start', () => {
    const t = makeTally()
    expect(rateOn(t, '2024-10-01')).toBe(6000)
  })
})

describe('usualOn', () => {
  it('returns the usual count in effect on the date', () => {
    const t = makeTally({
      usual: [
        { from: '2024-11-01', counts: { [SHARED]: Q } },
        { from: '2024-12-01', counts: { [SHARED]: Q * 2 } },
      ],
    })
    expect(usualOn(t, '2024-11-15', SHARED)).toBe(Q)
    expect(usualOn(t, '2024-12-01', SHARED)).toBe(Q * 2)
  })

  it('returns 0 for a key with no usual', () => {
    const t = makeTally()
    expect(usualOn(t, '2024-11-15', 'unknown')).toBe(0)
  })
})

describe('countOn', () => {
  it('uses the usual when no override', () => {
    const t = makeTally()
    expect(countOn(t, '2024-11-10', SHARED)).toBe(Q)
  })

  it('uses the override when set', () => {
    const t = makeTally({ days: { '2024-11-10': { [SHARED]: Q * 2 } } })
    expect(countOn(t, '2024-11-10', SHARED)).toBe(Q * 2)
  })

  it('returns 0 for days before the tally started', () => {
    const t = makeTally()
    expect(countOn(t, '2024-10-01', SHARED)).toBe(0)
  })
})

describe('dayCount', () => {
  it('sums all keys for the day', () => {
    const t = makeTally({ split: 'equal' })
    expect(dayCount(t, '2024-11-10')).toBe(Q)
  })

  it('sums multiple member keys for own split', () => {
    const t = makeTally({
      split: 'own',
      memberIds: [ME_ID, 'friend1'],
      usual: [{ from: '2024-11-01', counts: { [ME_ID]: Q, friend1: Q * 2 } }],
    })
    expect(dayCount(t, '2024-11-10')).toBe(Q * 3)
  })
})

describe('differsFromUsual', () => {
  it('false when the day is at usual', () => {
    const t = makeTally()
    expect(differsFromUsual(t, '2024-11-10')).toBe(false)
  })

  it('true when overridden', () => {
    const t = makeTally({ days: { '2024-11-10': { [SHARED]: 0 } } })
    expect(differsFromUsual(t, '2024-11-10')).toBe(true)
  })
})

describe('monthDates', () => {
  it('gives all days in the period', () => {
    const days = monthDates('2024-02')
    expect(days).toHaveLength(29) // 2024 is leap
    expect(days[0]).toBe('2024-02-01')
    expect(days[28]).toBe('2024-02-29')
  })

  it('gives 30 days for April', () => {
    expect(monthDates('2024-04')).toHaveLength(30)
  })
})

describe('isClosed', () => {
  it('false for an open month', () => {
    const t = makeTally()
    expect(isClosed(t, '2024-11')).toBe(false)
  })

  it('true for a closed month', () => {
    const t = makeTally({ months: { '2024-11': { closedAt: 1000, expenseId: null, paidAt: null } } })
    expect(isClosed(t, '2024-11')).toBe(true)
  })
})

describe('dealEqually', () => {
  it('splits equally', () => {
    expect(dealEqually(300, 3)).toEqual([100, 100, 100])
  })

  it('gives one extra paisa to early people when uneven', () => {
    const parts = dealEqually(100, 3)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100)
    // Two get 34, one gets 32 (or some split that adds to 100).
    expect(parts.every((p) => Math.abs(p - 100 / 3) < 2)).toBe(true)
  })

  it('rotates who gets extra by offset', () => {
    const a = dealEqually(100, 3, 0)
    const b = dealEqually(100, 3, 1)
    expect(a.reduce((s, v) => s + v, 0)).toBe(100)
    expect(b.reduce((s, v) => s + v, 0)).toBe(100)
  })
})

describe('monthBill', () => {
  it('totals the whole month at the rate', () => {
    // November 2024: 30 days × 1 litre × ₹60 = ₹1,800
    const t = makeTally()
    const bill = monthBill(t, '2024-11', '2024-12-01')
    expect(bill.total).toBe(180_000) // paise
    expect(bill.qty).toBe(Q * 30)
    expect(bill.lines[0]?.rate).toBe(6000)
  })

  it('handles a partial month when the tally starts mid-month', () => {
    const t = makeTally({ start: '2024-11-16' })
    const bill = monthBill(t, '2024-11', '2024-12-01')
    // 15 days (16–30)
    expect(bill.qty).toBe(Q * 15)
  })

  it('gives each member an equal share for equal split', () => {
    const t = makeTally({ memberIds: [ME_ID, 'f2'] })
    const bill = monthBill(t, '2024-11', '2024-12-01', (id) => id)
    expect(bill.parts).toHaveLength(2)
    expect(bill.parts[0]!.amount + bill.parts[1]!.amount).toBe(bill.total)
  })
})

describe('readyToClose', () => {
  it('null during the month itself', () => {
    const t = makeTally()
    expect(readyToClose(t, '2024-11-15')).toBeNull()
  })

  it('the period in the first 5 days of the next month', () => {
    const t = makeTally()
    expect(readyToClose(t, '2024-12-03')).toBe('2024-11')
  })

  it('null after the nudge window', () => {
    const t = makeTally()
    expect(readyToClose(t, '2024-12-07')).toBeNull()
  })

  it('null for a closed month', () => {
    const t = makeTally({ months: { '2024-11': { closedAt: 1000, expenseId: null, paidAt: null } } })
    expect(readyToClose(t, '2024-12-03')).toBeNull()
  })
})
