/**
 * Settle accounts: the rules both the server (the `settle-api` Edge Function, which runs a copy of
 * this file — see supabase/functions/settle-api/cloud.ts) and the phone use, so a split the phone
 * previews is the split the server records. No imports: it must run unchanged under Deno.
 *
 * Money is integer paise. Shares always add up to the amount exactly.
 */

/** Largest single expense or settlement: ₹1,000 crore, far above any real bill. */
export const MAX_PAISE = 100_000_000_000

/** `+91XXXXXXXXXX` for an Indian mobile number typed any usual way; null for anything else. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '')
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits)
  return match ? `+91${match[1]}` : null
}

/** A UPI ID as the database keeps it: no spaces, lower case. */
export function normalizeUpi(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

const UPI = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/

/** Shaped like `name@bank`. Says nothing about whether the account exists or whose it is. */
export function isUpiShaped(value: string): boolean {
  return UPI.test(normalizeUpi(value))
}

export type SplitMethod = 'equal' | 'exact' | 'percent'

export interface SplitInput {
  userId: string
  /** equal: ignored. exact: paise. percent: basis points (2500 = 25%). */
  value: number
}

export interface Share {
  userId: string
  sharePaise: number
}

export type SplitResult = { ok: true; shares: Share[] } | { ok: false; error: SplitError }

export type SplitError = 'no_people' | 'duplicate_person' | 'bad_amount' | 'bad_value' | 'exact_sum' | 'percent_sum'

/**
 * Divides `amountPaise` among people. Equal and percent splits hand leftover paise out one at a
 * time (to the largest remainders, then in user-id order), so the result is the same on every
 * device and adds up to the amount exactly.
 */
export function computeShares(amountPaise: number, method: SplitMethod, people: readonly SplitInput[]): SplitResult {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > MAX_PAISE) return { ok: false, error: 'bad_amount' }
  if (people.length === 0) return { ok: false, error: 'no_people' }
  if (new Set(people.map((p) => p.userId)).size !== people.length) return { ok: false, error: 'duplicate_person' }
  const sorted = [...people].sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))

  if (method === 'equal') {
    const base = Math.floor(amountPaise / sorted.length)
    const extra = amountPaise - base * sorted.length
    return { ok: true, shares: sorted.map((p, i) => ({ userId: p.userId, sharePaise: base + (i < extra ? 1 : 0) })) }
  }

  if (sorted.some((p) => !Number.isSafeInteger(p.value) || p.value < 0)) return { ok: false, error: 'bad_value' }

  if (method === 'exact') {
    const sum = sorted.reduce((s, p) => s + p.value, 0)
    if (sum !== amountPaise) return { ok: false, error: 'exact_sum' }
    return { ok: true, shares: sorted.map((p) => ({ userId: p.userId, sharePaise: p.value })) }
  }

  const totalBp = sorted.reduce((s, p) => s + p.value, 0)
  if (totalBp !== 10_000) return { ok: false, error: 'percent_sum' }
  const raw = sorted.map((p, i) => {
    const exact = amountPaise * p.value
    return { i, floor: Math.floor(exact / 10_000), rem: exact % 10_000 }
  })
  let left = amountPaise - raw.reduce((s, r) => s + r.floor, 0)
  const order = [...raw].sort((a, b) => b.rem - a.rem || a.i - b.i)
  const plus = new Set<number>()
  for (const r of order) {
    if (left <= 0) break
    if (r.rem === 0) continue
    plus.add(r.i)
    left -= 1
  }
  return { ok: true, shares: raw.map((r) => ({ userId: sorted[r.i]!.userId, sharePaise: r.floor + (plus.has(r.i) ? 1 : 0) })) }
}

export interface Transfer {
  from: string
  to: string
  amountPaise: number
}

/**
 * The fewest-hops way to settle a group: biggest debtor pays biggest creditor, repeatedly.
 * `nets` must add up to zero (positive = is owed). People already square are left out.
 */
export function simplifyDebts(nets: ReadonlyArray<{ userId: string; net: number }>): Transfer[] {
  const creditors = nets.filter((n) => n.net > 0).map((n) => ({ ...n }))
  const debtors = nets.filter((n) => n.net < 0).map((n) => ({ userId: n.userId, net: -n.net }))
  const byAmount = (a: { userId: string; net: number }, b: { userId: string; net: number }) =>
    b.net - a.net || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  const out: Transfer[] = []
  for (;;) {
    creditors.sort(byAmount)
    debtors.sort(byAmount)
    const c = creditors[0]
    const d = debtors[0]
    if (!c || !d || c.net <= 0 || d.net <= 0) break
    const amount = Math.min(c.net, d.net)
    out.push({ from: d.userId, to: c.userId, amountPaise: amount })
    c.net -= amount
    d.net -= amount
    if (c.net === 0) creditors.shift()
    if (d.net === 0) debtors.shift()
  }
  return out
}

/** Letters, digits, spaces and plain punctuation only (UPI apps reject emoji), collapsed and capped. */
export function upiText(value: string, max: number): string {
  const cleaned = value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .,'&()\-/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, max).join('').trim()
}

/** `1234567` paise → `"12345.67"`. */
export function rupeesText(paise: number): string {
  const whole = Math.floor(paise / 100)
  const part = paise % 100
  return `${whole}.${part < 10 ? '0' : ''}${part}`
}

export interface UpiUriInput {
  upiId: string
  payeeName: string
  amountPaise: number
  note: string
  /** A reference the payer's app may echo back; kept short and plain. */
  reference?: string
}

/** `upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…` with every value percent-encoded. */
export function buildUpiUri({ upiId, payeeName, amountPaise, note, reference }: UpiUriInput): string {
  const params: Array<[string, string]> = [['pa', normalizeUpi(upiId)]]
  const name = upiText(payeeName, 50)
  if (name) params.push(['pn', name])
  params.push(['am', rupeesText(amountPaise)])
  params.push(['cu', 'INR'])
  params.push(['tn', upiText(note, 50) || 'Settle'])
  const ref = (reference ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 35)
  if (ref) params.push(['tr', ref])
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

/** Settlement states, in the order a happy path visits them. */
export const SETTLEMENT_STATUSES = ['pending', 'initiated', 'awaiting_confirmation', 'confirmed', 'failed', 'disputed', 'cancelled'] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

/** States that still count against what the sender owes (anything not finished one way or the other). */
export function isOpenSettlement(status: SettlementStatus): boolean {
  return status !== 'confirmed' && status !== 'cancelled'
}
