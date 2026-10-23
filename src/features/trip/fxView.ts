/**
 * Trip currency's words: rates ("1 THB = ₹2.4108", "₹1 = 188.12 IDR"), where a rate came from
 * ("ECB rate for 21 Oct"), the expense page's note ("Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)")
 * and currency names in a sentence ("Thai baht"). Pure, so screens and tests agree.
 */
import { PEGS } from '../../../shared/api'
import type { Expense } from '../../domain/types'
import { formatRate, isValidRate, parseRate, rateFromTotals } from '../../engine/fx'
import { t } from '../../i18n'
import { currencyName } from '../../lib/currencies'
import { currencySymbol, formatMoney } from '../../lib/money'
import type { Conversion } from '../split/splitForm'

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "2026-10-21" → "21 Oct". */
export function shortDate(iso: string): string {
  const at = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(at) ? DAY_MONTH.format(at) : iso
}

/** A currency's name as it reads mid-sentence: "Thai baht", "Sri Lankan rupee", "US dollar", "Euro". */
export function proseName(code: string): string {
  const name = currencyName(code)
  const words = name.split(' ')
  if (words.length < 2) return name
  const last = words[words.length - 1] ?? ''
  // Only a capitalised unit word is lowered ("Baht" → "baht"); codes like "CFA" stay.
  if (/^[A-Z][a-z]+$/.test(last)) words[words.length - 1] = last.toLowerCase()
  return words.join(' ')
}

/** True when a rate is shown the other way round ("₹1 = 188.12 IDR"). */
function isTiny(rate: string): boolean {
  const parsed = parseRate(rate)
  return parsed !== null && Number(parsed.num) / Number(parsed.den) < 0.01
}

/** "1 THB = ₹2.4108", or for tiny rates "₹1 = 188.12 IDR". */
export function rateText(rate: string, from: string, to: string): string {
  if (isTiny(rate)) return formatRate(rate, from, to)
  return t('trip.panel.rate', { from, rate: `${currencySymbol(to)}${formatRate(rate, from, to)}` })
}

/** The converted amount's accessible name: "About ₹3,013.44 at 1 Thai baht = ₹2.4108". */
export function convertedLabel(amount: string, rate: string, from: string, to: string): string {
  if (isTiny(rate)) return t('trip.panel.convertedLabelInverse', { amount, rate: formatRate(rate, from, to) })
  return t('trip.panel.convertedLabel', { amount, name: proseName(from), rate: `${currencySymbol(to)}${formatRate(rate, from, to)}` })
}

/** Where the panel's rate came from: "ECB rate for 21 Oct", "pegged to USD (3.6725)", "your rate"… */
export function sourceText(c: Extract<Conversion, { status: 'ok' }>): string {
  if (c.frozen) return t('trip.source.frozen', { date: shortDate(c.rateDate ?? '') })
  switch (c.source) {
    case 'manual_rate':
      return t('trip.source.manualRate')
    case 'manual_total':
      return t('trip.source.manualTotal')
    case 'pegged':
      if (c.stale) return t('trip.source.stale', { date: shortDate(c.rateDate ?? '') })
      return c.peg ? t('trip.source.pegged', { to: c.peg.to, peg: String(c.peg.peg) }) : t('trip.source.ecb', { date: shortDate(c.rateDate ?? '') })
    default:
      return c.stale ? t('trip.source.stale', { date: shortDate(c.rateDate ?? '') }) : t('trip.source.ecb', { date: shortDate(c.rateDate ?? '') })
  }
}

/** Why there's no rate: "No rate for THB on 21 Oct — add it", or the ECB doesn't publish it. */
export function unavailableText(reason: 'offline' | 'not_covered' | 'too_old' | 'error', code: string, date: string): string {
  if (reason === 'not_covered') return t('trip.panel.notCovered', { name: proseName(code) })
  return t('trip.panel.unavailable', { code, date: shortDate(date) })
}

/** "Settle in ₹ (recommended)" for rupees; "Settle in $" otherwise. */
export function switchText(settle: string): { label: string; note: string } {
  const symbol = currencySymbol(settle)
  return settle === 'INR'
    ? { label: t('trip.panel.switch', { symbol }), note: t('trip.panel.switchNote') }
    : { label: t('trip.panel.switchOther', { symbol }), note: t('trip.panel.switchNoteOther', { code: settle }) }
}

const money = (minor: number, code: string) => formatMoney(minor, code, { trimZeros: true })

/**
 * The expense page's line for a converted expense: "Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)",
 * "… (your bank: ₹3,104.20)". Null without `fx`.
 */
export function fxNoteText(e: Pick<Expense, 'fx' | 'currency' | 'total' | 'date'>): string | null {
  const fx = e.fx
  if (!fx) return null
  const rate = fx.source === 'manual_total' ? (rateFromTotals(fx.amount, fx.currency, e.total, e.currency) ?? fx.rate) : fx.rate
  let source: string
  switch (fx.source) {
    case 'manual_rate':
      source = t('trip.note.manualRate')
      break
    case 'manual_total':
      source = t('trip.note.manualTotal', { amount: formatMoney(e.total, e.currency) })
      break
    case 'pegged': {
      const pegs: Readonly<Record<string, readonly [string, number]>> = PEGS
      const to = pegs[fx.currency]?.[0] ?? pegs[e.currency]?.[0] ?? e.currency
      source = t('trip.note.pegged', { to, date: shortDate(fx.rateDate ?? e.date) })
      break
    }
    default:
      source = t('trip.note.ecb', { date: shortDate(fx.rateDate ?? e.date) })
  }
  return t('trip.note.paid', { paid: money(fx.amount, fx.currency), rate: rateText(rate, fx.currency, e.currency), source })
}

/** The edit address that opens an expense with "Settle in ₹" on (the expense page's "Convert to ₹"). */
export function convertPath(expenseId: string): string {
  return `/app/split/${encodeURIComponent(expenseId)}/edit?convert=1`
}

/** A typed rate as a stored rate string ("02.50" → "2.5", "2,41" stays invalid until tidied), or null. */
export function typedRate(text: string): string | null {
  const trimmed = text.trim().replace(/^0+(?=\d)/, '')
  const [whole = '', fraction = ''] = trimmed.split('.')
  const decimals = fraction.replace(/0+$/, '')
  const tidy = decimals ? `${whole || '0'}.${decimals}` : whole || '0'
  return isValidRate(tidy) ? tidy : null
}
