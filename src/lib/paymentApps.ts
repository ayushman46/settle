/**
 * Choosing the UPI app to pay with. Each app gets a link that opens it directly with the payee,
 * amount and note already filled in, so paying is "pick the app, confirm".
 *
 * - Android: an `intent://` link with the app's package (how Chrome opens one specific app), which
 *   goes to the app's Play Store page when it isn't installed.
 * - iPhone and iPad: the app's own URL scheme with the standard UPI query
 *   (`<scheme>://upi/pay?pa=…&am=…`), the per-app prefixes the payment gateways document for iOS
 *   (PayU's UPI intent guide; Cashfree's scheme list). iOS can't tell a web page whether an app is
 *   installed, so the chooser says so if Safari is still showing the page after the tap.
 * - "Any UPI app", and everything else: the generic `upi://pay` link (the system picks the app).
 */
import { buildUpiLink, type UpiLinkInput } from './upi'

export type PayAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'any'

/** Where the page runs, as far as opening payment apps goes. */
export type PayPlatform = 'android' | 'ios' | 'other'

export interface PayApp {
  id: PayAppId
  /** The app's name as it appears on its icon (brand names are not translated). */
  name: string
  /** Android package to open it directly; null for the generic link. */
  androidPackage: string | null
  /** iOS URL scheme to open it directly; null for the generic link. */
  iosScheme: string | null
}

/** The apps offered, in the order people usually reach for them. */
export const PAY_APPS: readonly PayApp[] = [
  { id: 'gpay', name: 'Google Pay', androidPackage: 'com.google.android.apps.nbu.paisa.user', iosScheme: 'gpay' },
  { id: 'phonepe', name: 'PhonePe', androidPackage: 'com.phonepe.app', iosScheme: 'phonepe' },
  { id: 'paytm', name: 'Paytm', androidPackage: 'net.one97.paytm', iosScheme: 'paytmmp' },
  { id: 'bhim', name: 'BHIM', androidPackage: 'in.org.npci.upiapp', iosScheme: 'bhim' },
  { id: 'any', name: '', androidPackage: null, iosScheme: null },
]

/** What a device without per-app links gets: just the generic one. */
const GENERIC: readonly PayApp[] = PAY_APPS.filter((app) => app.id === 'any')

/** The apps to offer on `platform`. */
export function payAppsFor(platform: PayPlatform): readonly PayApp[] {
  return platform === 'other' ? GENERIC : PAY_APPS
}

/**
 * Android phones and tablets → 'android'; iPhones, iPods and iPads → 'ios' (iPadOS reports itself
 * as a Mac, so a "Mac" with a touch screen counts too); anything else → 'other'.
 */
export function payPlatform(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: number = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): PayPlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  return 'other'
}

/** The link that opens `app` on `platform` with `input` filled in. */
export function payAppLink(app: PayApp, input: UpiLinkInput, platform: PayPlatform): string {
  const upi = buildUpiLink(input)
  // `upi://pay?…` → the query every UPI app reads, kept exactly as the generic link has it.
  const query = upi.slice('upi://pay?'.length)
  if (platform === 'android' && app.androidPackage !== null) {
    const store = `https://play.google.com/store/apps/details?id=${app.androidPackage}`
    return `intent://pay?${query}#Intent;scheme=upi;package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(store)};end`
  }
  if (platform === 'ios' && app.iosScheme !== null) return `${app.iosScheme}://upi/pay?${query}`
  return upi
}
