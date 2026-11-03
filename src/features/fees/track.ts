/**
 * Bank charge SMS kept as charges: pasted ones, and (in the Android app) the bank's own alerts as
 * they come. Each charge is kept once (src/features/fees/actions.ts sameCharge); a reversal is
 * noted on the charge it puts back; a warning that the balance is short is kept for the
 * minimum-balance rule's month. Returns what changed, with one Undo for all of it.
 */
import { UPI_APPS } from '../autosettle/alerts'
import { MERCHANT_APPS } from '../stuck/detect'
import { addCharges, addNotice, markReversed, type AddResult } from './actions'
import { findBank } from '../sharein/sms/brands'
import { findAccount, findDate, findPrintedDate, scrubSms } from '../sharein/sms/parseSms'
import { MAX_BY_KIND } from './scan'
import { readChargeSms, splitMessages } from './sms'
import { feesStore, type FeeCharge, type FeeSource } from './store'

export interface TrackResult {
  added: FeeCharge[]
  /** Charges already kept that this told Settle about again. */
  known: number
  /** Charges put back. */
  reversed: number
  /** Shortfall warnings noted. */
  notices: number
  undo: () => void
}

/** "Your a/c balance is below the required MAB / Maintain AMB to avoid charges": the bank's warning. */
const WARNING = /\b(?:below|less than|short of|shortfall|maintain)\b[^.\n]{0,60}\b(?:minimum|min\.?|average|avg\.?|mab|amb|aqb|qab)\b[^.\n]{0,40}\b(?:balance|bal)\b|\b(?:mab|amb|aqb)\b[^.\n]{0,40}\b(?:not maintained|shortfall|below)\b/i

/**
 * Reads messages (each may hold several, pasted together) and keeps their charges. A message is a
 * text, or a text with the day the phone got it (an Android alert): a message without a date of
 * its own is dated by that day, not the day Settle read it.
 */
export function trackChargeSms(texts: readonly (string | { text: string; day: string })[], source: FeeSource, today: string): TrackResult {
  const before = feesStore.get()
  const drafts: Omit<FeeCharge, 'id' | 'addedAt'>[] = []
  const reversals: { kind: FeeCharge['kind']; amount: number; account: string | null; date: string }[] = []
  let notices = 0
  for (const item of texts) {
    const text = typeof item === 'string' ? item : item.text
    const received = typeof item === 'string' ? today : item.day
    for (const message of splitMessages(text)) {
      const read = readChargeSms(message, received)
      if (!read) {
        if (WARNING.test(message) && !/\bdebited\b/i.test(message)) {
          // Whose warning: the bank and account it names (else it counts for any account).
          addNotice({ date: findDate(message, received) ?? received, bank: findBank(scrubSms(message)), account: findAccount(message) })
          notices++
        }
        continue
      }
      if (read.type === 'reversal') {
        // A reversal dated after today hasn't happened yet (the date read falls back to today for a
        // future one, so look at the date printed).
        const printed = findPrintedDate(message)
        if (read.date > today || (printed !== null && printed > today)) continue
        reversals.push({ kind: read.kind, amount: read.amount, account: read.account, date: read.date })
        continue
      }
      // An SMS amount usually includes the GST ("incl. GST"); keep the base and the GST apart when it says so.
      const inclusive = /\bincl(?:uding|\.)?\s*(?:of\s*)?gst\b|\binclusive of gst\b/i.test(message)
      const base = inclusive ? Math.round(read.amount / 1.18) : read.amount
      // More than this kind of charge ever costs: a payment that happens to say "charges" or "fee".
      if (read.amount + (inclusive ? 0 : read.gst) > (MAX_BY_KIND[read.kind] ?? Infinity)) continue
      drafts.push({
        date: read.date,
        kind: read.kind,
        amount: base,
        gst: inclusive ? read.amount - base : read.gst,
        reversed: 0,
        text: read.text,
        bank: read.bank,
        account: read.account,
        balanceBefore: read.balanceAfter !== null ? read.balanceAfter + read.amount + (inclusive ? 0 : read.gst) : null,
        balanceAfter: read.balanceAfter,
        monthAtm: null,
        onFailed: false,
        online: null,
        avg: null,
        idleDays: null,
        monthWithdrawals: null,
        source,
      })
    }
  }
  const result: AddResult = addCharges(drafts)
  let reversed = 0
  for (const r of reversals) {
    const target = feesStore
      .get()
      .charges.filter((c) => c.kind === r.kind && c.reversed < c.amount + c.gst && c.date <= r.date && (r.account === null || c.account === null || c.account.slice(-4) === r.account.slice(-4)))
      .sort((a, b) => Math.abs(a.amount + a.gst - r.amount) - Math.abs(b.amount + b.gst - r.amount))[0]
    if (target) {
      markReversed(target.id, r.amount)
      reversed++
    }
  }
  return { added: result.added, known: result.known.length, reversed, notices, undo: () => feesStore.set(before) }
}

/** The bank SMS among the phone's alerts (Android): not a UPI app's or a shop's own alert. Read as charges, reversals and warnings. */
export function trackFeeAlerts(alerts: ReadonlyArray<{ app: string; title: string; text: string; postedAt: number }>, today: string): TrackResult {
  const texts = alerts
    .filter((a) => !(a.app in UPI_APPS) && !(a.app in MERCHANT_APPS))
    .map((a) => ({ text: a.title ? `${a.title}\n${a.text}` : a.text, day: dayOf(a.postedAt, today) }))
  return trackChargeSms(texts, 'alert', today)
}

/** The phone's day for `at` (epoch ms), never after today. */
function dayOf(at: number, today: string): string {
  if (!Number.isFinite(at) || at <= 0) return today
  const d = new Date(at)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return day > today ? today : day
}
