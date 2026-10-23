/**
 * How one expense reads on its own page, from the owner's side: the standing pill under the big
 * amount ("You're owed ₹1,600"), the main action, the bill's extra lines, and the small print
 * ("Added 18 Oct, 9:41 pm · from a scanned bill"). Pure, so the screen and its tests agree.
 */
import { ME_ID, type Expense, type ExpenseSource, type Group, type Minor } from '../../domain/types'
import { collectProgress, expenseStanding, isSettledInGroup } from '../../engine/balances'
import { getLanguage, intlLocale, t, type MessageKey } from '../../i18n'
import { currencyDigits, formatMoney } from '../../lib/money'
import { computeSplit } from '../../lib/split'

export type StandingTone = 'positive' | 'negative' | 'neutral'

export interface StandingPill {
  label: string
  tone: StandingTone
  /** Settled: shown with a check. */
  done: boolean
}

/** Where the owner stands on `e` in one short phrase; null when there's nothing to say. */
export function standingPill(e: Expense, payerName: string, groups: readonly Group[]): StandingPill | null {
  const money = (minor: Minor) => formatMoney(minor, e.currency, { trimZeros: true })
  const s = expenseStanding(e, ME_ID, groups)
  if (s.role === 'none') return { label: t('expense.standing.notIn'), tone: 'neutral', done: false }
  if (s.outstanding === null) {
    // Settled through the group: what this expense did to my balance there.
    if (s.net > 0) return { label: t('expense.standing.lent', { amount: money(s.net) }), tone: 'positive', done: false }
    if (s.net < 0) return { label: t('expense.standing.borrowed', { amount: money(-s.net) }), tone: 'negative', done: false }
    return null
  }
  if (s.role === 'paid') {
    if (s.outstanding > 0) return { label: t('expense.standing.owed', { amount: money(s.outstanding) }), tone: 'positive', done: false }
    if (s.net > 0) return { label: t('expense.standing.settled'), tone: 'positive', done: true }
    return null
  }
  if (s.outstanding < 0) return { label: t('expense.standing.owe', { name: payerName, amount: money(-s.outstanding) }), tone: 'negative', done: false }
  return { label: t('expense.standing.paidBack', { name: payerName }), tone: 'positive', done: true }
}

/** What the screen's main button does. */
export type PrimaryAction =
  /** It settles in its group: open the group's settle up. */
  | { kind: 'group'; group: Group }
  /** I owe the payer, in rupees: pay them over UPI. */
  | { kind: 'pay'; amount: Minor }
  /** I owe the payer in another currency: say I've paid. */
  | { kind: 'mark-paid'; amount: Minor }
  /** Share it — with a pay link while others still owe me. */
  | { kind: 'share'; payLink: boolean }

export function primaryAction(e: Expense, groups: readonly Group[]): PrimaryAction {
  const group = groups.find((g) => g.id === e.groupId) ?? null
  if (group && isSettledInGroup(e, [group])) return { kind: 'group', group }
  const mine = e.shares[ME_ID] ?? 0
  if (e.payerId !== ME_ID && mine > 0 && e.paidBack[ME_ID] === undefined) {
    return e.currency === 'INR' ? { kind: 'pay', amount: mine } : { kind: 'mark-paid', amount: mine }
  }
  return { kind: 'share', payLink: e.payerId === ME_ID && collectProgress(e).outstanding > 0 }
}

/** Everyone who still owes the payer (not ticked off yet), in share order. */
export function owingIds(e: Pick<Expense, 'payerId' | 'shares' | 'paidBack'>): string[] {
  return Object.entries(e.shares)
    .filter(([id, share]) => id !== e.payerId && share > 0 && e.paidBack[id] === undefined)
    .map(([id]) => id)
}

/* ------------------------------------------------------------------ the bill */

export interface BillExtraLine {
  /** `fee` lines (delivery-app fees) can repeat: one per fee. */
  key: 'tax' | 'service' | 'fee' | 'tip' | 'discount' | 'other'
  label: string
  /** Signed: + adds to the bill, − takes off. */
  amount: Minor
}

/**
 * The lines between the items and the total: tax, service charge, each delivery-app fee, tip and
 * discount as printed, then whatever is left to reach what was actually paid (a round-off, or
 * charges the bill didn't name) — so the receipt always adds up to the paisa.
 */
export function billExtraLines(e: Pick<Expense, 'total' | 'currency' | 'bill'>): BillExtraLine[] {
  const bill = e.bill
  if (!bill) return []
  const itemsTotal = bill.items.reduce((sum, item) => sum + item.amount, 0)
  const lines: BillExtraLine[] = []
  const add = (key: BillExtraLine['key'], label: string, amount: Minor | null, sign: 1 | -1 = 1) => {
    if (amount !== null && amount > 0) lines.push({ key, label, amount: amount * sign })
  }
  add('tax', t('expense.bill.tax'), bill.meta.tax)
  add('service', t('expense.bill.service'), bill.meta.serviceCharge)
  for (const fee of bill.meta.fees ?? []) add('fee', fee.label, fee.amount)
  add('tip', t('expense.bill.tip'), bill.meta.tip)
  add('discount', t('expense.bill.discount'), bill.meta.discount, -1)
  const rest = e.total - itemsTotal - lines.reduce((sum, line) => sum + line.amount, 0)
  if (rest !== 0) {
    const roundOff = Math.abs(rest) <= 10 ** currencyDigits(e.currency)
    lines.push({ key: 'other', label: t(roundOff ? 'expense.bill.roundOff' : rest > 0 ? 'expense.bill.otherCharges' : 'expense.bill.otherDiscounts'), amount: rest })
  }
  return lines
}

/* ------------------------------------------------------------------ small print */

const SOURCE_KEYS: Readonly<Record<ExpenseSource, MessageKey | null>> = {
  manual: null,
  scan: 'expense.added.source.scan',
  describe: 'expense.added.source.describe',
  sample: 'expense.added.source.sample',
  recurring: 'expense.added.source.recurring',
  sms: 'expense.added.source.sms',
  voice: 'expense.added.source.voice',
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()

/** English keeps the phone's own order; other languages use their Indian locale with Latin digits. */
function formatter(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  const lang = getLanguage()
  const id = `${lang}|${name}`
  let fmt = formatters.get(id)
  if (fmt === undefined) {
    try {
      fmt = lang === 'en' ? new Intl.DateTimeFormat(undefined, options) : new Intl.DateTimeFormat(intlLocale(lang), { ...options, numberingSystem: 'latn' })
    } catch {
      fmt = null
    }
    formatters.set(id, fmt)
  }
  return fmt
}

const STAMP: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
const STAMP_YEAR: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }

function stamp(ms: number, now: number): string {
  const date = new Date(ms)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  const fmt = sameYear ? formatter('stamp', STAMP) : formatter('stampYear', STAMP_YEAR)
  return fmt ? fmt.format(date) : date.toISOString().slice(0, 16).replace('T', ' ')
}

/** Edits within this long of creating it don't count as "edited". */
const EDIT_GRACE_MS = 60_000

/** "Added 18 Oct, 9:41 pm · from a scanned bill · edited 19 Oct, 8:02 am". */
export function addedLine(e: Pick<Expense, 'createdAt' | 'updatedAt' | 'source'>, now: number = Date.now()): string {
  const parts = [t('expense.added', { date: stamp(e.createdAt, now) })]
  const source = SOURCE_KEYS[e.source]
  if (source) parts.push(t(source))
  if (e.updatedAt - e.createdAt > EDIT_GRACE_MS) parts.push(t('expense.added.changed', { date: stamp(e.updatedAt, now) }))
  return parts.join(' · ')
}

/** Each person's part of the bill's delivery-app fees (people with none left out), from the saved split. */
export function feesByPerson(expense: Pick<Expense, 'bill' | 'participants' | 'total'>): Array<{ id: string; amount: number }> {
  const bill = expense.bill
  const feeTotal = (bill?.meta.fees ?? []).reduce((sum, fee) => sum + fee.amount, 0)
  if (!bill || feeTotal <= 0) return []
  const ids = [...new Set(expense.participants.map((p) => p.friendId))]
  const split = computeSplit({
    items: bill.items,
    people: ids.map((id) => ({ id, name: id, color: 0 })),
    assignments: bill.assignments,
    paid: expense.total,
    fees: feeTotal,
    feeSplit: bill.feeSplit ?? 'proportional',
  })
  return split.people.filter((p) => p.fees > 0).map((p) => ({ id: p.person.id, amount: p.fees }))
}
