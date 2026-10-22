/**
 * How one expense reads on its own page, from the owner's side: the standing pill under the big
 * amount ("You're owed ₹1,600"), the main action, the bill's extra lines, and the small print
 * ("Added 18 Oct, 9:41 pm · from a scanned bill"). Pure, so the screen and its tests agree.
 */
import { ME_ID, type Expense, type ExpenseSource, type Group, type Minor } from '../../domain/types'
import { collectProgress, expenseStanding, isSettledInGroup } from '../../engine/balances'
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
  if (s.role === 'none') return { label: 'You’re not in this one', tone: 'neutral', done: false }
  if (s.outstanding === null) {
    // Settled through the group: what this expense did to my balance there.
    if (s.net > 0) return { label: `You lent ${money(s.net)}`, tone: 'positive', done: false }
    if (s.net < 0) return { label: `You borrowed ${money(-s.net)}`, tone: 'negative', done: false }
    return null
  }
  if (s.role === 'paid') {
    if (s.outstanding > 0) return { label: `You’re owed ${money(s.outstanding)}`, tone: 'positive', done: false }
    if (s.net > 0) return { label: 'Settled', tone: 'positive', done: true }
    return null
  }
  if (s.outstanding < 0) return { label: `You owe ${payerName} ${money(-s.outstanding)}`, tone: 'negative', done: false }
  return { label: `You paid ${payerName} back`, tone: 'positive', done: true }
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
  add('tax', 'Tax', bill.meta.tax)
  add('service', 'Service charge', bill.meta.serviceCharge)
  for (const fee of bill.meta.fees ?? []) add('fee', fee.label, fee.amount)
  add('tip', 'Tip', bill.meta.tip)
  add('discount', 'Discount', bill.meta.discount, -1)
  const rest = e.total - itemsTotal - lines.reduce((sum, line) => sum + line.amount, 0)
  if (rest !== 0) {
    const roundOff = Math.abs(rest) <= 10 ** currencyDigits(e.currency)
    lines.push({ key: 'other', label: roundOff ? 'Round-off' : rest > 0 ? 'Other charges' : 'Other discounts', amount: rest })
  }
  return lines
}

/* ------------------------------------------------------------------ small print */

const SOURCE_LABELS: Readonly<Record<ExpenseSource, string | null>> = {
  manual: null,
  scan: 'from a scanned bill',
  describe: 'with “Just say it”',
  sample: 'from the sample bill',
  recurring: 'from a recurring split',
  sms: 'from a bank SMS',
  voice: 'by voice',
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, options)
  } catch {
    return null
  }
}

const STAMP = formatter({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const STAMP_YEAR = formatter({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function stamp(ms: number, now: number): string {
  const date = new Date(ms)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  const fmt = sameYear ? STAMP : STAMP_YEAR
  return fmt ? fmt.format(date) : date.toISOString().slice(0, 16).replace('T', ' ')
}

/** Edits within this long of creating it don't count as "edited". */
const EDIT_GRACE_MS = 60_000

/** "Added 18 Oct, 9:41 pm · from a scanned bill · edited 19 Oct, 8:02 am". */
export function addedLine(e: Pick<Expense, 'createdAt' | 'updatedAt' | 'source'>, now: number = Date.now()): string {
  const parts = [`Added ${stamp(e.createdAt, now)}`]
  const source = SOURCE_LABELS[e.source]
  if (source) parts.push(source)
  if (e.updatedAt - e.createdAt > EDIT_GRACE_MS) parts.push(`last changed ${stamp(e.updatedAt, now)}`)
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
