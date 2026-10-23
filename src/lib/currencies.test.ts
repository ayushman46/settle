import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMON_CURRENCIES, currencyForLanguages, currencyForTimeZone, currencyName, defaultCurrency, isKnownCurrency } from './currencies'

/** Pretends the device clock is in `timeZone`. */
function zone(timeZone: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions)
}

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

describe('currencyForTimeZone', () => {
  it('knows India by either name, and the places many Indians live', () => {
    expect(currencyForTimeZone('Asia/Kolkata')).toBe('INR')
    expect(currencyForTimeZone('Asia/Calcutta')).toBe('INR')
    expect(currencyForTimeZone('Asia/Dubai')).toBe('AED')
    expect(currencyForTimeZone('Asia/Singapore')).toBe('SGD')
    expect(currencyForTimeZone('Europe/London')).toBe('GBP')
  })

  it('says nothing for other zones', () => {
    for (const z of ['UTC', 'America/New_York', 'Europe/Berlin', '', null, undefined, 'toString', '__proto__']) expect(currencyForTimeZone(z)).toBeNull()
  })
})

describe('defaultCurrency', () => {
  it('trusts the clock over the language: an en-US phone in India is in rupees', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US', 'en-IN'])
    zone('Asia/Calcutta')
    expect(defaultCurrency()).toBe('INR')
    zone('Asia/Kolkata')
    expect(defaultCurrency()).toBe('INR')
  })

  it('reads navigator.languages when the time zone says nothing', () => {
    zone('UTC')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-SG', 'en'])
    expect(defaultCurrency()).toBe('SGD')
  })

  it('falls back to navigator.language', () => {
    zone('America/New_York')
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

describe('currency names load lazily', () => {
  it('builds Intl.DisplayNames on the first name asked for, once, not at import', async () => {
    vi.resetModules()
    const spy = vi.spyOn(Intl, 'DisplayNames')
    const fresh = await import('./currencies')
    expect(fresh.isKnownCurrency('INR')).toBe(true)
    expect(fresh.defaultCurrency()).toMatch(/^[A-Z]{3}$/)
    expect(spy).not.toHaveBeenCalled()
    expect(fresh.currencyName('INR')).toMatch(/rupee/i)
    expect(fresh.currencyName('EUR')).toMatch(/euro/i)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('falls back to the built-in names when the browser has no DisplayNames', async () => {
    vi.resetModules()
    const spy = vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => {
      throw new RangeError('unsupported')
    })
    const fresh = await import('./currencies')
    expect(fresh.currencyName('INR')).toBe('Indian Rupee')
    expect(fresh.currencyName('THB')).toBe('Thai Baht')
    expect(fresh.currencyName('ZZZ')).toBe('ZZZ')
    // A browser that can't build it isn't asked again on every call.
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
