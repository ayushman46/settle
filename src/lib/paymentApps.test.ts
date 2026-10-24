import { describe, expect, it } from 'vitest'
import { buildUpiLink } from './upi'
import { isAndroid, PAY_APPS, payAppLink, payAppsFor, type PayApp } from './paymentApps'

const input = { vpa: 'riya@okicici', payeeName: 'Riya Sharma', amountMinor: 69150, note: 'Dinner at Toit' }
const app = (id: PayApp['id']): PayApp => PAY_APPS.find((a) => a.id === id) as PayApp

describe('payAppsFor', () => {
  it('offers every app on Android and only the generic link elsewhere', () => {
    expect(payAppsFor(true).map((a) => a.id)).toEqual(['gpay', 'phonepe', 'paytm', 'bhim', 'any'])
    expect(payAppsFor(false).map((a) => a.id)).toEqual(['any'])
  })

  it('uses the Android package names the UPI apps publish', () => {
    expect(app('gpay').androidPackage).toBe('com.google.android.apps.nbu.paisa.user')
    expect(app('phonepe').androidPackage).toBe('com.phonepe.app')
    expect(app('paytm').androidPackage).toBe('net.one97.paytm')
    expect(app('bhim').androidPackage).toBe('in.org.npci.upiapp')
    expect(app('any').androidPackage).toBeNull()
  })
})

describe('isAndroid', () => {
  it('recognises Android browsers and not the others', () => {
    expect(isAndroid('Mozilla/5.0 (Linux; Android 14; SM-A155F) Chrome/155')).toBe(true)
    expect(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')).toBe(false)
    expect(isAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155')).toBe(false)
  })
})

describe('payAppLink', () => {
  it('opens the chosen app directly, with the same payment the generic link carries', () => {
    const link = payAppLink(app('gpay'), input, true)
    expect(link.startsWith('intent://pay?')).toBe(true)
    const [query, fragment] = link.replace('intent://', '').split('#')
    expect(query).toBe(buildUpiLink(input).replace('upi://', ''))
    expect(fragment).toBe(
      'Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;' +
        'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.google.android.apps.nbu.paisa.user;end',
    )
  })

  it('carries the payee, the amount in rupees and the note, as the UPI app reads them', () => {
    const url = new URL(payAppLink(app('phonepe'), input, true).replace('intent://', 'https://x/'))
    expect(url.searchParams.get('pa')).toBe('riya@okicici')
    expect(url.searchParams.get('pn')).toBe('Riya Sharma')
    expect(url.searchParams.get('am')).toBe('691.50')
    expect(url.searchParams.get('cu')).toBe('INR')
    expect(url.searchParams.get('tn')).toBe('Dinner at Toit')
  })

  it('leaves the amount out when there is none, so the app asks for it', () => {
    const url = new URL(payAppLink(app('paytm'), { ...input, amountMinor: 0 }, true).replace('intent://', 'https://x/'))
    expect(url.searchParams.has('am')).toBe(false)
    expect(url.searchParams.get('pa')).toBe('riya@okicici')
  })

  it('gives the generic link for "Any UPI app", and for every app off Android', () => {
    expect(payAppLink(app('any'), input, true)).toBe(buildUpiLink(input))
    for (const id of ['gpay', 'phonepe', 'paytm', 'bhim'] as const) {
      expect(payAppLink(app(id), input, false)).toBe(buildUpiLink(input))
    }
  })

  it('never puts a raw space or a bare "#" inside the query', () => {
    const link = payAppLink(app('bhim'), { ...input, note: 'Trip & snacks (Goa)' }, true)
    const query = link.slice('intent://'.length, link.indexOf('#'))
    expect(query).not.toMatch(/\s/)
    expect(query.match(/#/g)).toBeNull()
    expect(new URL(link.replace('intent://', 'https://x/')).searchParams.get('tn')).toBe('Trip & snacks (Goa)')
  })
})
