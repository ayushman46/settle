/**
 * What this phone remembers about bills paid at the counter: which shop each bill goes to, the
 * secret of its live list, whether you've paid your own share, and the shops you've paid before
 * (so the next bill there needs no scan). On the phone, like everything else.
 */
import * as z from 'zod/mini'
import { setPaidBack } from '../../data/expenses'
import { deleteSettlement, recordSettlement } from '../../data/groups'
import { expensesStore, groupsStore } from '../../data/stores'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { ME_ID, type Expense } from '../../domain/types'
import { isSettledInGroup } from '../../engine/balances'
import { today } from '../../engine/dates'
import { newCounterKey, type Shop } from './shop'

export interface CounterEntry extends Shop {
  /** The secret of this bill's live list. */
  key: string
  /** When you paid your own share (epoch ms), and how; null until you have. */
  mine: { at: number; how: 'upi' | 'cash' } | null
  /** In a group: person → the payment recorded for their share (so a tick can be taken back). */
  settled: Record<string, string>
  /** Person → when their tick was taken back here (so the live list hears it). */
  undone: Record<string, number>
  at: number
}

export interface CounterState {
  byExpense: Record<string, CounterEntry>
  /** Shops paid before, newest first. */
  shops: Array<Shop & { at: number }>
}

export const MAX_SHOPS = 12
const MAX_ENTRIES = 200

const shopShape = {
  vpa: z.string().check(z.maxLength(330)),
  name: z.string().check(z.maxLength(120)),
  mc: z.nullable(z.string().check(z.regex(/^\d{4}$/))),
  merchant: z.boolean(),
}

export const counterSchema = z.object({
  byExpense: z.record(
    z.string(),
    z.object({
      ...shopShape,
      key: z.string().check(z.regex(/^[A-Za-z0-9_-]{16,64}$/)),
      mine: z.nullable(z.object({ at: z.number(), how: z.enum(['upi', 'cash']) })),
      settled: z.record(z.string(), z.string()),
      undone: z.record(z.string(), z.number()),
      at: z.number(),
    }),
  ),
  shops: z.array(z.object({ ...shopShape, at: z.number() })),
})

export const counterStore = createStore<CounterState>({
  key: STORAGE_KEYS.counter,
  schema: counterSchema,
  initial: () => ({ byExpense: {}, shops: [] }),
  version: 1,
})

/** This bill's counter, or null when it isn't being paid at one. */
export function useCounter(expenseId: string | null | undefined): CounterEntry | null {
  return useStore(counterStore, (state) => (expenseId ? (state.byExpense[expenseId] ?? null) : null))
}

/** Shops paid before, newest first. */
export function useShops(): ReadonlyArray<Shop & { at: number }> {
  return useStore(counterStore, (state) => state.shops)
}

function patch(expenseId: string, change: (entry: CounterEntry) => CounterEntry): void {
  const state = counterStore.get()
  const entry = state.byExpense[expenseId]
  if (!entry) return
  counterStore.set({ ...state, byExpense: { ...state.byExpense, [expenseId]: change(entry) } })
}

/** Sends this bill to `shop`'s counter (a new live list), and remembers the shop. */
export function openCounter(expenseId: string, shop: Shop, now: number = Date.now()): CounterEntry {
  const state = counterStore.get()
  const entry: CounterEntry = { ...shop, key: newCounterKey(), mine: null, settled: {}, undone: {}, at: now }
  const byExpense = { ...state.byExpense, [expenseId]: entry }
  // The oldest go when there are a great many.
  const ids = Object.keys(byExpense)
  if (ids.length > MAX_ENTRIES) {
    for (const id of ids.sort((a, b) => (byExpense[a]?.at ?? 0) - (byExpense[b]?.at ?? 0)).slice(0, ids.length - MAX_ENTRIES)) delete byExpense[id]
  }
  const shops = [{ ...shop, at: now }, ...state.shops.filter((s) => s.vpa !== shop.vpa)].slice(0, MAX_SHOPS)
  counterStore.set({ byExpense, shops })
  return entry
}

/** Stops paying this bill at the counter (what was ticked stays ticked). */
export function closeCounter(expenseId: string): void {
  const state = counterStore.get()
  if (!state.byExpense[expenseId]) return
  const { [expenseId]: _gone, ...rest } = state.byExpense
  counterStore.set({ ...state, byExpense: rest })
}

/** Forgets a shop paid before. */
export function forgetShop(vpa: string): void {
  const state = counterStore.get()
  counterStore.set({ ...state, shops: state.shops.filter((s) => s.vpa !== vpa) })
}

/** Has this person paid their share of the bill at the counter? */
export function hasPaidAtCounter(e: Expense, entry: CounterEntry, friendId: string): boolean {
  if (friendId === ME_ID) return entry.mine !== null
  if (entry.settled[friendId] !== undefined) return true
  return e.paidBack[friendId] !== undefined
}

/** When they paid (for the live list), or null. */
export function paidAtCounterAt(e: Expense, entry: CounterEntry, friendId: string): number | null {
  if (friendId === ME_ID) return entry.mine?.at ?? null
  if (entry.settled[friendId] !== undefined) {
    const group = groupsStore.get().find((g) => g.id === e.groupId)
    return group?.settlements.find((s) => s.id === entry.settled[friendId])?.createdAt ?? entry.at
  }
  return e.paidBack[friendId] ?? null
}

/**
 * Ticks `friendId` as having paid the shop their share (or takes the tick back). For you, it's
 * kept here. For a friend it settles their share with you, since you saved the bill as its payer:
 * on a bill of its own by marking it paid back, in a group by recording a payment of their share
 * (a group's balances count payments, not ticks) — either way they owe nothing for this bill.
 */
export function tickAtCounter(expenseId: string, friendId: string, paid: boolean, how: 'upi' | 'cash' = 'upi', now: number = Date.now()): void {
  const e = expensesStore.get().find((x) => x.id === expenseId)
  const entry = counterStore.get().byExpense[expenseId]
  if (!e || !entry) return
  const undone = { ...entry.undone }
  if (paid) delete undone[friendId]
  else undone[friendId] = now
  if (friendId === ME_ID) {
    patch(expenseId, (c) => ({ ...c, mine: paid ? (c.mine ?? { at: now, how }) : null, undone }))
    return
  }
  const share = e.shares[friendId] ?? 0
  if (share <= 0) return
  if (isSettledInGroup(e, groupsStore.get()) && e.groupId) {
    const had = entry.settled[friendId]
    const settled = { ...entry.settled }
    if (paid && had === undefined) {
      try {
        settled[friendId] = recordSettlement(e.groupId, { fromId: friendId, toId: ME_ID, amount: share, date: today(), method: how }).id
      } catch {
        return
      }
    } else if (!paid && had !== undefined) {
      deleteSettlement(e.groupId, had)
      delete settled[friendId]
    }
    patch(expenseId, (c) => ({ ...c, settled, undone }))
    return
  }
  try {
    setPaidBack(expenseId, friendId, paid)
  } catch {
    return
  }
  patch(expenseId, (c) => ({ ...c, undone }))
}
