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

/* ------------------------------------------------------------------ straight into the app */

/** Each app's Android package. */
export const ANDROID_PACKAGES: Readonly<Record<PayAppId, string>> = {
  gpay: 'com.google.android.apps.nbu.paisa.user',
  phonepe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
  bhim: 'in.org.npci.upiapp',
}

/** Each app's own iPhone link for a UPI payment (the payment gateways' scheme lists). */
const IOS_PAY: Readonly<Record<PayAppId, string>> = {
  gpay: 'gpay://upi/pay',
  phonepe: 'phonepe://pay',
  paytm: 'paytmmp://pay',
  bhim: 'upi://pay',
}

/** The link that opens `app` (no payment in it): its scheme on iPhone, its launcher on Android; null elsewhere. */
export function launchHref(app: PayApp, platform: PayPlatform): string | null {
  if (platform === 'ios') return `${app.iosScheme}://`
  if (platform === 'android') return `intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${ANDROID_PACKAGES[app.id]};end`
  return null
}

/**
 * A link that opens `app` on the payment itself — payee, amount and note from `upiUri`
 * (`upi://pay?…`). UPI apps are told to refuse a payment to a person that starts this way (NPCI
 * OC 76A), and many do; some take small amounts. Offered as a try, never as the only way. Null
 * where a page can't open an app.
 */
export function directPayHref(app: PayApp, platform: PayPlatform, upiUri: string): string | null {
  const query = upiUri.split('?')[1] ?? ''
  if (!query) return null
  if (platform === 'ios') return `${IOS_PAY[app.id]}?${query}`
  if (platform === 'android') return `intent://pay?${query}#Intent;scheme=upi;package=${ANDROID_PACKAGES[app.id]};end`
  return null
}

/* ------------------------------------------------------------------ the app you pay with */

const PAY_APP_KEY = 'settle.v8.pay-app'
const listeners = new Set<() => void>()

/** The UPI app this phone pays with (picked once, remembered), or null. Never throws. */
export function getPayApp(): PayAppId | null {
  try {
    const raw = window.localStorage.getItem(PAY_APP_KEY)
    return PAY_APPS.some((app) => app.id === raw) ? (raw as PayAppId) : null
  } catch {
    return null
  }
}

export function setPayApp(id: PayAppId | null): void {
  try {
    if (id === null) window.localStorage.removeItem(PAY_APP_KEY)
    else window.localStorage.setItem(PAY_APP_KEY, id)
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  for (const listener of [...listeners]) listener()
}

export function subscribePayApp(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
