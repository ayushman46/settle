/**
 * The UPI apps people pay with, and where the page runs.
 *
 * Settle never builds a payment link to a person's UPI ID. NPCI tells payer apps to refuse P2P
 * payments started by a link or intent (OC 76C, April 2025; UPI Consolidated Circular, para 7.9),
 * and the apps do — "may be risky", "declined for security reasons", or a ₹2,000 cap. So a pay page
 * offers the routes that are allowed: a QR scanned from another screen, a QR saved and scanned from
 * the gallery (up to ₹2,000 to a person), or the UPI ID to paste. On iPhone it can still open an
 * app's home screen — the bare URL scheme, with no payment in it — to save hunting for the icon;
 * Android can't open an app's home screen from a web page.
 */

export type PayAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim'

/** Where the page runs, as far as opening payment apps goes. */
export type PayPlatform = 'android' | 'ios' | 'other'

export interface PayApp {
  id: PayAppId
  /** The app's name as it appears on its icon (brand names are not translated). */
  name: string
  /** Its iOS URL scheme (the payment gateways' scheme lists). */
  iosScheme: string
}

/** The apps offered, in the order people usually reach for them. */
export const PAY_APPS: readonly PayApp[] = [
  { id: 'gpay', name: 'Google Pay', iosScheme: 'gpay' },
  { id: 'phonepe', name: 'PhonePe', iosScheme: 'phonepe' },
  { id: 'paytm', name: 'Paytm', iosScheme: 'paytmmp' },
  { id: 'bhim', name: 'BHIM', iosScheme: 'bhim' },
]

/** The most a person can be paid from a QR picture (a saved or shared QR image): OC 76C, row 3. */
export const GALLERY_QR_MAX_PAISE = 200_000

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

/** The link that opens `app` on its home screen — no payee, no amount — on iPhone; null elsewhere. */
export function openAppHref(app: PayApp, platform: PayPlatform): string | null {
  return platform === 'ios' ? `${app.iosScheme}://` : null
}
