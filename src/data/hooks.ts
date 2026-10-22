/**
 * React hooks over the stores. Every hook returns referentially stable values: the same array or
 * object until something it depends on actually changes, so they're safe as memo/effect deps.
 */
import { useCallback, useMemo } from 'react'
import { ME_ID, type CategoryId, type Expense, type Friend, type Group, type Minor, type Profile, type RecurringTemplate } from '../domain/types'
import { groupBalances, overallSummary, type OverallSummary } from '../engine/balances'
import { today } from '../engine/dates'
import { dueRecurring, type RecurringDue } from '../engine/recurring'
import { measured } from '../lib/perfMarks'
import { memoizeLast, shallowArrayEqual, useStore } from './store'
import { expensesStore, friendsStore, groupsStore, profileStore, recurringStore } from './stores'

function identity<T>(value: T): T {
  return value
}

/* ------------------------------------------------------------------ shared derived data */

/** ME first, then most recently used, then by name. */
export const sortFriends = memoizeLast((friends: readonly Friend[]): Friend[] =>
  [...friends].sort((a, b) => {
    if (a.id === ME_ID) return -1
    if (b.id === ME_ID) return 1
    return b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name)
  }),
)

const indexFriends = memoizeLast((friends: readonly Friend[]): Record<string, Friend> => {
  const out: Record<string, Friend> = {}
  for (const f of friends) out[f.id] = f
  return out
})

/** Newest date first; same day → most recently created first. */
export function compareExpensesNewestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.createdAt - a.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

const sortExpenses = memoizeLast((expenses: readonly Expense[]): Expense[] =>
  measured('derive:sortExpenses', () => [...expenses].sort(compareExpensesNewestFirst)),
)

/** Active groups first, then most recently active. */
const sortGroups = memoizeLast((groups: readonly Group[]): Group[] =>
  [...groups].sort((a, b) => Number(a.archived) - Number(b.archived) || b.updatedAt - a.updatedAt || a.name.localeCompare(b.name)),
)

/** Active first, then by due day, then title. */
const sortRecurring = memoizeLast((list: readonly RecurringTemplate[]): RecurringTemplate[] =>
  [...list].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.dayOfMonth - b.dayOfMonth || a.title.localeCompare(b.title),
  ),
)

/* ------------------------------------------------------------------ profile & people */

export function useProfile(): Profile {
  return useStore(profileStore, identity)
}

/** Everyone, ME first, then by who you split with most recently. */
export function useFriends(): Friend[] {
  return useStore(friendsStore, sortFriends)
}

export function useFriend(id: string | null | undefined): Friend | null {
  const select = useCallback((friends: Friend[]) => (id ? (friends.find((f) => f.id === id) ?? null) : null), [id])
  return useStore(friendsStore, select)
}

export function useFriendsById(): Record<string, Friend> {
  return useStore(friendsStore, indexFriends)
}

/** The owner's own friend entry. */
export function useMe(): Friend {
  const me = useFriend(ME_ID)
  const profile = useProfile()
  return useMemo(
    () => me ?? { id: ME_ID, name: profile.name || 'Me', color: 0, upiId: profile.upiId, phone: null, createdAt: 0, lastUsedAt: 0 },
    [me, profile.name, profile.upiId],
  )
}

/* ------------------------------------------------------------------ expenses */

export interface ExpenseFilter {
  /** undefined = any; null = not in a group; a string = that group only. */
  groupId?: string | null
  /** Expenses this friend paid for or is part of. */
  friendId?: string
  category?: CategoryId
}

/** Expenses, newest date first, optionally filtered. */
export function useExpenses(filter?: ExpenseFilter): Expense[] {
  const groupId = filter?.groupId
  const friendId = filter?.friendId
  const category = filter?.category
  const select = useCallback(
    (expenses: Expense[]) => {
      const sorted = sortExpenses(expenses)
      if (groupId === undefined && friendId === undefined && category === undefined) return sorted
      return sorted.filter(
        (e) =>
          (groupId === undefined || e.groupId === groupId) &&
          (category === undefined || e.category === category) &&
          (friendId === undefined || e.payerId === friendId || e.participants.some((p) => p.friendId === friendId)),
      )
    },
    [groupId, friendId, category],
  )
  return useStore(expensesStore, select, shallowArrayEqual)
}

export function useExpense(id: string | null | undefined): Expense | null {
  const select = useCallback((expenses: Expense[]) => (id ? (expenses.find((e) => e.id === id) ?? null) : null), [id])
  return useStore(expensesStore, select)
}

/* ------------------------------------------------------------------ groups & recurring */

/** Groups, active first then most recently active. `archived`: undefined = all, true/false = only those. */
export function useGroups(opts?: { archived?: boolean }): Group[] {
  const archived = opts?.archived
  const select = useCallback(
    (groups: Group[]) => {
      const sorted = sortGroups(groups)
      return archived === undefined ? sorted : sorted.filter((g) => g.archived === archived)
    },
    [archived],
  )
  return useStore(groupsStore, select, shallowArrayEqual)
}

export function useGroup(id: string | null | undefined): Group | null {
  const select = useCallback((groups: Group[]) => (id ? (groups.find((g) => g.id === id) ?? null) : null), [id])
  return useStore(groupsStore, select)
}

export function useRecurring(): RecurringTemplate[] {
  return useStore(recurringStore, sortRecurring)
}

/** Recurring splits that are overdue or due within a week, soonest first. */
export function useDueRecurring(day: string = today()): RecurringDue[] {
  const templates = useStore(recurringStore, identity)
  return useMemo(() => dueRecurring(templates, day), [templates, day])
}

/* ------------------------------------------------------------------ balances */

function selectCurrency(profile: Profile): string {
  return profile.currency
}

/** Where I stand with everyone, in my profile currency (other currencies listed separately). */
export function useSummary(): OverallSummary {
  const expenses = useStore(expensesStore, identity)
  const groups = useStore(groupsStore, identity)
  const currency = useStore(profileStore, selectCurrency)
  return useMemo(() => measured('derive:summary', () => overallSummary(expenses, groups, ME_ID, currency)), [expenses, groups, currency])
}

const NO_BALANCES: Record<string, Minor> = Object.freeze({}) as Record<string, Minor>

/** Each member's net balance in a group (+ is owed, − owes); {} for an unknown group. */
export function useGroupBalances(groupId: string | null | undefined): Record<string, Minor> {
  const group = useGroup(groupId)
  const expenses = useStore(expensesStore, identity)
  return useMemo(() => (group ? groupBalances(group, expenses) : NO_BALANCES), [group, expenses])
}

/** True once there's anything worth coming back to (an expense or a group). */
export function useHasData(): boolean {
  const hasExpenses = useStore(expensesStore, (list: Expense[]) => list.length > 0)
  const hasGroups = useStore(groupsStore, (list: Group[]) => list.length > 0)
  return hasExpenses || hasGroups
}

/** Non-hook version of `useHasData` (for routing decisions before render). */
export function hasData(): boolean {
  return expensesStore.get().length > 0 || groupsStore.get().length > 0
}
