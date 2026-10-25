import { describe, expect, it } from 'vitest'
import { buildUpiLink } from './upi'
import { PAY_APPS, payAppLink, payAppsFor, payPlatform, type PayApp } from './paymentApps'

const input = { vpa: 'riya@okicici', payeeName: 'Riya Sharma', amountMinor: 69150, note: 'Dinner at Toit' }
const app = (id: PayApp['id']): PayApp => PAY_APPS.find((a) => a.id === id) as PayApp
/** The UPI query of a link, whatever its scheme. */
const params = (link: string) => new URL(`https://x/?${link.slice(link.indexOf('?') + 1).split('#')[0]}`).searchParams

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 Chrome/155 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155 Safari/537.36'

describe('payPlatform', () => {
  it('tells Android, iPhone / iPad (which says it is a Mac, with touch) and the rest apart', () => {
    expect(payPlatform(ANDROID, 5)).toBe('android')
    expect(payPlatform(IPHONE, 5)).toBe('ios')
    expect(payPlatform(IPAD, 5)).toBe('ios')
    expect(payPlatform(IPAD, 0)).toBe('other')
    expect(payPlatform(WINDOWS, 0)).toBe('other')
  })
})

describe('payAppsFor', () => {
  it('offers every app on Android and iPhone, and only the generic link elsewhere', () => {
    expect(payAppsFor('android').map((a) => a.id)).toEqual(['gpay', 'phonepe', 'paytm', 'bhim', 'any'])
    expect(payAppsFor('ios').map((a) => a.id)).toEqual(['gpay', 'phonepe', 'paytm', 'bhim', 'any'])
    expect(payAppsFor('other').map((a) => a.id)).toEqual(['any'])
  })

  it('uses the Android packages and iOS schemes the UPI apps register', () => {
    expect(PAY_APPS.map((a) => [a.id, a.androidPackage, a.iosScheme])).toEqual([
      ['gpay', 'com.google.android.apps.nbu.paisa.user', 'gpay'],
      ['phonepe', 'com.phonepe.app', 'phonepe'],
      ['paytm', 'net.one97.paytm', 'paytmmp'],
      ['bhim', 'in.org.npci.upiapp', 'bhim'],
      ['any', null, null],
    ])
  })
})

describe('payAppLink', () => {
  it('on Android, opens the chosen app directly with the same payment the generic link carries', () => {
    const link = payAppLink(app('gpay'), input, 'android')
    const [query, fragment] = link.replace('intent://', '').split('#')
    expect(query).toBe(buildUpiLink(input).replace('upi://', ''))
    expect(fragment).toBe(
      'Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;' +
        'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.google.android.apps.nbu.paisa.user;end',
    )
  })

  it('on iPhone, opens the chosen app by its scheme with the standard UPI query', () => {
    const generic = buildUpiLink(input)
    const query = generic.slice('upi://pay?'.length)
    expect(payAppLink(app('gpay'), input, 'ios')).toBe(`gpay://upi/pay?${query}`)
    expect(payAppLink(app('phonepe'), input, 'ios')).toBe(`phonepe://upi/pay?${query}`)
    expect(payAppLink(app('paytm'), input, 'ios')).toBe(`paytmmp://upi/pay?${query}`)
    expect(payAppLink(app('bhim'), input, 'ios')).toBe(`bhim://upi/pay?${query}`)
  })

  it('carries the payee, the amount in rupees and the note on every platform', () => {
    for (const platform of ['android', 'ios', 'other'] as const) {
      const p = params(payAppLink(app('phonepe'), input, platform))
      expect([p.get('pa'), p.get('pn'), p.get('am'), p.get('cu'), p.get('tn')]).toEqual(['riya@okicici', 'Riya Sharma', '691.50', 'INR', 'Dinner at Toit'])
    }
  })

  it('leaves the amount out when there is none, so the app asks for it', () => {
    for (const platform of ['android', 'ios'] as const) {
      const p = params(payAppLink(app('paytm'), { ...input, amountMinor: 0 }, platform))
      expect(p.has('am')).toBe(false)
      expect(p.get('pa')).toBe('riya@okicici')
    }
  })

  it('gives the generic link for "Any UPI app" everywhere, and for every app on other devices', () => {
    for (const platform of ['android', 'ios', 'other'] as const) expect(payAppLink(app('any'), input, platform)).toBe(buildUpiLink(input))
    for (const id of ['gpay', 'phonepe', 'paytm', 'bhim'] as const) expect(payAppLink(app(id), input, 'other')).toBe(buildUpiLink(input))
  })

  it('never puts a raw space or a bare "#" inside the query', () => {
    for (const platform of ['android', 'ios'] as const) {
      const link = payAppLink(app('bhim'), { ...input, note: 'Trip & snacks (Goa)' }, platform)
      const query = link.slice(link.indexOf('?') + 1).split('#')[0] ?? ''
      expect(query).not.toMatch(/\s/)
      expect(params(link).get('tn')).toBe('Trip & snacks (Goa)')
    }
  })
})
