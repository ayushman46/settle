/**
 * Small change (chhutta): which of a group's suggested payments are too small to chase, whether a
 * friend's whole balance is, and how much has been let go. Pure: nothing here reads the clock or storage.
 */
import type { Expense, Group, Minor } from '../../domain/types'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { currencyDigits } from '../../lib/money'

/** The limits a group can pick, in whole currency units (₹5, ₹10, ₹20, ₹50). 0 is "off". */
export const CHHUTTA_OPTIONS = [5, 10, 20, 50] as const
/** With no rule set: a one-time offer for dues under this (whole units). */
export const GENTLE_UNITS = 10
/** A friend's whole balance under this (whole units, either way) can be called even. */
export const FRIEND_UNITS = 20
/** At most this many small dues are offered at once. */
export const MAX_OFFERS = 3

/** One amount let go: `toId` (who was owed) let `fromId` (who owed) off. */
export interface ChhuttaEntry {
  id: string
  /** The group it was in, or null for a friend's whole balance. */
  groupId: string | null
  fromId: string
  toId: string
  amount: Minor
  currency: string
  /** YYYY-MM-DD. */
  date: string
  at: number
  /** The payment recorded in the group for it, or null. */
  settlementId: string | null
}

export interface SmallDue {
  /** Stable for the same pair and amount in the same group: what "Keep it" remembers. */
  key: string
  fromId: string
  toId: string
  amount: Minor
  /** The group has no rule: this is the one-time offer. */
  gentle: boolean
}

/** Whole units → minor units of `currency` (₹10 → 1000 paise; ¥10 → 10). */
export function unitsToMinor(units: number, currency: string): Minor {
  return Math.round(units) * 10 ** currencyDigits(currency)
}

/** True for a limit a group can be set to (0 = off). */
export function isChhuttaOption(units: unknown): units is number {
  return units === 0 || (CHHUTTA_OPTIONS as readonly unknown[]).includes(units)
}

export function dueKey(groupId: string, fromId: string, toId: string, amount: Minor): string {
  return `${groupId}|${fromId}|${toId}|${amount}`
}

/** What the one-time offer for a group with no rule is remembered under. */
export function gentleKey(groupId: string): string {
  return `gentle|${groupId}`
}

/**
 * The group's suggested payments that are small change: under the group's limit, or, when the
 * group has no rule (`rule` null), the single smallest one under ₹10, once. A rule of 0 (off) and
 * an archived group offer nothing. Smallest first; ties by the payer's name, then the receiver's.
 */
export function smallDues(
  group: Group,
  expenses: readonly Expense[],
  rule: number | null,
  skipped: readonly string[],
  nameOf: (id: string) => string = (id) => id,
): SmallDue[] {
  if (group.archived || rule === 0) return []
  const gentle = rule === null || !isChhuttaOption(rule)
  if (gentle && skipped.includes(gentleKey(group.id))) return []
  const limit = unitsToMinor(gentle ? GENTLE_UNITS : rule, group.currency)
  const dues: SmallDue[] = []
  for (const transfer of simplifyDebts(groupBalances(group, expenses))) {
    if (!(transfer.amount > 0) || transfer.amount >= limit) continue
    const key = dueKey(group.id, transfer.fromId, transfer.toId, transfer.amount)
    if (skipped.includes(key)) continue
    dues.push({ key, fromId: transfer.fromId, toId: transfer.toId, amount: transfer.amount, gentle })
  }
  dues.sort((a, b) => a.amount - b.amount || nameOf(a.fromId).localeCompare(nameOf(b.fromId)) || nameOf(a.toId).localeCompare(nameOf(b.toId)))
  return dues.slice(0, gentle ? 1 : MAX_OFFERS)
}

/**
 * A friend's net balances when every one of them is small change (under ₹20 either way), else
 * null. Nothing open is not small change: there is nothing to call even.
 */
export function smallBalance(
  totals: ReadonlyArray<{ currency: string; amount: Minor }>,
  units: number = FRIEND_UNITS,
): Array<{ currency: string; amount: Minor }> | null {
  const open = totals.filter((total) => total.amount !== 0)
  if (open.length === 0) return null
  return open.every((total) => Math.abs(total.amount) < unitsToMinor(units, total.currency)) ? open.map((total) => ({ ...total })) : null
}

export interface ChhuttaTotals {
  /** What `meId` let others off. */
  letGo: Minor
  /** What others let `meId` off. */
  letOff: Minor
  /** Entries counted. */
  count: number
}

/** What was let go and let off in `year` ("2026") in one currency, from `meId`'s side. */
export function yearTotals(log: readonly ChhuttaEntry[], year: string, currency: string, meId: string): ChhuttaTotals {
  let letGo = 0
  let letOff = 0
  let count = 0
  for (const entry of log) {
    if (entry.currency !== currency || entry.date.slice(0, 4) !== year || !(entry.amount > 0)) continue
    if (entry.toId === meId) letGo += entry.amount
    else if (entry.fromId === meId) letOff += entry.amount
    else continue
    count += 1
  }
  return { letGo, letOff, count }
}
