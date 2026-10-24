/**
 * Choosing the UPI app to pay with. Each app gets a link that opens it directly with the payee,
 * amount and note already filled in, so paying is "pick the app, confirm". Android only: the
 * package names and the `intent://` form are how Chrome opens one specific app. The generic
 * `upi://pay` link (any UPI app, the system picks) is kept for "Any UPI app" and for iPhones,
 * where no per-app scheme is verified here, so the phone's own UPI app opens as it always did.
 */
import { buildUpiLink, type UpiLinkInput } from './upi'

export type PayAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'any'

export interface PayApp {
  id: PayAppId
  /** The app's name as it appears on its icon (brand names are not translated). */
  name: string
  /** Android package to open it directly; null for the generic link. */
  androidPackage: string | null
}

/** The apps offered on Android, in the order people usually reach for them. */
export const PAY_APPS: readonly PayApp[] = [
  { id: 'gpay', name: 'Google Pay', androidPackage: 'com.google.android.apps.nbu.paisa.user' },
  { id: 'phonepe', name: 'PhonePe', androidPackage: 'com.phonepe.app' },
  { id: 'paytm', name: 'Paytm', androidPackage: 'net.one97.paytm' },
  { id: 'bhim', name: 'BHIM', androidPackage: 'in.org.npci.upiapp' },
  { id: 'any', name: '', androidPackage: null },
]

/** What a phone without a per-app link gets: just the generic one. */
const GENERIC: readonly PayApp[] = PAY_APPS.filter((app) => app.id === 'any')

/** The apps to offer on this device. */
export function payAppsFor(android: boolean): readonly PayApp[] {
  return android ? PAY_APPS : GENERIC
}

/** True on Android phones and tablets (the only place the per-app links are used). */
export function isAndroid(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /android/i.test(userAgent)
}

/**
 * The link that opens `app` with `input` filled in. On Android with a package it is an
 * `intent://` link that opens that app, and sends to its Play Store page when it isn't installed;
 * otherwise the plain `upi://pay` link from `buildUpiLink`.
 */
export function payAppLink(app: PayApp, input: UpiLinkInput, android: boolean): string {
  const upi = buildUpiLink(input)
  if (!android || app.androidPackage === null) return upi
  const store = `https://play.google.com/store/apps/details?id=${app.androidPackage}`
  // `upi://pay?…` becomes `intent://pay?…`: the same query, opened as the UPI scheme in one package.
  return `intent://${upi.slice('upi://'.length)}#Intent;scheme=upi;package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(store)};end`
}
