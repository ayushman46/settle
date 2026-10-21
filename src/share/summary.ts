/** The plain-text summary of a split, for "Copy summary" and chats that don't unfurl links. */
import { BRAND } from '../domain/types'
import { formatBillDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import { graphemes } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import type { PayLinkPayload } from './payLink'

/** Longest name column we pad to; longer names just push their amount along. */
const MAX_PAD = 14

function padName(name: string, width: number): string {
  const length = graphemes(name).length
  return length >= width ? name : name + ' '.repeat(width - length)
}

/**
 * ```
 * 🧾 Dinner at Toit · 18 Oct 2026
 * Total ₹2,766 · split 4 ways
 *
 * Ayush   ₹691.50 · paid the bill
 * Riya    ₹691.50 ✓
 * Sam     ₹691.50
 *
 * Pay Ayush on UPI: ayush@okaxis
 * Pay in a tap: https://…/pay#…
 *
 * — split with Settle
 * ```
 */
export function summaryText(payload: PayLinkPayload, link?: string | null): string {
  const money = (minor: number) => formatMoney(minor, payload.c, { trimZeros: true })
  const lines: string[] = []
  const date = formatBillDate(payload.d)
  lines.push(`🧾 ${date ? `${payload.t} · ${date}` : payload.t}`)
  const ways = payload.p.length
  lines.push(ways > 0 ? `Total ${money(payload.tot)} · split ${ways} ${ways === 1 ? 'way' : 'ways'}` : `Total ${money(payload.tot)}`)
  if (payload.note) lines.push(payload.note)

  if (ways > 0) {
    lines.push('')
    const width = Math.min(MAX_PAD, Math.max(...payload.p.map((p) => graphemes(p.n).length))) + 2
    payload.p.forEach((person, i) => {
      const status = i === payload.pi ? ' · paid the bill' : person.paid ? ' ✓' : ''
      lines.push(`${padName(person.n, width)}${money(person.a)}${status}`)
    })
  }

  const owing = payload.p.some((p, i) => i !== payload.pi && !p.paid && p.a > 0)
  const upi = payload.c === 'INR' && payload.to.u && isValidUpiId(payload.to.u) ? normalizeUpiId(payload.to.u) : null
  const pay: string[] = []
  if (owing && upi) pay.push(`Pay ${payload.to.n} on UPI: ${upi}`)
  if (owing && link?.trim()) pay.push(`Pay in a tap: ${link.trim()}`)
  if (pay.length > 0) lines.push('', ...pay)

  lines.push('', `— split with ${BRAND.name}`)
  return lines.join('\n')
}
