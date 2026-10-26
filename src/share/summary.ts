/** The plain-text versions of a split: the full summary ("Copy summary") and the short group-chat message that carries a pay link. */
import { BRAND } from '../domain/types'
import { t } from '../i18n'
import { formatBillDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import { graphemes } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { payLinkProgress, type PayLinkPayload } from './payLink'
import { ellipsize, firstName } from './text'

/** Longest name column we pad to; longer names just push their amount along. */
const MAX_PAD = 14
/** Space kept between a name and its amount, however long the name. */
const MIN_GAP = 2

function padName(name: string, width: number): string {
  return name + ' '.repeat(Math.max(MIN_GAP, width - graphemes(name).length))
}

function moneyOf(payload: PayLinkPayload): (minor: number) => string {
  return (minor) => formatMoney(minor, payload.c, { trimZeros: true })
}

/** The payee's UPI ID when friends can actually use it (rupees only, a valid ID), else null. */
function usableUpi(payload: PayLinkPayload): string | null {
  return payload.c === 'INR' && payload.to.u && isValidUpiId(payload.to.u) ? normalizeUpiId(payload.to.u) : null
}

/**
 * ```
 * 🧾 Dinner at Toit · 18 Oct 2026
 * Total ₹2,766 · split 4 ways
 *
 * Ayush        ₹691.50 · paid the bill
 * Riya         ₹691.50 ✓
 * Sam          ₹691.50
 *
 * Pay Ayush on UPI: ayush@okaxis
 * Pay in a tap: https://…/pay#…
 *
 * — split with Settle
 * ```
 */
export function summaryText(payload: PayLinkPayload, link?: string | null): string {
  const money = moneyOf(payload)
  const lines: string[] = []
  const date = formatBillDate(payload.d)
  lines.push(`🧾 ${date ? `${payload.t} · ${date}` : payload.t}`)
  const ways = payload.p.length
  lines.push(ways > 0 ? t('share.summary.totalSplit', { amount: money(payload.tot), count: ways }) : t('share.summary.total', { amount: money(payload.tot) }))
  if (payload.note) lines.push(payload.note)

  if (ways > 0) {
    lines.push('')
    const width = Math.min(MAX_PAD, Math.max(...payload.p.map((p) => graphemes(p.n).length))) + MIN_GAP
    payload.p.forEach((person, i) => {
      const status = i === payload.pi ? ` · ${t('share.summary.paidTheBill')}` : person.paid ? ' ✓' : ''
      lines.push(`${padName(person.n, width)}${money(person.a)}${status}`)
    })
  }

  const owing = payload.p.some((p, i) => i !== payload.pi && !p.paid && p.a > 0)
  const upi = usableUpi(payload)
  const pay: string[] = []
  if (owing && upi) pay.push(t('share.summary.payUpi', { name: payload.to.n, upi }))
  if (owing && link?.trim()) pay.push(t('share.summary.payTap', { link: link.trim() }))
  if (pay.length > 0) lines.push('', ...pay)

  lines.push('', t('share.summary.footer', { brand: BRAND.name }))
  return lines.join('\n')
}

/**
 * One person's own ask, with their personal link (which opens on their share):
 *
 * ```
 * Hi Riya! Your share of Dinner at Toit is ₹460 🧾
 * Pay me in one tap — any UPI app, amount already filled in 👇
 * https://…/pay#…
 * ```
 */
export function personalPayMessage(payload: PayLinkPayload, index: number, link: string | null, opts: PayLinkMessageOptions): string {
  const person = payload.p[index]
  if (!person) return payLinkMessage(payload, link, opts)
  const title = ellipsize(payload.t, 48, 120)
  const lines = [t('share.message.yourShare', { name: firstName(person.n), title, amount: moneyOf(payload)(person.a) })]
  const url = link?.trim() || null
  const upi = usableUpi(payload)
  const payee = firstName(payload.to.n)
  if (url) {
    lines.push(upi ? (opts.fromPayee ? t('share.message.oneTapMe') : t('share.message.oneTap', { name: payee })) : t('share.message.seeYours'))
    lines.push(url)
  } else if (upi) {
    lines.push(opts.fromPayee ? t('share.nudge.upi.mine', { upi }) : t('share.nudge.upi', { name: payee, upi }))
  }
  return lines.join('\n')
}

export interface PayLinkMessageOptions {
  /** The sender is the payee (they paid and are collecting): "pay me" rather than "pay Riya". */
  fromPayee: boolean
}

/**
 * The short message that goes with a pay link into the group chat — the link does the rest:
 *
 * ```
 * 🧾 Dinner at Toit · ₹2,766 split 4 ways
 * Tap your name to pay me with any UPI app 👇
 * https://…/pay#…
 * ```
 *
 * Without a link it carries the UPI ID instead; once everyone has paid it says so.
 */
export function payLinkMessage(payload: PayLinkPayload, link: string | null, opts: PayLinkMessageOptions): string {
  const money = moneyOf(payload)
  const title = ellipsize(payload.t, 48, 120)
  const ways = payload.p.length
  const { outstanding, peopleCount } = payLinkProgress(payload)
  const owing = outstanding > 0
  const headline =
    peopleCount > 0 && !owing
      ? t('share.message.settled', { title })
      : ways > 1
        ? t('share.message.split', { title, amount: money(payload.tot), count: ways })
        : t('share.message.total', { title, amount: money(payload.tot) })

  const url = link?.trim() || null
  const upi = usableUpi(payload)
  const payee = firstName(payload.to.n)
  const lines = [headline]
  if (url) {
    if (!owing) lines.push(t('share.message.see'))
    else if (upi) lines.push(opts.fromPayee ? t('share.message.payMe') : t('share.message.pay', { name: payee }))
    else lines.push(t('share.message.seeShare'))
    lines.push(url)
  } else if (owing && upi) {
    lines.push(opts.fromPayee ? t('share.nudge.upi.mine', { upi }) : t('share.nudge.upi', { name: payee, upi }))
  }
  return lines.join('\n')
}
