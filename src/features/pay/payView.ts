/**
 * What the pay page shows for a decoded pay link — who's paying, how each person can pay, and
 * the bill lines behind a share — worked out from the share kit's pay-link helpers.
 */
import type { Minor } from '../../domain/types'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import {
  PAYEE_FALLBACK,
  payLinkDebtors,
  payLinkItemLines,
  payLinkUpiRequest,
  type PayLinkItemLine,
  type PayLinkPayload,
  type PayLinkUpiRequest,
} from '../../share/payLink'
import { formatUtr, type PaidHow } from '../../share/paidReply'
import { firstName } from '../../share/text'
import { AVATAR_COLORS } from '../../types'

export interface PayPerson {
  /** Index in `payload.p`. */
  index: number
  name: string
  /** What they pay: their share, less any part already paid. */
  amount: Minor
  /** Already paid of their share (a part payment), not yet in full. */
  paidSoFar: Minor
  /** The payee has marked them as paid. */
  paid: boolean
  /** Avatar palette index (links carry no colours, so it's by position — stable for everyone opening it). */
  color: number
}

/** Everyone who pays the payee back, in the link's order. */
export function payPeople(payload: PayLinkPayload): PayPerson[] {
  return payLinkDebtors(payload).map((d) => ({
    index: d.index,
    name: d.name,
    amount: d.amount,
    paidSoFar: d.paidSoFar,
    paid: d.paid,
    color: d.index % AVATAR_COLORS,
  }))
}

/** The payee's avatar colour: their own position when they took part, else the next one along. */
export function payeeColor(payload: PayLinkPayload): number {
  return (payload.pi ?? payload.p.length) % AVATAR_COLORS
}

export type PayOption =
  /** Pay by UPI: a deep link, a QR code and the payee's UPI ID. */
  | { kind: 'upi'; request: PayLinkUpiRequest }
  /** Their share is zero. */
  | { kind: 'nothing' }
  /** Rupees, but the link has no usable UPI ID. */
  | { kind: 'no_upi' }
  /** Another currency — UPI only moves rupees. */
  | { kind: 'not_inr' }

/** How the person at `index` can pay their share. */
export function payOption(payload: PayLinkPayload, index: number): PayOption {
  const person = payload.p[index]
  if (!person || person.a <= 0) return { kind: 'nothing' }
  const request = payLinkUpiRequest(payload, index)
  if (request) return { kind: 'upi', request }
  return payload.c === 'INR' ? { kind: 'no_upi' } : { kind: 'not_inr' }
}

export interface BreakdownLine extends PayLinkItemLine {
  /** "Shared 3 ways", "2 of 3 shares", or null when it was theirs alone. */
  detail: string | null
}

export interface ItemBreakdown {
  lines: BreakdownLine[]
  /** Share minus the item lines: tax, service, delivery fees and round-off (negative for discounts). */
  extras: Minor
  share: Minor
}

function lineDetail(line: PayLinkItemLine): string | null {
  if (line.sharedWith <= 1) return null
  if (line.totalShares === line.sharedWith) return t('pay.breakdown.sharedWays', { count: line.sharedWith })
  return t('pay.breakdown.shares', { shares: line.shares, total: line.totalShares })
}

/** The bill lines behind one person's share (itemized bills only), or null when there are none. */
export function itemBreakdown(payload: PayLinkPayload, index: number): ItemBreakdown | null {
  const person = payload.p[index]
  if (!person) return null
  const lines = payLinkItemLines(payload, index)
  if (lines.length === 0) return null
  const itemsTotal = lines.reduce((sum, line) => sum + line.amount, 0)
  return {
    lines: lines.map((line) => ({ ...line, detail: lineDetail(line) })),
    extras: person.a - itemsTotal,
    share: person.a,
  }
}

/** The receipt line for `extras`: what was added on top of the items, or taken off. */
export function extrasLabel(extras: Minor): string {
  return extras > 0 ? t('pay.breakdown.extras.added') : t('pay.breakdown.extras.taken')
}

export interface PaidMessageOptions {
  /** By UPI (the default) or in cash. */
  how?: PaidHow
  /** The UPI reference they added, cleaned (see `cleanUtr`). */
  utr?: string | null
  /** Their "I've paid" reply link: the payee taps it to tick them off. */
  link?: string | null
}

/**
 * "Hi Ayush! Just paid you ₹691.50 for Friday dinner ✓" — once they've paid — with the UPI
 * reference to check against the bank app and the reply link that ticks them off in Settle.
 */
export function paidMessage(payload: PayLinkPayload, person: Pick<PayPerson, 'amount'>, opts: PaidMessageOptions = {}): string {
  const amount = formatMoney(person.amount, payload.c, { trimZeros: true })
  const named = payload.to.n !== PAYEE_FALLBACK
  const vars = { name: firstName(payload.to.n), amount, title: payload.t }
  const lines =
    opts.how === 'cash'
      ? [named ? t('pay.tell.message.cash', vars) : t('pay.tell.message.cash.noName', vars)]
      : [named ? t('pay.tell.message', vars) : t('pay.tell.message.noName', vars)]
  if (opts.how !== 'cash' && opts.utr) lines.push(t('pay.tell.message.ref', { ref: formatUtr(opts.utr) }))
  const link = opts.link?.trim()
  if (link) lines.push(t('pay.tell.message.link'), link)
  return lines.join('\n')
}
