import { describe, expect, it } from 'vitest'
import { crossRate, rateString } from '../../engine/fx'
import {
  abroadView,
  cleanHandle,
  currencyFromPhone,
  MAX_HANDLE,
  MAX_OTHER_NOTE,
  paidIssue,
  paidOutcome,
  payLink,
  rateLine,
  type AbroadSetup,
} from './engine'

const setup = (patch: Partial<AbroadSetup> = {}): AbroadSetup => ({ currency: 'USD', via: 'paypal', handle: 'riyasharma', ...patch })

describe('cleanHandle', () => {
  it('keeps a bare name, without the @', () => {
    expect(cleanHandle('paypal', 'riyasharma')).toBe('riyasharma')
    expect(cleanHandle('paypal', '  RiyaSharma  ')).toBe('RiyaSharma')
    expect(cleanHandle('wise', '@riyas12')).toBe('riyas12')
    expect(cleanHandle('revolut', '@riya_1.x-y')).toBe('riya_1.x-y')
  })

  it('takes the name out of a pasted link', () => {
    expect(cleanHandle('paypal', 'paypal.me/riyasharma')).toBe('riyasharma')
    expect(cleanHandle('paypal', 'https://paypal.me/riyasharma/25USD')).toBe('riyasharma')
    expect(cleanHandle('paypal', 'https://www.paypal.me/riyasharma?country.x=US&locale.x=en_US')).toBe('riyasharma')
    expect(cleanHandle('paypal', 'https://www.paypal.com/paypalme/riyasharma')).toBe('riyasharma')
    expect(cleanHandle('wise', 'https://wise.com/pay/me/riyas12')).toBe('riyas12')
    expect(cleanHandle('wise', 'wise.com/pay/me/riyas12/')).toBe('riyas12')
    expect(cleanHandle('revolut', 'https://revolut.me/riya1')).toBe('riya1')
    expect(cleanHandle('revolut', 'revolut.me/riya1#pay')).toBe('riya1')
  })

  it('blank stays blank: the name is optional', () => {
    expect(cleanHandle('paypal', '')).toBe('')
    expect(cleanHandle('wise', '   ')).toBe('')
    expect(cleanHandle('other', ' ')).toBe('')
  })

  it('refuses what can’t be a name there', () => {
    expect(cleanHandle('paypal', 'riya sharma')).toBeNull()
    expect(cleanHandle('paypal', 'riya@okaxis')).toBeNull()
    expect(cleanHandle('paypal', 'https://example.com/riya')).toBeNull()
    expect(cleanHandle('wise', 'https://paypal.me/riya')).toBeNull()
    expect(cleanHandle('revolut', 'https://wise.com/pay/me/riya')).toBeNull()
    expect(cleanHandle('paypal', 'paypal.me/')).toBeNull()
    expect(cleanHandle('paypal', '@')).toBeNull()
    expect(cleanHandle('paypal', 'x'.repeat(MAX_HANDLE + 1))).toBeNull()
    expect(cleanHandle('paypal', 'riya<script>')).toBeNull()
  })

  it('“other” is a note in the person’s own words, tidied to one line', () => {
    expect(cleanHandle('other', '  Zelle to   her US\nnumber ')).toBe('Zelle to her US number')
    expect(cleanHandle('other', 'https://example.com/pay/riya')).toBe('https://example.com/pay/riya')
    expect(cleanHandle('other', 'x'.repeat(300))).toHaveLength(MAX_OTHER_NOTE)
  })
})

describe('payLink', () => {
  it('PayPal.Me carries the amount and the currency', () => {
    expect(payLink(setup(), 4520)).toEqual({ url: 'https://paypal.me/riyasharma/45.20USD', withAmount: true })
    expect(payLink(setup(), 5000)).toEqual({ url: 'https://paypal.me/riyasharma/50USD', withAmount: true })
    expect(payLink(setup({ currency: 'GBP' }), 3205)).toEqual({ url: 'https://paypal.me/riyasharma/32.05GBP', withAmount: true })
    expect(payLink(setup({ currency: 'EUR' }), 1)).toEqual({ url: 'https://paypal.me/riyasharma/0.01EUR', withAmount: true })
    // Yen has no decimals.
    expect(payLink(setup({ currency: 'JPY' }), 6400)).toEqual({ url: 'https://paypal.me/riyasharma/6400JPY', withAmount: true })
  })

  it('PayPal.Me without an amount, or in a currency its link isn’t given one in, is the plain profile link', () => {
    expect(payLink(setup(), null)).toEqual({ url: 'https://paypal.me/riyasharma', withAmount: false })
    expect(payLink(setup(), 0)).toEqual({ url: 'https://paypal.me/riyasharma', withAmount: false })
    expect(payLink(setup(), 12.5)).toEqual({ url: 'https://paypal.me/riyasharma', withAmount: false })
    expect(payLink(setup({ currency: 'AED' }), 18000)).toEqual({ url: 'https://paypal.me/riyasharma', withAmount: false })
    expect(payLink(setup({ currency: 'INR' }), 400000)).toEqual({ url: 'https://paypal.me/riyasharma', withAmount: false })
  })

  it('Wise and Revolut are plain profile links: the amount is copied, never put in the link', () => {
    expect(payLink(setup({ via: 'wise', handle: 'riyas12' }), 4520)).toEqual({ url: 'https://wise.com/pay/me/riyas12', withAmount: false })
    expect(payLink(setup({ via: 'revolut', handle: 'riya1' }), 4520)).toEqual({ url: 'https://revolut.me/riya1', withAmount: false })
  })

  it('no name saved, a note, or a name that can’t be one: no link at all', () => {
    expect(payLink(setup({ handle: '' }), 4520)).toBeNull()
    expect(payLink(setup({ via: 'other', handle: 'Zelle to her US number' }), 4520)).toBeNull()
    expect(payLink(setup({ handle: 'riya sharma' }), 4520)).toBeNull()
    expect(payLink(setup({ via: 'wise', handle: 'https://evil.example/x' }), 4520)).toBeNull()
  })

  it('a saved link is reduced to the name before it is used', () => {
    expect(payLink(setup({ handle: 'https://paypal.me/riyasharma/10USD' }), 4520)?.url).toBe('https://paypal.me/riyasharma/45.20USD')
  })
})

describe('abroadView', () => {
  it('you owe them: rupees and their currency at the rate', () => {
    expect(abroadView(-400_000, 'INR', 'USD', '0.0113')).toEqual({
      side: 'youOwe',
      amount: 400_000,
      currency: 'INR',
      theirCurrency: 'USD',
      theirAmount: 4520,
      same: false,
    })
  })

  it('they owe you', () => {
    expect(abroadView(400_000, 'INR', 'GBP', '0.008')).toMatchObject({ side: 'theyOwe', amount: 400_000, theirAmount: 3200 })
  })

  it('even: nothing to convert', () => {
    expect(abroadView(0, 'INR', 'USD', '0.0113')).toEqual({ side: 'even', amount: 0, currency: 'INR', theirCurrency: 'USD', theirAmount: null, same: false })
    expect(abroadView(Number.NaN, 'INR', 'USD', '0.0113').side).toBe('even')
  })

  it('a rate from the cached table (per euro) gives the same paise every time', () => {
    // The cache holds units per 1 EUR; the rate between two currencies is their ratio.
    const table = { EUR: 1, INR: 90.4321, USD: 1.0812, AED: 1.0812 * 3.6725 }
    const usd = rateString(crossRate(table, 'INR', 'USD') ?? Number.NaN)
    expect(usd).not.toBeNull()
    // ₹4,000 × 1.0812 / 90.4321 = $47.8237…
    expect(abroadView(-400_000, 'INR', 'USD', usd).theirAmount).toBe(4782)
    const aed = rateString(crossRate(table, 'INR', 'AED') ?? Number.NaN)
    // ₹4,000 × 3.970707 / 90.4321 = AED 175.63…
    expect(abroadView(-400_000, 'INR', 'AED', aed).theirAmount).toBe(17563)
    // A currency the table doesn't have: no rate, so no amount in it.
    expect(crossRate(table, 'INR', 'KWD')).toBeNull()
    expect(abroadView(-400_000, 'INR', 'KWD', null).theirAmount).toBeNull()
  })

  it('a missing or unreadable rate: the rupee amount stands alone', () => {
    expect(abroadView(-400_000, 'INR', 'USD', null)).toMatchObject({ side: 'youOwe', amount: 400_000, theirAmount: null })
    expect(abroadView(-400_000, 'INR', 'USD', 'abc').theirAmount).toBeNull()
    expect(abroadView(-400_000, 'INR', 'USD', '0').theirAmount).toBeNull()
    expect(abroadView(-400_000, 'INR', 'USD', '-1').theirAmount).toBeNull()
  })

  it('rounds half up to their smallest unit; currencies without decimals work', () => {
    // ₹1 at 0.0113 is 1.13 cents.
    expect(abroadView(-100, 'INR', 'USD', '0.0113').theirAmount).toBe(1)
    // ₹4,000 at 1.6 yen a rupee is ¥6,400 (yen has no minor unit).
    expect(abroadView(-400_000, 'INR', 'JPY', '1.6').theirAmount).toBe(6400)
    // ₹0.50 at 0.0125 is 0.625 cents: rounds to 1 cent.
    expect(abroadView(-50, 'INR', 'USD', '0.0125').theirAmount).toBe(1)
  })

  it('too small to be anything in their currency: no amount is shown', () => {
    // 30 paise is a third of a cent.
    expect(abroadView(-30, 'INR', 'USD', '0.0113').theirAmount).toBeNull()
  })

  it('money already in their currency is not converted', () => {
    expect(abroadView(-2_000, 'USD', 'USD', null)).toEqual({ side: 'youOwe', amount: 2_000, currency: 'USD', theirCurrency: 'USD', theirAmount: 2_000, same: true })
  })

  it('a huge amount stays exact', () => {
    expect(abroadView(-1e12, 'INR', 'USD', '0.0113').theirAmount).toBe(11_300_000_000)
  })
})

describe('rateLine', () => {
  it('one of theirs in ours, when theirs is worth more', () => {
    expect(rateLine('0.0125', 'INR', 'USD')).toEqual({ left: { amount: 100, currency: 'USD' }, right: { amount: 8000, currency: 'INR' } })
    expect(rateLine('0.0113', 'INR', 'USD')?.right).toEqual({ amount: 8850, currency: 'INR' })
    expect(rateLine('0.008', 'INR', 'GBP')?.right).toEqual({ amount: 12500, currency: 'INR' })
  })

  it('a hundred of ours in theirs, when theirs is worth less', () => {
    expect(rateLine('1.6', 'INR', 'JPY')).toEqual({ left: { amount: 10000, currency: 'INR' }, right: { amount: 160, currency: 'JPY' } })
    expect(rateLine('188.13', 'INR', 'IDR')?.left).toEqual({ amount: 10000, currency: 'INR' })
  })

  it('nothing for a rate that can’t be read', () => {
    expect(rateLine('abc', 'INR', 'USD')).toBeNull()
    expect(rateLine('0', 'INR', 'USD')).toBeNull()
    expect(rateLine('', 'INR', 'USD')).toBeNull()
  })
})

describe('I’ve paid', () => {
  it('needs an amount', () => {
    expect(paidIssue(null)).toBe('amount')
    expect(paidIssue(0)).toBe('amount')
    expect(paidIssue(-5)).toBe('amount')
    expect(paidIssue(10.5)).toBe('amount')
    expect(paidIssue(1)).toBeNull()
  })

  it('“all”: everything owed is cleared, whatever it cost', () => {
    expect(paidOutcome('all', 400_000, 400_000)).toEqual({ settled: 400_000, cost: 400_000 })
    // Fees and the bank's rate: it cost more, the due is the same.
    expect(paidOutcome('all', 408_500, 400_000)).toEqual({ settled: 400_000, cost: 408_500 })
    // A kinder rate than the reference one: it cost less, and the due is still cleared.
    expect(paidOutcome('all', 395_000, 400_000)).toEqual({ settled: 400_000, cost: 395_000 })
  })

  it('“part”: what was typed is what is settled, never more than is owed', () => {
    expect(paidOutcome('part', 100_000, 400_000)).toEqual({ settled: 100_000, cost: 100_000 })
    expect(paidOutcome('part', 400_000, 400_000)).toEqual({ settled: 400_000, cost: 400_000 })
    expect(paidOutcome('part', 999_999, 400_000)).toEqual({ settled: 400_000, cost: 999_999 })
    expect(paidOutcome('part', 1, 400_000)).toEqual({ settled: 1, cost: 1 })
  })
})

describe('currencyFromPhone', () => {
  it('guesses from the country code', () => {
    expect(currencyFromPhone('+14155550123')).toBe('USD')
    expect(currencyFromPhone('+971 50 123 4567')).toBe('AED')
    expect(currencyFromPhone('+44 7700 900123')).toBe('GBP')
    expect(currencyFromPhone('+65-8123-4567')).toBe('SGD')
    expect(currencyFromPhone('+61412345678')).toBe('AUD')
    expect(currencyFromPhone('+4915112345678')).toBe('EUR')
    expect(currencyFromPhone('0033612345678')).toBe('EUR')
  })

  it('no guess for an Indian number, a number without a country code, an unknown code or junk', () => {
    expect(currencyFromPhone('+919876543210')).toBeNull()
    expect(currencyFromPhone('9876543210')).toBeNull()
    expect(currencyFromPhone('+2348012345678')).toBeNull()
    expect(currencyFromPhone('+1')).toBeNull()
    expect(currencyFromPhone('hello')).toBeNull()
    expect(currencyFromPhone('')).toBeNull()
    expect(currencyFromPhone(null)).toBeNull()
    expect(currencyFromPhone(undefined)).toBeNull()
  })
})
