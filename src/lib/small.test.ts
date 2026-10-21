import { afterEach, describe, expect, it, vi } from 'vitest'
import { cx } from './cx'
import { formatBillDate, formatPercent, formatQuantity } from './format'
import { newId } from './ids'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cx', () => {
  it('joins truthy class names', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
    expect(cx()).toBe('')
    const off = Number('0') > 1
    expect(cx(off && 'x', 'y')).toBe('y')
  })
})

describe('newId', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, newId))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID)
  })

  it('falls back to getRandomValues without randomUUID (plain-http LAN)', () => {
    const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
      const bytes = new Uint8Array(array.buffer)
      for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) & 0xff
      return array
    }
    vi.stubGlobal('crypto', { getRandomValues })
    expect(newId()).toMatch(UUID)
  })

  it('falls back to Math.random without crypto', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newId()).toMatch(UUID)
  })
})

describe('formatBillDate', () => {
  it('formats ISO dates in the user locale', () => {
    const expected = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(2026, 9, 18),
    )
    expect(formatBillDate('2026-10-18')).toBe(expected)
  })

  it('shows other dates as printed and rejects impossible ISO dates', () => {
    expect(formatBillDate('18/10/26')).toBe('18/10/26')
    expect(formatBillDate('2026-02-31')).toBe('2026-02-31')
    expect(formatBillDate('x'.repeat(60))).toHaveLength(40)
  })

  it('returns null for nothing', () => {
    expect(formatBillDate(null)).toBeNull()
    expect(formatBillDate(undefined)).toBeNull()
    expect(formatBillDate('  ')).toBeNull()
  })
})

describe('formatPercent', () => {
  it('formats ratios', () => {
    expect(formatPercent(0.0823)).toMatch(/^8\.2\s?%$/)
    expect(formatPercent(0.0823, { sign: 'always' })).toMatch(/^\+8\.2\s?%$/)
    expect(formatPercent(-0.031, { sign: 'always' })).toMatch(/^-3\.1\s?%$/)
    expect(formatPercent(-0.031, { sign: 'never' })).toMatch(/^3\.1\s?%$/)
    expect(formatPercent(0, { sign: 'always' })).toMatch(/^0\s?%$/)
    expect(formatPercent(Number.NaN)).toMatch(/^0\s?%$/)
    expect(formatPercent(0.5, { maxFractionDigits: 0 })).toMatch(/^50\s?%$/)
  })
})

describe('formatQuantity', () => {
  it('formats quantities', () => {
    expect(formatQuantity(2)).toBe('2')
    expect(formatQuantity(0.5)).toMatch(/^0[.,]5$/)
    expect(formatQuantity(Number.NaN)).toBe('1')
  })
})
