import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMON_CURRENCIES, currencyForLanguages, currencyName, defaultCurrency, isKnownCurrency } from './currencies'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('COMMON_CURRENCIES', () => {
  it('lists the spec currencies once each, INR first', () => {
    const codes = COMMON_CURRENCIES.map((c) => c.code)
    expect(codes[0]).toBe('INR')
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'LKR', 'BRL']) expect(codes).toContain(code)
    for (const c of COMMON_CURRENCIES) expect(isKnownCurrency(c.code)).toBe(true)
  })
})

describe('currencyForLanguages', () => {
  it('maps regions to currencies', () => {
    expect(currencyForLanguages(['en-IN'])).toBe('INR')
    expect(currencyForLanguages(['en-US'])).toBe('USD')
    expect(currencyForLanguages(['en-GB'])).toBe('GBP')
    expect(currencyForLanguages(['de-DE'])).toBe('EUR')
    expect(currencyForLanguages(['fr-FR', 'en-US'])).toBe('EUR')
    expect(currencyForLanguages(['ja-JP'])).toBe('JPY')
    expect(currencyForLanguages(['ar-AE'])).toBe('AED')
    expect(currencyForLanguages(['zh-Hant-HK'])).toBe('HKD')
  })

  it('infers a likely region for bare languages, except English', () => {
    expect(currencyForLanguages(['hi'])).toBe('INR')
    expect(currencyForLanguages(['ja'])).toBe('JPY')
    expect(currencyForLanguages(['en'])).toBe('INR')
  })

  it('falls back to INR', () => {
    expect(currencyForLanguages([])).toBe('INR')
    expect(currencyForLanguages(['xx-QQ'])).toBe('INR')
    expect(currencyForLanguages(['not a tag!'])).toBe('INR')
  })
})

describe('defaultCurrency', () => {
  it('reads navigator.languages', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-SG', 'en'])
    expect(defaultCurrency()).toBe('SGD')
  })

  it('falls back to navigator.language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-AU')
    expect(defaultCurrency()).toBe('AUD')
  })
})

describe('isKnownCurrency', () => {
  it('accepts real upper-case ISO codes only', () => {
    expect(isKnownCurrency('INR')).toBe(true)
    expect(isKnownCurrency('KWD')).toBe(true)
    expect(isKnownCurrency('inr')).toBe(false)
    expect(isKnownCurrency('ABC')).toBe(false)
    expect(isKnownCurrency('RUPEES')).toBe(false)
    expect(isKnownCurrency('')).toBe(false)
  })
})

describe('currencyName', () => {
  it('names currencies', () => {
    expect(currencyName('INR')).toMatch(/rupee/i)
    expect(currencyName('ZZZ')).toBe('ZZZ')
  })
})
