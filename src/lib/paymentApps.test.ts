import { describe, expect, it } from 'vitest'
import { GALLERY_QR_MAX_PAISE, openAppHref, PAY_APPS, payPlatform } from './paymentApps'

describe('payPlatform', () => {
  it('tells Android, iPhone / iPad (which says it is a Mac, with touch) and the rest apart', () => {
    expect(payPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe('android')
    expect(payPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('ios')
    expect(payPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
    expect(payPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other')
    expect(payPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('other')
  })
})

describe('openAppHref', () => {
  it('opens an app’s home screen on iPhone — the bare scheme, never a payment', () => {
    expect(PAY_APPS.map((app) => openAppHref(app, 'ios'))).toEqual(['gpay://', 'phonepe://', 'paytmmp://', 'bhim://'])
  })

  it('offers nothing elsewhere (Android can’t open an app’s home screen from a web page)', () => {
    for (const app of PAY_APPS) {
      expect(openAppHref(app, 'android')).toBeNull()
      expect(openAppHref(app, 'other')).toBeNull()
    }
  })
})

describe('GALLERY_QR_MAX_PAISE', () => {
  it('is ₹2,000, the most a QR picture can pay a person (NPCI OC 76C)', () => {
    expect(GALLERY_QR_MAX_PAISE).toBe(200_000)
  })
})
