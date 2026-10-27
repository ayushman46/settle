/**
 * "Money received" alerts from the Android app (android/…/PaymentAlertsListener.java): a UPI app's
 * notification ("Riya Sharma paid you ₹420", "Received ₹420 from RIYA SHARMA") or a bank SMS shown
 * by the messages app ("Rs.420.00 credited to a/c XX4821 … VPA riya.s@okhdfcbank"). Each becomes a
 * payment for the matcher, or nothing: money going out, requests, refunds, cashback and anything
 * without an amount are not someone paying you back.
 */
import type { AlertCredit } from '../../data/stores'
import { parseSms } from '../sharein/sms/parseSms'
import { nameKey } from '../whospaid/match'

/** One alert as the phone kept it. */
export interface RawAlert {
  id: string
  /** The Android package that posted it. */
  app: string
  title: string
  text: string
  /** Epoch ms. */
  postedAt: number
}

/** The UPI apps whose own alerts are read (mirrors PaymentAlertsListener.UPI_APPS). */
export const UPI_APPS: Readonly<Record<string, string>> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'in.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.mobikwik_new': 'MobiKwik',
  'com.dreamplug.androidapp': 'CRED',
}

const AMOUNT = /(?:₹|\brs\.?|\binr)\s?([\d,]+(?:\.\d{1,2})?)/i
const MONEY_IN = /\b(?:received|credited|deposited|paid you|sent you|added to)\b/i
/** Not a person paying you back, whatever else it says. */
const NOT_PAYBACK = /\b(?:you paid|you sent|you have paid|paid to|sent to|debited|spent|payment to|cashback|cash back|reward|rewards|refund|refunded|reversal|reversed|request|requested|requesting|requests|recharge|scratch card|offer|won|coins|points|otp)\b/i
/** "Riya Sharma paid you ₹420", "RIYA SHARMA has sent you Rs.420". */
const PAID_YOU = /^\s*(.+?)\s+(?:has\s+)?(?:paid|sent)\s+you\b/im
/** "… from Riya Sharma on Google Pay", "… from riya@okaxis." */
const FROM = /\bfrom\s+(.+?)(?=\s+(?:on|via|in|into|to|for|using|through|at|ref|upi|towards|with)\b|[.,!;:\n(]|$)/i
const VPA = /\b[a-z0-9][a-z0-9._-]*@[a-z][a-z0-9]+\b/i
const UTR = /\b(?:upi\s*)?(?:ref(?:erence)?|utr|txn(?:\s*id)?)\.?\s*(?:no\.?|id|number)?\s*[:#-]?\s*(\d{12})\b/i
/** Words that are never a payer's name. */
const NOT_A_NAME = /^(?:you|a|an|the|upi|google pay|gpay|phonepe|paytm|bhim|amazon pay|mobikwik|cred|someone|sender)$/i
/** Words a payer's name never has. */
const NOT_IN_A_NAME = /\b(?:your|bank|account|a\/c|wallet|card|balance)\b/i

function paise(text: string): number | null {
  const value = Number(text.replace(/,/g, ''))
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null
}

/** YYYY-MM-DD on this phone's clock. */
function dayOf(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A printed name, tidied; null when it's an account number, a UPI ID or a generic word. */
function cleanName(raw: string | undefined): string | null {
  if (!raw) return null
  const name = raw
    .replace(/\s+/g, ' ')
    .replace(/^(?:mr|mrs|ms|dr)\.?\s+/i, '')
    .trim()
  if (name.length < 2 || name.length > 60 || /\d|@/.test(name) || NOT_A_NAME.test(name) || NOT_IN_A_NAME.test(name)) return null
  return nameKey(name) === '' ? null : name
}

/** A UPI app's own alert: amount and, where it says, who from. */
function fromUpiApp(alert: RawAlert): AlertCredit | null {
  const text = `${alert.title}\n${alert.text}`
  if (!MONEY_IN.test(text) || NOT_PAYBACK.test(text)) return null
  const amountMatch = AMOUNT.exec(text)
  const amount = amountMatch?.[1] ? paise(amountMatch[1]) : null
  if (amount === null) return null
  const vpa = VPA.exec(text)?.[0]?.toLowerCase() ?? null
  // The UPI ID out of the way, so "from riya.s@okaxis" doesn't read as "riya".
  const words = vpa ? text.replace(VPA, ' ') : text
  const name = cleanName(PAID_YOU.exec(words)?.[1]) ?? cleanName(FROM.exec(words)?.[1])
  return { id: alert.id, amount, date: dayOf(alert.postedAt), at: alert.postedAt, name, vpa, utr: UTR.exec(text)?.[1] ?? null }
}

/** A bank SMS shown by the messages app: the existing SMS reader, money in from a person only. */
function fromBankSms(alert: RawAlert): AlertCredit | null {
  const parsed = parseSms(alert.text, { today: dayOf(alert.postedAt) })
  if (parsed.kind !== 'txn' || parsed.dir !== 'credit' || parsed.refund) return null
  return {
    id: alert.id,
    amount: parsed.amount,
    date: parsed.date ?? dayOf(alert.postedAt),
    at: alert.postedAt,
    name: cleanName(parsed.name ?? undefined),
    vpa: parsed.vpa,
    utr: parsed.ref && /^\d{12}$/.test(parsed.ref) ? parsed.ref : null,
  }
}

/** The payment an alert reports, or null when it isn't someone paying you. */
export function alertToCredit(alert: RawAlert): AlertCredit | null {
  try {
    return alert.app in UPI_APPS ? fromUpiApp(alert) : fromBankSms(alert)
  } catch {
    return null
  }
}

/** The phone's alerts, checked field by field (anything odd is dropped). */
export function readRawAlerts(value: unknown): RawAlert[] {
  if (!Array.isArray(value)) return []
  const out: RawAlert[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const { id, app, title, text, postedAt } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof app !== 'string' || typeof postedAt !== 'number') continue
    out.push({ id, app, title: typeof title === 'string' ? title : '', text: typeof text === 'string' ? text : '', postedAt })
  }
  return out
}

/** Two alerts within this long, for the same amount, may be one payment told twice. */
export const SAME_PAYMENT_MS = 15 * 60 * 1000

/** The same payment, told by two alerts (the UPI app and the bank's SMS)? */
export function samePayment(a: AlertCredit, b: AlertCredit): boolean {
  if (a.amount !== b.amount || Math.abs(a.at - b.at) > SAME_PAYMENT_MS) return false
  if (a.utr && b.utr) return a.utr === b.utr
  if (a.vpa && b.vpa && !a.vpa.includes('*') && !b.vpa.includes('*')) return a.vpa === b.vpa
  if (!a.name || !b.name) return true
  const words = new Set(nameKey(a.name).split(' '))
  return nameKey(b.name)
    .split(' ')
    .some((w) => w.length > 1 && words.has(w))
}

/** One payment per payment: alerts telling the same one are merged, keeping every detail either had. */
export function mergeAlerts(credits: readonly AlertCredit[]): AlertCredit[] {
  const out: AlertCredit[] = []
  for (const credit of [...credits].sort((a, b) => a.at - b.at)) {
    const twin = out.findIndex((c) => samePayment(c, credit))
    if (twin < 0) {
      out.push(credit)
      continue
    }
    const kept = out[twin] as AlertCredit
    out[twin] = {
      ...kept,
      name: kept.name ?? credit.name,
      vpa: kept.vpa && !kept.vpa.includes('*') ? kept.vpa : (credit.vpa ?? kept.vpa),
      utr: kept.utr ?? credit.utr,
    }
  }
  return out
}
