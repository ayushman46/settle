import { describe, expect, it } from 'vitest'
import { allocate } from '../lib/money'
import { convertMinor, crossRate, formatRate, isValidRate, parseRate, RATE_PATTERN, rateFromTotals, rateString } from './fx'

/** The spec's fixture table (units per 1 EUR — not real rates), with two pegs derived from it. */
const ECB: Record<string, number> = { USD: 1.0812, JPY: 163.42, INR: 90.4321, THB: 37.512, SGD: 1.4103, IDR: 17012.5, GBP: 0.8364 }
const TABLE: Record<string, number> = { ...ECB, AED: (ECB.USD ?? 0) * 3.6725, NPR: (ECB.INR ?? 0) * 1.6 }

function rateToInr(code: string): string {
  const rate = rateString(crossRate(TABLE, code, 'INR') ?? Number.NaN)
  if (rate === null) throw new Error(`no rate for ${code}`)
  return rate
}

describe('crossRate → rateString → convertMinor (spec 06 §4 table)', () => {
  it.each([
    ['THB', 125000, '2.410751226', 301344],
    ['JPY', 4800, '0.5533722923', 265619],
    ['AED', 8550, '22.77481063', 194725],
    ['NPR', 150000, '0.625', 93750],
    ['IDR', 15000000, '0.005315626745', 79734],
    ['USD', 4999, '83.64049205', 418119],
    ['SGD', 2350, '64.12259803', 150688],
  ])('%s %i → rate %s → %i paise', (code, amount, rate, paise) => {
    expect(rateToInr(code)).toBe(rate)
    expect(convertMinor(amount, code, 'INR', rate)).toBe(paise)
  })

  it('splits a converted total exactly', () => {
    expect(allocate(convertMinor(125000, 'THB', 'INR', rateToInr('THB')), [1, 1, 1])).toEqual([100448, 100448, 100448])
  })

  it('keeps precision for tiny rates where a 6-decimal rate would drift (IDR regression)', () => {
    // A rate kept to 6 decimals (0.005316) costs ₹0.06 on Rp1,50,000; the 10-significant-digit string doesn't.
    expect(convertMinor(15000000, 'IDR', 'INR', '0.005316')).toBe(79740)
    expect(convertMinor(15000000, 'IDR', 'INR', rateToInr('IDR'))).toBe(79734)
  })

  it('crosses through EUR and refuses missing or broken entries', () => {
    expect(crossRate(TABLE, 'EUR', 'INR')).toBeCloseTo(90.4321, 10)
    expect(crossRate(TABLE, 'INR', 'EUR')).toBeCloseTo(1 / 90.4321, 12)
    expect(crossRate(TABLE, 'INR', 'INR')).toBe(1)
    expect(crossRate(TABLE, 'LKR', 'INR')).toBeNull()
    expect(crossRate(TABLE, 'THB', 'VND')).toBeNull()
    expect(crossRate({ THB: 0, INR: 90 }, 'THB', 'INR')).toBeNull()
    expect(crossRate({ THB: Number.NaN, INR: 90 }, 'THB', 'INR')).toBeNull()
  })
})

describe('manual total (what your bank charged)', () => {
  it('round-trips the spec example exactly', () => {
    expect(rateFromTotals(125000, 'THB', 310420, 'INR')).toBe('2.48336')
    expect(convertMinor(125000, 'THB', 'INR', '2.48336')).toBe(310420)
  })

  it('round-trips across currencies with different minor digits', () => {
    for (const [foreign, from, settle, to] of [
      [4800, 'JPY', 265619, 'INR'],
      [123456, 'KWD', 3_456_789, 'INR'],
      [15000000, 'IDR', 79734, 'INR'],
      [999, 'USD', 83_456, 'INR'],
      [100, 'INR', 1, 'JPY'],
    ] as const) {
      const rate = rateFromTotals(foreign, from, settle, to)
      expect(rate, `${from}→${to}`).not.toBeNull()
      expect(RATE_PATTERN.test(rate ?? '')).toBe(true)
      expect(convertMinor(foreign, from, to, rate ?? '')).toBe(settle)
    }
  })

  it('refuses amounts that are not positive whole minor units', () => {
    expect(rateFromTotals(0, 'THB', 100, 'INR')).toBeNull()
    expect(rateFromTotals(100, 'THB', 0, 'INR')).toBeNull()
    expect(rateFromTotals(1.5, 'THB', 100, 'INR')).toBeNull()
    expect(rateFromTotals(-5, 'THB', 100, 'INR')).toBeNull()
    // A rate needing more than 7 integer digits isn't storable.
    expect(rateFromTotals(1, 'INR', 1e12, 'INR')).toBeNull()
  })
})

describe('rate strings', () => {
  it('parses valid rates exactly', () => {
    expect(parseRate('2.410751226')).toEqual({ num: 2410751226n, den: 1000000000n })
    expect(parseRate('3')).toEqual({ num: 3n, den: 1n })
    expect(parseRate('0.000000123')).toEqual({ num: 123n, den: 1000000000n })
  })

  it('rejects zero, signs, exponents, too many decimals or digits', () => {
    for (const bad of ['0', '0.000', '-1', '1e3', '1.1234567890123', '12345678', '', ' 1', '1.', '.5', '1,5', 'abc']) {
      expect(parseRate(bad), bad).toBeNull()
      expect(isValidRate(bad), bad).toBe(false)
    }
    expect(isValidRate(2.5)).toBe(false)
    expect(isValidRate('2.5')).toBe(true)
  })

  it('writes rates with 10 significant digits and no exponent', () => {
    expect(rateString(0.000000123)).toBe('0.000000123')
    expect(rateString(2)).toBe('2')
    expect(rateString(1 / 3)).toBe('0.3333333333')
    expect(rateString(1234567.891)).toBe('1234567.891')
    expect(rateString(Number.NaN)).toBeNull()
    expect(rateString(0)).toBeNull()
    expect(rateString(-2)).toBeNull()
    expect(rateString(Number.POSITIVE_INFINITY)).toBeNull()
    expect(rateString(1e-14)).toBeNull() // rounds to 0 at 12 decimals
    expect(rateString(12345678)).toBeNull() // more than 7 integer digits
  })
})

describe('convertMinor', () => {
  it('is digits-aware for 0- and 3-digit currencies', () => {
    expect(convertMinor(1000, 'JPY', 'INR', '0.55')).toBe(55000) // ¥1,000 → ₹550.00
    expect(convertMinor(55000, 'INR', 'JPY', '1.8')).toBe(990) // ₹550 → ¥990
    expect(convertMinor(1500, 'KWD', 'INR', '270.5')).toBe(40575) // KWD 1.500 → ₹405.75
    expect(convertMinor(1, 'INR', 'KWD', '0.0037')).toBe(0) // rounds to nothing
  })

  it('rounds half up', () => {
    expect(convertMinor(1, 'USD', 'INR', '0.5')).toBe(1) // 0.5 paise → 1
    expect(convertMinor(1, 'USD', 'INR', '0.49')).toBe(0)
    expect(convertMinor(3, 'USD', 'INR', '0.5')).toBe(2) // 1.5 → 2
  })

  it('returns 0 for an invalid rate or amount', () => {
    expect(convertMinor(100, 'USD', 'INR', 'x')).toBe(0)
    expect(convertMinor(-100, 'USD', 'INR', '83')).toBe(0)
    expect(convertMinor(1.5, 'USD', 'INR', '83')).toBe(0)
  })
})

describe('formatRate', () => {
  it('shows at most 4 decimals for ordinary rates', () => {
    expect(formatRate('2.410751226', 'THB', 'INR')).toBe('2.4108')
    expect(formatRate('0.625', 'NPR', 'INR')).toBe('0.625')
    expect(formatRate('83.64049205', 'USD', 'INR')).toBe('83.6405')
    expect(formatRate('3', 'X', 'INR')).toBe('3')
  })

  it('turns tiny rates round', () => {
    expect(formatRate('0.005315626745', 'IDR', 'INR')).toBe('₹1 = 188.12 IDR') // 1 / 0.005315626745 = 188.1246…
  })

  it('echoes an unparseable rate', () => {
    expect(formatRate('abc', 'THB', 'INR')).toBe('abc')
  })
})
