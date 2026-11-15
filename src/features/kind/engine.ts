/**
 * Paid in kind: a due settled with something that isn't money (a ticket, a favour, cash handed
 * over earlier). The payment itself is recorded the way every other payment is; this file only
 * works out what is open, whether the form is complete, and which records a payment touched, so
 * the "what it was" can be kept beside them. Pure: no storage, no clock.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import type { FriendBalance } from '../friends/friendBalance'

/** What it was, as the chips offer it. */
export const KIND_WHATS = ['ticket', 'elsewhere', 'cash', 'favour', 'other'] as const
export type KindWhat = (typeof KIND_WHATS)[number]

/** `in`: they settle what they owe you. `out`: you settle what you owe them. */
export type KindDirection = 'in' | 'out'

/** The longest "what it was" kept. */
export const MAX_KIND_TEXT = 80

/** Money open between you and one friend, in one currency. */
export interface KindOpen {
  currency: string
  /** Always more than 0. */
  amount: Minor
  direction: KindDirection
}

/** What is open with a friend, one line per currency (the balance's own order: your currency first). */
export function kindOpen(balance: FriendBalance): KindOpen[] {
  return balance.totals
    .filter((total) => Number.isSafeInteger(total.amount) && total.amount !== 0)
    .map((total) => ({ currency: total.currency, amount: Math.abs(total.amount), direction: total.amount > 0 ? 'in' : 'out' }))
}

export type KindIssue = 'amount' | 'over' | 'what' | 'text'

export interface KindForm {
  /** Paise, or null while the field is empty or unreadable. */
  amount: Minor | null
  what: KindWhat | null
  /** The person's own words (needed for "other", kept for the rest when typed). */
  text: string
}

/** What is still missing from the form, first thing first; null when it can be saved. */
export function kindIssue(form: KindForm, open: Minor): KindIssue | null {
  if (form.amount === null || !Number.isSafeInteger(form.amount) || form.amount <= 0) return 'amount'
  if (form.amount > open) return 'over'
  if (form.what === null) return 'what'
  if (form.what === 'other' && cleanKindText(form.text) === '') return 'text'
  return null
}

/** One line, trimmed, at most `MAX_KIND_TEXT` characters. */
export function cleanKindText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_KIND_TEXT).trim()
}

/** A record a payment in kind touched: a payment in a group, or someone's share of a split outside groups. */
export type KindRef =
  | { type: 'payment'; groupId: string; id: string }
  | {
      type: 'share'
      expenseId: string
      debtorId: string
      /** The moment the share was ticked off, or null when only a part of it was paid. */
      paidAt: number | null
    }

/** A payment in kind, as kept on this phone. */
export interface KindEntry {
  id: string
  friendId: string
  direction: KindDirection
  what: KindWhat
  /** The person's own words, or null. */
  text: string | null
  /** What it settled, paise. */
  amount: Minor
  currency: string
  /** YYYY-MM-DD. */
  date: string
  createdAt: number
  refs: KindRef[]
}

export interface DataSnapshot {
  expenses: readonly Expense[]
  groups: readonly Group[]
}

/**
 * What changed between you and `friendId` from `before` to `after`: payments added in groups, and
 * shares of splits outside groups ticked off or paid in part. Other people's records are left out.
 */
export function recordedRefs(before: DataSnapshot, after: DataSnapshot, friendId: string, meId: string = ME_ID): KindRef[] {
  const refs: KindRef[] = []
  const groupsBefore = new Map(before.groups.map((g) => [g.id, new Set(g.settlements.map((s) => s.id))]))
  for (const group of after.groups) {
    const had = groupsBefore.get(group.id)
    for (const s of group.settlements) {
      if (had?.has(s.id)) continue
      const between = (s.fromId === friendId && s.toId === meId) || (s.fromId === meId && s.toId === friendId)
      if (between) refs.push({ type: 'payment', groupId: group.id, id: s.id })
    }
  }
  const expensesBefore = new Map(before.expenses.map((e) => [e.id, e]))
  for (const e of after.expenses) {
    const was = expensesBefore.get(e.id)
    if (!was || was === e) continue
    for (const debtorId of [meId, friendId]) {
      const payerId = debtorId === meId ? friendId : meId
      if (e.payerId !== payerId) continue
      const paidAt = e.paidBack[debtorId]
      if (paidAt !== undefined && was.paidBack[debtorId] === undefined) {
        refs.push({ type: 'share', expenseId: e.id, debtorId, paidAt })
      } else if (paidAt === undefined && (e.partPaid?.[debtorId] ?? 0) > (was.partPaid?.[debtorId] ?? 0)) {
        refs.push({ type: 'share', expenseId: e.id, debtorId, paidAt: null })
      }
    }
  }
  return refs
}

/**
 * True while the record a note points at is still the one it was written for: the payment is still
 * in its group; the share is still ticked off at that same moment (or still has money paid toward it).
 * A payment deleted, or a share unticked and ticked again later, no longer carries the note.
 */
export function refStands(ref: KindRef, data: DataSnapshot): boolean {
  if (ref.type === 'payment') {
    return data.groups.some((g) => g.id === ref.groupId && g.settlements.some((s) => s.id === ref.id))
  }
  const e = data.expenses.find((x) => x.id === ref.expenseId)
  if (!e) return false
  if (ref.paidAt !== null) return e.paidBack[ref.debtorId] === ref.paidAt
  return e.paidBack[ref.debtorId] !== undefined || (e.partPaid?.[ref.debtorId] ?? 0) > 0
}

function matches(ref: KindRef, id: string, debtorId: string | undefined): boolean {
  if (ref.type === 'payment') return ref.id === id
  return ref.expenseId === id && (debtorId === undefined || ref.debtorId === debtorId)
}

/**
 * The payment in kind behind a record: `id` is a group payment's id, or an expense's id (with
 * `debtorId` to say whose share, when it matters). The newest that still stands, or null.
 */
export function findKindEntry(
  entries: readonly KindEntry[],
  id: string,
  debtorId: string | undefined,
  data: DataSnapshot,
): KindEntry | null {
  let best: KindEntry | null = null
  for (const entry of entries) {
    if (best !== null && entry.createdAt <= best.createdAt) continue
    if (entry.refs.some((ref) => matches(ref, id, debtorId) && refStands(ref, data))) best = entry
  }
  return best
}

/** Every payment in kind with `friendId` whose records still stand, newest first. */
export function kindEntriesWith(entries: readonly KindEntry[], friendId: string, data: DataSnapshot): KindEntry[] {
  return entries
    .filter((entry) => entry.friendId === friendId && entry.refs.some((ref) => refStands(ref, data)))
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))
}
