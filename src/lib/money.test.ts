import { describe, expect, it } from 'vitest'
import {
  MAX_MINOR,
  allocate,
  cleanAmountText,
  currencyDigits,
  currencySymbol,
  formatMoney,
  fromMinor,
  parseMoneyInput,
  rescaleMinor,
  toInputString,
  toMinor,
} from './money'

/** Small seeded PRNG (mulberry32) so property tests are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const reference = (major: number, code: string, extra: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', ...extra }).format(major)

describe('currencyDigits', () => {
  it('knows minor-unit digits', () => {
    expect(currencyDigits('INR')).toBe(2)
    expect(currencyDigits('USD')).toBe(2)
    expect(currencyDigits('JPY')).toBe(0)
    expect(currencyDigits('KRW')).toBe(0)
    expect(currencyDigits('KWD')).toBe(3)
  })

  it('falls back to 2 for invalid codes', () => {
    expect(currencyDigits('nope')).toBe(2)
    expect(currencyDigits('')).toBe(2)
    expect(currencyDigits('12$')).toBe(2)
  })
})

describe('toMinor / fromMinor', () => {
  it('is immune to float noise', () => {
    expect(toMinor(0.1 + 0.2, 'USD')).toBe(30)
    expect(toMinor(19.99, 'USD')).toBe(1999)
    expect(toMinor(1.005, 'USD')).toBe(101)
    expect(toMinor(1.15, 'INR')).toBe(115)
    expect(toMinor(2299, 'INR')).toBe(229900)
    expect(toMinor(109.49, 'INR')).toBe(10949)
  })

  it('respects zero- and three-digit currencies', () => {
    expect(toMinor(1234, 'JPY')).toBe(1234)
    expect(toMinor(1234.6, 'JPY')).toBe(1235)
    expect(toMinor(1.2345, 'KWD')).toBe(1235)
  })

  it('handles negatives symmetrically and never returns -0', () => {
    expect(toMinor(-19.99, 'USD')).toBe(-1999)
    expect(toMinor(-1.005, 'USD')).toBe(-101)
    expect(Object.is(toMinor(-0.001, 'USD'), 0)).toBe(true)
  })

  it('maps non-finite input to 0', () => {
    expect(toMinor(Number.NaN, 'USD')).toBe(0)
    expect(toMinor(Number.POSITIVE_INFINITY, 'USD')).toBe(0)
  })

  it('round-trips every cent amount', () => {
    for (let cents = 0; cents < 100_000; cents += 7) {
      expect(toMinor(fromMinor(cents, 'USD'), 'USD')).toBe(cents)
    }
  })

  it('fromMinor converts back to major units', () => {
    expect(fromMinor(1999, 'USD')).toBe(19.99)
    expect(fromMinor(1234, 'JPY')).toBe(1234)
    expect(Object.is(fromMinor(-0, 'USD'), 0)).toBe(true)
  })
})

describe('rescaleMinor', () => {
  it('keeps the major value when digits change', () => {
    expect(rescaleMinor(1234, 'USD', 'JPY')).toBe(12)
    expect(rescaleMinor(1250, 'USD', 'JPY')).toBe(13)
    expect(rescaleMinor(12, 'JPY', 'USD')).toBe(1200)
    expect(rescaleMinor(1234, 'USD', 'KWD')).toBe(12340)
    expect(rescaleMinor(1234, 'USD', 'INR')).toBe(1234)
    expect(rescaleMinor(-1250, 'USD', 'JPY')).toBe(-13)
  })
})

describe('formatMoney', () => {
  it('formats with the narrow symbol in the user locale', () => {
    expect(formatMoney(123450, 'INR')).toBe(reference(1234.5, 'INR'))
    expect(formatMoney(123450, 'INR')).toContain('₹')
    expect(formatMoney(1999, 'USD')).toBe(reference(19.99, 'USD'))
    expect(formatMoney(1234, 'JPY')).toBe(reference(1234, 'JPY'))
  })

  it('shows two decimals by default and trims them on request', () => {
    expect(formatMoney(120000, 'INR')).toMatch(/1,200\.00$/)
    expect(formatMoney(120000, 'INR', { trimZeros: true })).toMatch(/₹\s?1,200$/)
    expect(formatMoney(120050, 'INR', { trimZeros: true })).toMatch(/1,200\.50$/)
  })

  it('handles signs', () => {
    expect(formatMoney(-500, 'USD')).toBe(reference(-5, 'USD'))
    expect(formatMoney(500, 'USD', { sign: 'always' })).toBe(reference(5, 'USD', { signDisplay: 'exceptZero' }))
    expect(formatMoney(500, 'USD', { sign: 'always' }).startsWith('+')).toBe(true)
    expect(formatMoney(0, 'USD', { sign: 'always' }).startsWith('+')).toBe(false)
    expect(formatMoney(-500, 'USD', { sign: 'never' })).toBe(reference(5, 'USD'))
    expect(formatMoney(-500, 'USD', { sign: 'negative' })).toBe(reference(-5, 'USD'))
    expect(formatMoney(-0, 'USD')).toBe(reference(0, 'USD'))
  })

  it('falls back to the code when Intl rejects the currency', () => {
    expect(formatMoney(1234, 'XX1')).toBe('XX1 12.34')
    expect(formatMoney(-1234, 'XX1')).toBe('-XX1 12.34')
    expect(formatMoney(1200, 'XX1', { trimZeros: true, sign: 'always' })).toBe('+XX1 12')
  })
})

describe('currencySymbol', () => {
  it('returns narrow symbols', () => {
    expect(currencySymbol('INR')).toBe('₹')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('EUR')).toBe('€')
  })

  it('falls back to the code', () => {
    expect(currencySymbol('XX1')).toBe('XX1')
  })
})

describe('parseMoneyInput', () => {
  const cases: Array<[string, number | null]> = [
    ['1,234.50', 123450],
    ['1234', 123400],
    ['₹1,234.5', 123450],
    [' 12 ', 1200],
    ['12.', 1200],
    ['.5', 50],
    ['0.05', 5],
    ['1,23,456.78', 12345678],
    ['1.234,50', 123450],
    ['1234,5', 123450],
    ['1,234', 123400],
    ['1.234.567,89', 123456789],
    ['1 234,56', 123456],
    ["1'234.50", 123450],
    ['Rs.99', 9900],
    ['Rs. 1,234', 123400],
    ['12,50 Rs.', 1250],
    ['$ .50', 50],
    ['0.125', 13],
    ['12.345', 1234500],
    ['१२३', 12300],
    ['١٢٫٥', 1250],
    ['', null],
    ['   ', null],
    ['abc', null],
    ['.', null],
    ['-5', null],
    ['−5', null],
    ['1.2.3,4.5', null],
    ['1,234.56.78', null],
  ]
  for (const [text, expected] of cases) {
    it(`parses ${JSON.stringify(text)} → ${String(expected)}`, () => {
      expect(parseMoneyInput(text, 'INR')).toBe(expected)
    })
  }

  it('uses the currency digits', () => {
    expect(parseMoneyInput('1,234', 'JPY')).toBe(1234)
    expect(parseMoneyInput('12.5', 'JPY')).toBe(13)
    expect(parseMoneyInput('12.345', 'KWD')).toBe(12345)
    expect(parseMoneyInput('1.234', 'EUR')).toBe(123400)
  })

  it('clamps huge amounts', () => {
    expect(parseMoneyInput('9'.repeat(30), 'INR')).toBe(MAX_MINOR)
  })

  it('round-trips toInputString for random amounts', () => {
    const random = rng(42)
    for (let i = 0; i < 500; i++) {
      const minor = Math.floor(random() * 1e9)
      expect(parseMoneyInput(toInputString(minor, 'INR'), 'INR')).toBe(minor)
      expect(parseMoneyInput(toInputString(minor, 'JPY'), 'JPY')).toBe(minor)
    }
  })
})

describe('toInputString', () => {
  it('is plain editable text', () => {
    expect(toInputString(123450, 'INR')).toBe('1234.50')
    expect(toInputString(5, 'INR')).toBe('0.05')
    expect(toInputString(1234, 'JPY')).toBe('1234')
    expect(toInputString(12345, 'KWD')).toBe('12.345')
    expect(toInputString(-150, 'USD')).toBe('-1.50')
    expect(toInputString(null, 'INR')).toBe('')
    expect(toInputString(120000, 'INR', { trimZeros: true })).toBe('1200')
    expect(toInputString(120050, 'INR', { trimZeros: true })).toBe('1200.50')
  })
})

describe('allocate', () => {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

  it('splits by largest remainder with lowest-index ties', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(10, [1, 1, 1, 1])).toEqual([3, 3, 2, 2])
    expect(allocate(101, [1, 2])).toEqual([34, 67])
    expect(allocate(1000, [2, 1])).toEqual([667, 333])
    expect(allocate(7, [0.5, 0.25, 0.25])).toEqual([3, 2, 2])
  })

  it('gives everything to the only positive weight', () => {
    expect(allocate(999, [0, 5, 0])).toEqual([0, 999, 0])
  })

  it('treats negative/NaN/Infinity weights as zero and all-zero as equal', () => {
    expect(allocate(10, [-1, Number.NaN, 2])).toEqual([0, 0, 10])
    expect(allocate(10, [Number.POSITIVE_INFINITY, 1])).toEqual([0, 10])
    expect(allocate(9, [0, 0, 0])).toEqual([3, 3, 3])
    expect(allocate(10, [-5, -5])).toEqual([5, 5])
  })

  it('mirrors negative totals', () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33])
    expect(allocate(-1, [1, 1]).map((v) => Object.is(v, -0))).toEqual([false, false])
  })

  it('handles empty weights and zero totals', () => {
    expect(allocate(500, [])).toEqual([])
    expect(allocate(0, [1, 2])).toEqual([0, 0])
  })

  it('is exact with awkward float weights', () => {
    const weights = [0.1, 0.2, 0.3, 1e-9, 1e12, 3.3333333]
    const parts = allocate(123_456_789, weights)
    expect(sum(parts)).toBe(123_456_789)
  })

  it('property: always sums to the total, proportional within 1, deterministic', () => {
    const random = rng(20261020)
    for (let run = 0; run < 2000; run++) {
      const n = 1 + Math.floor(random() * 12)
      const magnitude = Math.floor(random() * 10 ** (1 + Math.floor(random() * 9)))
      const total = random() < 0.1 && magnitude > 0 ? -magnitude : magnitude
      const weights = Array.from({ length: n }, () => {
        const r = random()
        if (r < 0.15) return 0
        if (r < 0.2) return -random()
        if (r < 0.6) return 1 + Math.floor(random() * 20)
        return random() * 1000
      })
      const parts = allocate(total, weights)
      expect(parts).toHaveLength(n)
      expect(sum(parts)).toBe(total)
      expect(parts.every(Number.isInteger)).toBe(true)
      expect(allocate(total, weights)).toEqual(parts)

      const clean = weights.map((w) => (w > 0 ? w : 0))
      const weightSum = clean.reduce((a, b) => a + b, 0)
      parts.forEach((part, i) => {
        const exact = weightSum > 0 ? (total * (clean[i] ?? 0)) / weightSum : total / n
        expect(Math.abs(part - exact)).toBeLessThan(1 + 1e-6)
        if (total >= 0) expect(part).toBeGreaterThanOrEqual(0)
      })
    }
  })
})

describe('cleanAmountText', () => {
  const cases: Array<[string, string, string]> = [
    ['1234', 'INR', '1234'],
    ['1234.5', 'INR', '1234.5'],
    ['1234.567', 'INR', '1234.56'],
    ['12,5', 'EUR', '12,5'],
    ['1.2.3', 'INR', '1.23'],
    ['007', 'INR', '7'],
    ['0', 'INR', '0'],
    ['00.5', 'INR', '0.5'],
    ['.5', 'INR', '0.5'],
    ['12.', 'INR', '12.'],
    ['abc12x3', 'INR', '123'],
    ['-5', 'INR', '5'],
    ['12.5', 'JPY', '125'],
    ['1.2345', 'KWD', '1.234'],
    ['12345678901234', 'INR', '1234567890'],
    ['₹1,234.50', 'INR', '1234.50'],
    ['1.234,00 €', 'EUR', '1234'],
    ['1,23,456', 'INR', '123456'],
    ['1,234,567', 'USD', '1234567'],
    ['9,99,99,99,999.99', 'INR', '9999999999.99'],
    ['१२.५', 'INR', '12.5'],
    ['', 'INR', ''],
  ]
  for (const [text, code, expected] of cases) {
    it(`${JSON.stringify(text)} (${code}) → ${JSON.stringify(expected)}`, () => {
      expect(cleanAmountText(text, code)).toBe(expected)
    })
  }

  it('always produces something parseMoneyInput reads back the same way', () => {
    const random = rng(7)
    const alphabet = '0123456789.,₹ -a'
    for (let i = 0; i < 500; i++) {
      const text = Array.from({ length: 1 + Math.floor(random() * 12) }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
      const cleaned = cleanAmountText(text, 'INR')
      expect(cleanAmountText(cleaned, 'INR')).toBe(cleaned)
      if (/\d/.test(cleaned)) expect(parseMoneyInput(cleaned, 'INR')).not.toBeNull()
    }
  })
})
