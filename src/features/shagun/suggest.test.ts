import { describe, expect, it } from 'vitest'
import { auspiciousAtLeast, suggestShagun, yearsBetween } from './suggest'

describe('auspiciousAtLeast', () => {
  it.each([
    [0, 11],
    [-5, 11],
    [1, 11],
    [11, 11],
    [12, 21],
    [21, 21],
    [22, 51],
    [51, 51],
    [52, 101],
    [101, 101],
    [102, 201],
    [420, 501],
    [501, 501],
    [502, 601],
    [1100, 1101],
    [1101, 1101],
    [1102, 1201],
    [1001, 1001],
    [2100, 2101],
    [2101, 2101],
    [5100, 5101],
    [5101, 5101],
    [99_999, 100_001],
  ])('%s rounds up to %s', (input, expected) => {
    expect(auspiciousAtLeast(input)).toBe(expected)
  })

  it('is never below the amount it rounds', () => {
    for (let n = 1; n <= 5_000; n += 37) expect(auspiciousAtLeast(n)).toBeGreaterThanOrEqual(n)
  })

  it('always ends in 1 once above ₹101', () => {
    for (let n = 102; n <= 20_000; n += 97) expect(auspiciousAtLeast(n) % 10).toBe(1)
  })

  it('treats non-numbers as the smallest amount', () => {
    expect(auspiciousAtLeast(Number.NaN)).toBe(11)
    expect(auspiciousAtLeast(Number.POSITIVE_INFINITY)).toBe(11)
  })
})

describe('yearsBetween', () => {
  it('counts whole calendar years and never goes negative', () => {
    expect(yearsBetween(new Date('2020-10-24'), new Date('2026-10-24'))).toBe(6)
    expect(yearsBetween(new Date('2020-10-24'), new Date('2026-10-23'))).toBe(5)
    expect(yearsBetween(new Date('2026-10-24'), new Date('2020-10-24'))).toBe(0)
  })
})

describe('suggestShagun', () => {
  it('gives back what they gave when it is the same year, rounded to an auspicious amount', () => {
    expect(suggestShagun({ gaveYou: 2100, yearsAgo: 0 })).toBe(2101)
    expect(suggestShagun({ gaveYou: 501, yearsAgo: 0 })).toBe(501)
  })

  it('grows the amount by 6% a year, then rounds', () => {
    // 1,000 × 1.06^5 = 1,338.23 → 1,401 (ceiling to the next hundred, plus one).
    expect(suggestShagun({ gaveYou: 1000, yearsAgo: 5 })).toBe(1401)
    // 2,100 × 1.06^6 = 2,978.9… → 3,001
    expect(suggestShagun({ gaveYou: 2100, yearsAgo: 6 })).toBe(3001)
  })

  it('never suggests less than they gave', () => {
    expect(suggestShagun({ gaveYou: 5100, yearsAgo: 0 })).toBeGreaterThanOrEqual(5100)
    expect(suggestShagun({ gaveYou: 1, yearsAgo: 0 })).toBe(11)
  })

  it('handles old entries without overflow or nonsense', () => {
    const forty = suggestShagun({ gaveYou: 500, yearsAgo: 40 })
    expect(forty).not.toBeNull()
    expect(forty ?? 0).toBeGreaterThan(5000)
    expect((forty ?? 0) % 10).toBe(1)
  })

  it('has no suggestion without a usable amount', () => {
    expect(suggestShagun({ gaveYou: 0, yearsAgo: 3 })).toBeNull()
    expect(suggestShagun({ gaveYou: -400, yearsAgo: 3 })).toBeNull()
    expect(suggestShagun({ gaveYou: Number.NaN, yearsAgo: 3 })).toBeNull()
  })

  it('treats a negative or fractional year count as whole years from zero', () => {
    expect(suggestShagun({ gaveYou: 501, yearsAgo: -2 })).toBe(501)
    expect(suggestShagun({ gaveYou: 1000, yearsAgo: 5.9 })).toBe(suggestShagun({ gaveYou: 1000, yearsAgo: 5 }))
  })
})
