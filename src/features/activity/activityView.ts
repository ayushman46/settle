/**
 * What the Activity tab shows: where each expense stands for the owner (to collect, to pay,
 * settled…), the filter chips, search, and month sections. Pure, so the list, the chip counts and
 * their tests agree to the paisa.
 */
import { ME_ID, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { collectProgress, expenseStanding, groupBalances, simplifyDebts } from '../../engine/balances'
import { CATEGORY_META } from '../../engine/categories'
import { isIsoDate, periodOf } from '../../engine/dates'
import { formatMoney, toInputString } from '../../lib/money'

/* ------------------------------------------------------------------ filters */

export type ActivityFilter = 'all' | 'collect' | 'pay' | 'bills' | 'groups' | 'settled'

export const ACTIVITY_FILTERS: ReadonlyArray<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'collect', label: 'To collect' },
  { id: 'pay', label: 'To pay' },
  { id: 'bills', label: 'Bills' },
  { id: 'groups', label: 'Groups' },
  { id: 'settled', label: 'Settled' },
]

export function isActivityFilter(value: unknown): value is ActivityFilter {
  return ACTIVITY_FILTERS.some((f) => f.id === value)
}

/**
 * Where one expense stands for the owner:
 * - `collect`: I paid and someone still owes me for it.
 * - `pay`: someone else paid and I still owe them my share.
 * - `settled`: everything between me and the others on it is squared up.
 * - `open`: it settles through a group that isn't square yet, or it's between other people who haven't settled.
 * - `personal`: nobody but the payer has a share — there's nothing to settle.
 */
export type ActivityState = 'collect' | 'pay' | 'settled' | 'open' | 'personal'

/** True when somebody other than the payer holds a share of `e`. */
function involvesOthers(e: Expense): boolean {
  return Object.entries(e.shares).some(([id, share]) => id !== e.payerId && share > 0)
}

/** Ids of groups whose balances aren't square (someone still has to pay someone). */
export function openGroupIds(groups: readonly Group[], expenses: readonly Expense[]): Set<string> {
  const open = new Set<string>()
  for (const group of groups) {
    if (simplifyDebts(groupBalances(group, expenses)).length > 0) open.add(group.id)
  }
  return open
}

/** Where `e` stands for the owner (see `ActivityState`). `open` = ids from `openGroupIds`. */
export function activityState(e: Expense, groups: readonly Group[], open: ReadonlySet<string>): ActivityState {
  if (!involvesOthers(e)) return 'personal'
  const standing = expenseStanding(e, ME_ID, groups)
  if (standing.outstanding === null) return e.groupId !== null && open.has(e.groupId) ? 'open' : 'settled'
  if (standing.outstanding > 0) return 'collect'
  if (standing.outstanding < 0) return 'pay'
  if (standing.role === 'none') return collectProgress(e).outstanding > 0 ? 'open' : 'settled'
  return 'settled'
}

/** Every expense's state, worked out once per change of data. */
export function activityStates(expenses: readonly Expense[], groups: readonly Group[]): Map<string, ActivityState> {
  const open = openGroupIds(groups, expenses)
  return new Map(expenses.map((e) => [e.id, activityState(e, groups, open)]))
}

/** True when `e` belongs under `filter`. */
export function matchesFilter(e: Expense, filter: ActivityFilter, state: ActivityState | undefined): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'collect':
      return state === 'collect'
    case 'pay':
      return state === 'pay'
    case 'bills':
      return e.kind === 'bill'
    case 'groups':
      return e.groupId !== null
    case 'settled':
      return state === 'settled'
  }
}

/** How many expenses each filter holds. */
export function filterCounts(
  expenses: readonly Expense[],
  states: ReadonlyMap<string, ActivityState>,
): Record<ActivityFilter, number> {
  const counts: Record<ActivityFilter, number> = { all: 0, collect: 0, pay: 0, bills: 0, groups: 0, settled: 0 }
  for (const e of expenses) {
    for (const { id } of ACTIVITY_FILTERS) if (matchesFilter(e, id, states.get(e.id))) counts[id] += 1
  }
  return counts
}

/* ------------------------------------------------------------------ groups that aren't square */

export interface GroupStanding {
  group: Group
  /** My net balance in the group, in its currency: + I'm owed, − I owe. Never 0. */
  balance: Minor
}

/**
 * Groups where I'm owed (`collect`) or owe (`pay`) money — group expenses settle through the
 * group's balances rather than one by one, so the Activity tab points at the group instead.
 * Biggest amounts first.
 */
export function groupStandings(
  groups: readonly Group[],
  expenses: readonly Expense[],
  direction: 'collect' | 'pay',
): GroupStanding[] {
  const out: GroupStanding[] = []
  for (const group of groups) {
    const balance = groupBalances(group, expenses)[ME_ID] ?? 0
    if (direction === 'collect' ? balance > 0 : balance < 0) out.push({ group, balance })
  }
  return out.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.group.name.localeCompare(b.group.name))
}

/* ------------------------------------------------------------------ search */

/** Comparison text: case- and accent-insensitive, single spaces ("Café  Déjà" → "cafe deja"). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

export interface SearchContext {
  friendsById: Readonly<Record<string, Friend>>
  groupsById: Readonly<Record<string, Group>>
}

/** A search term made only of digits and separators is an amount ("2,400", "649.50"). */
const AMOUNT_TERM = /^\d[\d,]*(\.\d*)?$/

/** Every word in `query` must be found: in the title, note, category, group or a person's name — or, for numbers, at the start of the total or my share. */
export function matchesQuery(e: Expense, query: string, ctx: SearchContext): boolean {
  const terms = fold(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true

  const names = [e.payerId, ...e.participants.map((p) => p.friendId), ...Object.keys(e.shares)]
    .filter((id) => id !== ME_ID)
    .map((id) => ctx.friendsById[id]?.name ?? '')
  const group = e.groupId === null ? undefined : ctx.groupsById[e.groupId]
  const text = fold(
    [e.title, e.note ?? '', (CATEGORY_META[e.category] ?? CATEGORY_META.other).label, group?.name ?? '', ...names].join(' '),
  )
  const amounts = [e.total, e.shares[ME_ID] ?? 0]
    .filter((minor) => minor > 0)
    .flatMap((minor) => [toInputString(minor, e.currency), toInputString(minor, e.currency, { trimZeros: true })])

  return terms.every((term) => {
    if (AMOUNT_TERM.test(term)) {
      const digits = term.replace(/,/g, '')
      if (amounts.some((amount) => amount.startsWith(digits))) return true
    }
    return text.includes(term)
  })
}

/* ------------------------------------------------------------------ sections */

export interface MonthSection {
  /** `YYYY-MM`. */
  period: string
  /** "October" this year, "October 2025" otherwise. */
  label: string
  expenses: Expense[]
}

function monthFormatter(withYear: boolean): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' })
  } catch {
    return null
  }
}

const MONTH = monthFormatter(false)
const MONTH_YEAR = monthFormatter(true)

/** "October" for `2026-10` when `today` is in 2026; "October 2025" for other years. */
export function monthLabel(period: string, today: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  const date = new Date(2000, 0, 15, 12)
  date.setFullYear(y, m - 1, 15)
  const fmt = period.slice(0, 4) === today.slice(0, 4) ? MONTH : MONTH_YEAR
  return fmt ? fmt.format(date) : period
}

/** Splits a newest-first list into months, keeping the order. */
export function groupByMonth(expenses: readonly Expense[], today: string): MonthSection[] {
  const sections: MonthSection[] = []
  for (const e of expenses) {
    const period = isIsoDate(e.date) ? periodOf(e.date) : 'unknown'
    const last = sections[sections.length - 1]
    if (last && last.period === period) last.expenses.push(e)
    else sections.push({ period, label: period === 'unknown' ? 'Undated' : monthLabel(period, today), expenses: [e] })
  }
  return sections
}

/* ------------------------------------------------------------------ the line under the chips */

/** Sums per currency, profile currency first: "₹2,140", "₹2,140 + $25". */
function sumLine(totals: ReadonlyMap<string, Minor>, currency: string): string {
  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => (a === currency ? -1 : b === currency ? 1 : a < b ? -1 : 1))
    .map(([code, amount]) => formatMoney(Math.abs(amount), code, { trimZeros: true }))
    .join(' + ')
}

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

const NOTHING: Readonly<Record<ActivityFilter, string>> = {
  all: 'No expenses yet',
  collect: 'Nothing to collect',
  pay: 'Nothing to pay',
  bills: 'No bills yet',
  groups: 'No group expenses yet',
  settled: 'Nothing settled yet',
}

/**
 * A short summary of what's listed (every match, not just the rows on screen), also announced to
 * screen readers as the list changes: "₹2,140 to collect on 3 splits", "2 bills", "No matches for “goa”".
 */
export function resultsLine(input: {
  filter: ActivityFilter
  query: string
  /** Everything that matches the filter and the search. */
  matches: readonly Expense[]
  groups: readonly Group[]
  /** The profile currency (listed first when amounts are in several). */
  currency: string
}): string {
  const { filter, query, matches, groups, currency } = input
  const q = query.trim()
  if (q) {
    if (matches.length === 0) return `No matches for “${q}”`
    return `${countLabel(matches.length, 'match', 'matches')} for “${q}”`
  }
  if (matches.length === 0) return NOTHING[filter]
  switch (filter) {
    case 'all':
      return countLabel(matches.length, 'expense', 'expenses')
    case 'collect':
    case 'pay': {
      const totals = new Map<string, Minor>()
      for (const e of matches) {
        const outstanding = expenseStanding(e, ME_ID, groups).outstanding ?? 0
        totals.set(e.currency, (totals.get(e.currency) ?? 0) + outstanding)
      }
      const sum = sumLine(totals, currency)
      const splits = countLabel(matches.length, 'split', 'splits')
      return filter === 'collect' ? `${sum} to collect on ${splits}` : `You owe ${sum} on ${splits}`
    }
    case 'bills':
      return countLabel(matches.length, 'bill', 'bills')
    case 'groups':
      return countLabel(matches.length, 'group expense', 'group expenses')
    case 'settled':
      return `${countLabel(matches.length, 'expense', 'expenses')} settled`
  }
}
