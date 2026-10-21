/**
 * UPI payment requests (India). A `upi://pay` link opens GPay/PhonePe/Paytm/BHIM with the
 * payee and amount filled in; the same link as a QR code can be scanned by any UPI app.
 */
import type { Minor } from '../types'
import { formatMoney, toInputString } from './money'
import { nameKey } from './people'

/**
 * localStorage key for UPI IDs remembered between bills on this device, one per payee name:
 * `[[nameKey, vpa], …]`, most recently saved first.
 */
export const UPI_IDS_KEY = 'billsplit.upi.v2'

/**
 * The v1 key held a single ID with no owner, which got prefilled for whoever paid — so Ben's QR
 * codes could send money to Aisha. We can't tell whose it was, so it's never read and is removed.
 */
export const LEGACY_UPI_ID_KEY = 'billsplit.upi.v1'

/** How many payees' IDs we remember. */
export const MAX_SAVED_UPI_IDS = 20

/** A virtual payment address: `handle@bank`. */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/

/** Longest payee name / note we put in a link (UPI apps truncate or reject long values). */
const MAX_NAME = 50
const MAX_NOTE = 50

/** Trims and lower-cases a typed UPI ID and drops stray spaces ("Aisha@OkAxis " → "aisha@okaxis"). */
export function normalizeUpiId(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

/** True for something shaped like a UPI ID (`name@bank`), ignoring surrounding spaces and case. */
export function isValidUpiId(value: string): boolean {
  return UPI_ID_PATTERN.test(normalizeUpiId(value))
}

/**
 * Keeps names and notes to characters every UPI app accepts: letters, digits, spaces and simple
 * punctuation (no emoji or symbols, which some apps reject), collapsed and length-capped.
 */
function cleanText(value: string, max: number): string {
  const cleaned = value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .,'&()\-/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, max).join('').trim()
}

export interface UpiLinkInput {
  /** The payee's UPI ID (who receives the money). */
  vpa: string
  /** The payee's name as shown in the payer's UPI app. */
  payeeName: string
  /** Amount in paise. Omitted from the link when ≤ 0 (the payer types it). */
  amountMinor: Minor
  /** Transaction note, e.g. the restaurant. Defaults to "Bill split". */
  note?: string | null
}

/** `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…` with every parameter URL-encoded. */
export function buildUpiLink({ vpa, payeeName, amountMinor, note }: UpiLinkInput): string {
  const params: Array<[string, string]> = [['pa', normalizeUpiId(vpa)]]
  const name = cleanText(payeeName, MAX_NAME)
  if (name) params.push(['pn', name])
  if (Number.isFinite(amountMinor) && amountMinor > 0) {
    params.push(['am', toInputString(Math.round(amountMinor), 'INR')])
  }
  params.push(['cu', 'INR'])
  params.push(['tn', cleanText(note ?? '', MAX_NOTE) || 'Bill split'])
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

export interface UpiRequestTextInput {
  /** Who should pay. */
  debtorName: string
  /** Who receives the money. */
  payerName: string
  /** The payer's UPI ID, shown as plain text so it can be copied from any chat app. */
  vpa: string
  amountMinor: Minor
  merchant: string | null
  /** From `buildUpiLink`. */
  link: string
}

/**
 * A ready-to-send request, one thing per line:
 *
 *     Hi Ben, your share for Saffron Table is ₹530.10.
 *     Pay Aisha on UPI: aisha@okaxis
 *     Or tap to pay: upi://pay?…
 *
 * The UPI ID is spelled out because chat apps (WhatsApp, SMS) don't make `upi://` links tappable;
 * the link comes last so it still works where they do.
 */
export function buildUpiRequestText({
  debtorName,
  payerName,
  vpa,
  amountMinor,
  merchant,
  link,
}: UpiRequestTextInput): string {
  const what = merchant?.trim() ? `for ${merchant.trim()}` : 'of the bill'
  const amount = formatMoney(amountMinor, 'INR')
  return [
    `Hi ${debtorName}, your share ${what} is ${amount}.`,
    `Pay ${payerName} on UPI: ${normalizeUpiId(vpa)}`,
    `Or tap to pay: ${link}`,
  ].join('\n')
}

type SavedIds = Array<[key: string, vpa: string]>

/** The remembered IDs, dropping anything malformed. Never throws. */
function readSaved(): SavedIds {
  try {
    const raw = window.localStorage.getItem(UPI_IDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: SavedIds = []
    const seen = new Set<string>()
    for (const entry of parsed) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') continue
      const [key, value] = entry as [string, string]
      const vpa = normalizeUpiId(value)
      if (!key || seen.has(key) || !UPI_ID_PATTERN.test(vpa)) continue
      seen.add(key)
      out.push([key, vpa])
      if (out.length === MAX_SAVED_UPI_IDS) break
    }
    return out
  } catch {
    return []
  }
}

/** The UPI ID saved on this device for `payeeName` (case- and accent-insensitive), or null. Never throws. */
export function getSavedUpiId(payeeName: string): string | null {
  const key = nameKey(payeeName)
  if (!key) return null
  return readSaved().find(([k]) => k === key)?.[1] ?? null
}

/**
 * Remembers a valid UPI ID for `payeeName` for next time. Null or blank forgets that payee's ID;
 * anything else that isn't a valid ID (e.g. half-typed) is ignored. Never throws.
 */
export function saveUpiId(payeeName: string, value: string | null): void {
  const key = nameKey(payeeName)
  if (!key) return
  const vpa = value === null ? '' : normalizeUpiId(value)
  if (vpa && !UPI_ID_PATTERN.test(vpa)) return
  try {
    const others = readSaved().filter(([k]) => k !== key)
    const entry: SavedIds[number] = [key, vpa]
    const next: SavedIds = vpa ? [entry, ...others].slice(0, MAX_SAVED_UPI_IDS) : others
    if (next.length > 0) window.localStorage.setItem(UPI_IDS_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(UPI_IDS_KEY)
    window.localStorage.removeItem(LEGACY_UPI_ID_KEY)
  } catch {
    // Storage blocked (private mode) — the field just won't be prefilled next time.
  }
}
