/**
 * The shareable summary of a split, and getting it out of the app: the native share sheet on
 * phones, the clipboard elsewhere.
 */
import type { Session } from '../types'
import { formatBillDate } from './format'
import { currencyDigits, formatMoney } from './money'
import { graphemes } from './people'
import { settleUp } from './settle'
import type { SplitResult } from './split'
import { isValidUpiId, normalizeUpiId } from './upi'

export interface ShareTextOptions {
  /**
   * The payer's UPI ID to add to the "Pay …" section (INR bills only), or null to leave it out.
   * Always the ID entered for *this* payer — there is deliberately no device-wide fallback, so one
   * person's ID never lands under someone else's name.
   */
  upiId: string | null
}

/** Longest name column we pad to; longer names just push their amount along. */
const MAX_PAD = 14

function padName(name: string, width: number): string {
  const length = graphemes(name).length
  return length >= width ? name : name + ' '.repeat(width - length)
}

/** "(incl. tax, service & discounts)" from what the bill shows, or a generic note. */
function extrasNote(session: Session, result: SplitResult): string | null {
  if (result.adjustment === 0) return null
  // Up to one whole rupee/dollar/…: the bill was rounded (same rule as the Result screen).
  if (Math.abs(result.adjustment) <= 10 ** currencyDigits(session.currency)) return '(incl. round-off)'
  const { meta } = session
  const parts: string[] = []
  if (meta.tax) parts.push('tax')
  if (meta.serviceCharge) parts.push('service')
  if (meta.tip) parts.push('tip')
  if (meta.discount) parts.push('discounts')
  if (parts.length === 0) return result.adjustment > 0 ? '(incl. tax & charges)' : '(after discounts)'
  const last = parts.pop() ?? ''
  return `(incl. ${parts.length > 0 ? `${parts.join(', ')} & ${last}` : last})`
}

/**
 * Plain-text summary for WhatsApp & co:
 *
 * ```
 * 🧾 Saffron Table · 18 Oct 2026
 * Total ₹2,299.00 · split 4 ways
 *
 * Aisha   ₹712.40
 * Ben     ₹530.10
 * (incl. tax, service & discounts)
 *
 * Pay Aisha
 * Ben → ₹530.10
 * UPI: aisha@okaxis
 *
 * — split with BillSplit
 * ```
 */
export function buildShareText(session: Session, result: SplitResult, opts: ShareTextOptions): string {
  const code = session.currency
  const money = (minor: number) => formatMoney(minor, code)
  const lines: string[] = []

  const title = session.meta.merchant?.trim() || 'Our bill'
  const date = formatBillDate(session.meta.date)
  lines.push(`🧾 ${date ? `${title} · ${date}` : title}`)
  const ways = result.people.length
  lines.push(`Total ${money(result.paid)} · split ${ways} ${ways === 1 ? 'way' : 'ways'}`)
  lines.push('')

  const width = Math.min(MAX_PAD, Math.max(0, ...result.people.map((p) => graphemes(p.person.name).length))) + 2
  for (const split of result.people) lines.push(`${padName(split.person.name, width)}${money(split.total)}`)
  const note = extrasNote(session, result)
  if (note) lines.push(note)
  if (result.unassignedItemIds.length > 0) {
    const n = result.unassignedItemIds.length
    lines.push(`(${n} ${n === 1 ? 'item' : 'items'} shared by everyone)`)
  }

  const settlement = settleUp(result, session.payerId)
  if (settlement) {
    const debts = settlement.debts.filter((d) => d.owes > 0)
    if (debts.length > 0) {
      lines.push('')
      lines.push(`Pay ${settlement.payer.name}`)
      for (const debt of debts) lines.push(`${debt.person.name} → ${money(debt.owes)}`)
      const upi = opts.upiId
      if (code === 'INR' && upi && isValidUpiId(upi)) lines.push(`UPI: ${normalizeUpiId(upi)}`)
    }
  }

  lines.push('')
  lines.push('— split with BillSplit')
  return lines.join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareOptions {
  /**
   * `auto` (default): the native share sheet on touch devices, the clipboard on desktop.
   * `share`: prefer the share sheet wherever it exists. `copy`: clipboard only.
   */
  mode?: 'auto' | 'share' | 'copy'
  /** Title for the share sheet. */
  title?: string
}

function isTouchFirst(): boolean {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch {
    return false
  }
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/** Copies text with the async Clipboard API, falling back to a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or not a secure context — try the old way.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    area.select()
    area.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = typeof document.execCommand === 'function' && document.execCommand('copy')
    } finally {
      area.remove()
      active?.focus({ preventScroll: true })
    }
    return ok
  } catch {
    return false
  }
}

/**
 * Shares the text via the system share sheet or copies it.
 * Resolves to what happened: `shared`, `copied`, `cancelled` (share sheet dismissed) or `failed`.
 */
export async function shareResult(text: string, opts: ShareOptions = {}): Promise<ShareOutcome> {
  const mode = opts.mode ?? 'auto'
  const canShare =
    mode !== 'copy' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (mode === 'share' || isTouchFirst())
  if (canShare) {
    const data: ShareData = opts.title ? { title: opts.title, text } : { text }
    let shareable: boolean
    try {
      shareable = typeof navigator.canShare !== 'function' || navigator.canShare(data)
    } catch {
      shareable = false
    }
    if (shareable) {
      try {
        await navigator.share(data)
        return 'shared'
      } catch (error) {
        if (isAbort(error)) return 'cancelled'
        // NotAllowedError etc. — fall back to copying.
      }
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
