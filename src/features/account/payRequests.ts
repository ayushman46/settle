/**
 * Pay requests: when a friend splits something with you in their Settle and your phone number is
 * on your Settle account, the server raises a request for your share. Here: reading and answering
 * them, and turning on phone notifications (Web Push) so they arrive with the app closed.
 */
import { cloud } from './api'

export interface PayRequest {
  id: string
  /** Who asked (their Settle name). */
  fromName: string
  title: string
  /** Paise. */
  amount: number
  currency: string
  createdAt: string
  /** Where to pay them, when they've added a UPI ID. */
  upiId: string | null
  /** `upi://pay?…` for the amount, ready to open (INR only). */
  upiUri: string | null
}

export interface PayRequests {
  requests: PayRequest[]
}

export function answerPayRequest(id: string, action: 'paid' | 'dismissed') {
  return cloud<{ ok: true }>('POST', `/requests/${id}/${action}`)
}

/* ------------------------------------------------------------------ the sender's side */

/** Fired by the sync when people in your new splits were asked to pay (detail: how many). */
export const NOTIFIED_EVENT = 'settle:pay-requests-sent'

export function announceNotified(count: number): void {
  if (count > 0 && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTIFIED_EVENT, { detail: count }))
}

/* ------------------------------------------------------------------ phone notifications */

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notifyState(): NotifyState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission
}

/** The server's public key as the bytes `pushManager.subscribe` wants. */
export function keyBytes(base64url: string): Uint8Array {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/**
 * Asks to send notifications (from a tap: browsers want one), then registers this browser with the
 * server for pushes. 'granted' even when the server can't push yet: the requests still show here.
 */
export async function enableNotifications(): Promise<NotifyState> {
  if (notifyState() === 'unsupported') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await subscribeThisBrowser()
  return 'granted'
}

/** Registers (or refreshes) this browser's push subscription; quiet when anything is missing. */
export async function subscribeThisBrowser(): Promise<boolean> {
  try {
    if (notifyState() !== 'granted') return false
    const registration = await navigator.serviceWorker.ready
    if (!registration.pushManager) return false
    const keyRes = await cloud<{ key: string | null }>('GET', '/push/key')
    if (!keyRes.ok || !keyRes.data.key) return false
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(keyRes.data.key) as BufferSource }))
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false
    const res = await cloud('POST', '/push/subscribe', { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
    return res.ok
  } catch {
    return false
  }
}
