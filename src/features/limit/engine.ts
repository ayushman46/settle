/**
 * Udhaar limit: the most you are comfortable with one person owing you. A ceiling per friend, and
 * an optional one for everyone who has none of their own. It only ever warns: nothing is blocked.
 *
 * What someone owes is never kept here: it is the app's own number (`overallSummary`, the same one
 * the friend page and To collect show), in your currency. "After this split" is worked out by
 * adding the split to the app's data and asking that same function again, so the note can never
 * disagree with the page it sends you to.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { currencyDigits, MAX_MINOR } from '../../lib/money'

export interface LimitState {
  /** The ceiling for everyone without one of their own (paise), or null for none. */
  everyone: Minor | null
  /** Friend → their own ceiling (paise). 0 = no limit for them, whatever the one for everyone says. */
  byFriend: Record<string, Minor>
}

/** The quick picks, in whole units of the currency: ₹500, ₹1,000, ₹2,000, ₹5,000. */
export const LIMIT_CHOICES_MAJOR = [500, 1000, 2000, 5000] as const

/** The quick picks in the currency's minor units. */
export function limitChoices(currency: string): Minor[] {
  const unit = 10 ** currencyDigits(currency)
  return LIMIT_CHOICES_MAJOR.map((major) => major * unit)
}

/** A ceiling that can be kept: a whole number of paise, more than zero, within what the app can hold. */
export function isLimitAmount(value: unknown): value is Minor {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_MINOR
}

export interface AppliedLimit {
  amount: Minor
  /** Their own (true), or the one for everyone (false). */
  own: boolean
}

/** The ceiling that applies to a friend: their own, else the one for everyone; null when there is none (or they are exempt). */
export function limitFor(state: LimitState, friendId: string): AppliedLimit | null {
  if (friendId === ME_ID || friendId === '') return null
  const own = Object.hasOwn(state.byFriend, friendId) ? state.byFriend[friendId] : undefined
  if (own !== undefined) return isLimitAmount(own) ? { amount: own, own: true } : null
  return isLimitAmount(state.everyone) ? { amount: state.everyone, own: false } : null
}

/** How a friend's own setting reads on the picker: an amount, 'none' (exempt) or 'everyone' (nothing of their own). */
export function ownChoice(state: LimitState, friendId: string): Minor | 'none' | 'everyone' {
  if (!Object.hasOwn(state.byFriend, friendId)) return isLimitAmount(state.everyone) ? 'everyone' : 'none'
  const own = state.byFriend[friendId]
  return isLimitAmount(own) ? own : 'none'
}

/** By how much what they owe is over the ceiling (0 when it isn't; being exactly on it is not over). */
export function overBy(owed: Minor, limit: Minor): Minor {
  return owed > limit ? owed - limit : 0
}

/** `amounts` as the new-expense screen may hand it over: keyed by friend, or a list in the order of `friendIds`. */
export type Amounts = Readonly<Record<string, number>> | readonly number[]

/** What each friend would newly owe from the split (positive whole paise only; never you). */
export function newlyOwed(friendIds: readonly string[], amounts: Amounts): Record<string, Minor> {
  const out: Record<string, Minor> = {}
  friendIds.forEach((id, index) => {
    if (id === ME_ID || id === '' || Object.hasOwn(out, id)) return
    const raw = Array.isArray(amounts) ? (amounts as readonly number[])[index] : Object.hasOwn(amounts, id) ? (amounts as Readonly<Record<string, number>>)[id] : undefined
    if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 && raw <= MAX_MINOR) out[id] = raw
  })
  return out
}

/** A stand-in for the split being written: you paid, each friend owes their amount. Never saved. */
function draftExpense(owed: Readonly<Record<string, Minor>>, currency: string, groupId: string | null): Expense {
  const total = Object.values(owed).reduce((a, b) => a + b, 0)
  return {
    id: 'limit:draft',
    kind: 'split',
    title: '',
    category: 'other',
    currency,
    total,
    date: '2000-01-01',
    createdAt: 0,
    updatedAt: 0,
    payerId: ME_ID,
    mode: 'exact',
    participants: Object.entries(owed).map(([friendId, input]) => ({ friendId, input })),
    shares: { ...owed },
    roundedToWhole: false,
    note: null,
    groupId,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

export interface LimitWarning {
  friendId: string
  limit: Minor
  /** Their own ceiling, or the one for everyone. */
  own: boolean
  /** What they owe you now (never less than 0 here: someone you owe is not "owing you"). */
  before: Minor
  /** What they would owe you once the split is saved. */
  after: Minor
  /** They were over it already. */
  wasOver: boolean
}

export interface LimitCheckInput {
  state: LimitState
  /** The people in the split, in the order to warn in. */
  friendIds: readonly string[]
  /** What each would newly owe you (their share, when you are paying). */
  amounts: Amounts
  expenses: readonly Expense[]
  groups: readonly Group[]
  /** Your currency: limits are amounts in it, and only money in it is counted. */
  currency: string
  /** The split's own currency; when it isn't yours, nothing is warned about. */
  splitCurrency?: string
  /** The group the split is going into, so its fewest-payments settling is taken into account. */
  groupId?: string | null
  /** When editing a saved split: its id, so it isn't counted twice. */
  expenseId?: string | null
}

/** True when at least one ceiling is set anywhere (so there is something to check against). */
export function hasAnyLimit(state: LimitState): boolean {
  return isLimitAmount(state.everyone) || Object.values(state.byFriend).some(isLimitAmount)
}

/**
 * Who this split takes over their ceiling (or further over it): only people it makes owe you
 * more, and only where a ceiling applies. The people in the split come first, in the order given;
 * then anyone else it changes (in a group that settles in the fewest payments, your paying for
 * one person can leave another owing you instead). Empty when no limit is set at all.
 */
export function limitWarnings(input: LimitCheckInput): LimitWarning[] {
  const { state, friendIds, currency } = input
  if ((input.splitCurrency ?? currency) !== currency || !hasAnyLimit(state)) return []
  const owed = newlyOwed(friendIds, input.amounts)
  if (Object.keys(owed).length === 0) return []

  const others = input.expenseId ? input.expenses.filter((e) => e.id !== input.expenseId) : input.expenses
  const before = overallSummary(others, input.groups, ME_ID, currency).byFriend
  const after = overallSummary([...others, draftExpense(owed, currency, input.groupId ?? null)], input.groups, ME_ID, currency).byFriend

  const warnings: LimitWarning[] = []
  for (const friendId of new Set([...Object.keys(owed), ...Object.keys(after)])) {
    const limit = limitFor(state, friendId)
    if (!limit) continue
    const was = Math.max(0, before[friendId] ?? 0)
    const now = Math.max(0, after[friendId] ?? 0)
    if (now <= was || now <= limit.amount) continue
    warnings.push({ friendId, limit: limit.amount, own: limit.own, before: was, after: now, wasOver: was > limit.amount })
  }
  return warnings
}

export interface LimitStanding {
  friendId: string
  /** What they owe you now (0 when nothing, or when you owe them). */
  owed: Minor
  limit: AppliedLimit | null
  /** 0 when within the ceiling or there is none. */
  over: Minor
}

/** Where one person stands against their ceiling, from the app's own balances (`byFriend`: + they owe you). */
export function limitStanding(state: LimitState, friendId: string, byFriend: Readonly<Record<string, Minor>>): LimitStanding {
  const owed = Math.max(0, byFriend[friendId] ?? 0)
  const limit = limitFor(state, friendId)
  return { friendId, owed, limit, over: limit ? overBy(owed, limit.amount) : 0 }
}

/**
 * The people list for the limits screen: those over their ceiling first (furthest over first),
 * then whoever owes you most, then people with a ceiling of their own, then by name (never by id:
 * ids differ from phone to phone).
 */
export function sortStandings<T extends LimitStanding & { name: string }>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => {
    if (a.over !== b.over) return b.over - a.over
    if (a.owed !== b.owed) return b.owed - a.owed
    const ownA = a.limit?.own ? 1 : 0
    const ownB = b.limit?.own ? 1 : 0
    if (ownA !== ownB) return ownB - ownA
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  })
}
