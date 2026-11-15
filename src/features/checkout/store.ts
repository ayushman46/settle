/**
 * What Settle before you leave keeps on this phone: per group, the checklist as it was worked
 * out and which lines are ticked (each tick points at the real payment recorded in the group).
 * Kept so the list is still there after hopping to a UPI app and back.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { MAX_MINOR } from '../../lib/money'
import { MAX_CHECKOUT_ROWS, type CheckoutRow, type CheckoutSession } from './engine'

export interface CheckoutState {
  /** Group id → its checklist. */
  byGroup: Record<string, CheckoutSession>
}

/** At most this many groups keep a checklist (the most recently started win). */
export const MAX_CHECKOUTS = 50

const personId = z.string().check(z.minLength(1), z.maxLength(80))

const rowSchema = z.object({
  fromId: personId,
  toId: personId,
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  settlementId: z.catch(z.nullable(z.string().check(z.minLength(1), z.maxLength(80))), null),
})

/** Reads each line on its own: one unreadable line is dropped, never the rest. */
const rowsSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const rows: CheckoutRow[] = []
    for (const value of raw) {
      const parsed = z.safeParse(rowSchema, value)
      if (parsed.success && parsed.data.fromId !== parsed.data.toId) rows.push(parsed.data)
    }
    return rows.slice(0, MAX_CHECKOUT_ROWS)
  }),
)

const sessionSchema = z.object({
  rows: rowsSchema,
  startedAt: z.catch(z.int().check(z.gte(0)), 0),
  revised: z.catch(z.boolean(), false),
})

const byGroupSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, CheckoutSession]> = []
    for (const [groupId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(sessionSchema, value)
      if (parsed.success && groupId && parsed.data.rows.length > 0) read.push([groupId, parsed.data])
    }
    read.sort((a, b) => b[1].startedAt - a[1].startedAt)
    return Object.fromEntries(read.slice(0, MAX_CHECKOUTS)) as Record<string, CheckoutSession>
  }),
)

export const checkoutSchema = z.object({ byGroup: z.catch(byGroupSchema, {}) })

export const checkoutStore = createStore<CheckoutState>({
  key: STORAGE_KEYS.checkout,
  schema: checkoutSchema,
  initial: () => ({ byGroup: {} }),
  version: 1,
})

/** The group's checklist, or null when none has begun. */
export function useCheckoutSession(groupId: string): CheckoutSession | null {
  return useStore(checkoutStore, (state) => state.byGroup[groupId] ?? null)
}

export function checkoutFor(groupId: string): CheckoutSession | null {
  return checkoutStore.get().byGroup[groupId] ?? null
}

/**
 * Saves the group's checklist (an empty one is simply forgotten). A checklist with no start yet
 * (`startedAt: null`) begins now.
 */
export function saveCheckout(groupId: string, session: Omit<CheckoutSession, 'startedAt'> & { startedAt: number | null }, now: number = Date.now()): void {
  if (!groupId) return
  const state = checkoutStore.get()
  const rest = { ...state.byGroup }
  delete rest[groupId]
  const rows = session.rows.slice(0, MAX_CHECKOUT_ROWS)
  if (rows.length === 0) {
    if (state.byGroup[groupId]) checkoutStore.set({ ...state, byGroup: rest })
    return
  }
  const next: CheckoutSession = { rows, startedAt: session.startedAt ?? now, revised: session.revised }
  const entries = [[groupId, next] as const, ...Object.entries(rest)]
  entries.sort((a, b) => b[1].startedAt - a[1].startedAt)
  checkoutStore.set({ ...state, byGroup: Object.fromEntries(entries.slice(0, MAX_CHECKOUTS)) })
}

/** Unticks the line that points at this payment (used right after the payment itself is removed). */
export function untickCheckout(groupId: string, settlementId: string): void {
  const session = checkoutFor(groupId)
  if (!session || !session.rows.some((r) => r.settlementId === settlementId)) return
  saveCheckout(groupId, { ...session, rows: session.rows.map((r) => (r.settlementId === settlementId ? { ...r, settlementId: null } : r)) })
}

/** Forgets the group's checklist (the payments recorded from it stay in the group). */
export function clearCheckout(groupId: string): void {
  const state = checkoutStore.get()
  if (!state.byGroup[groupId]) return
  const byGroup = { ...state.byGroup }
  delete byGroup[groupId]
  checkoutStore.set({ ...state, byGroup })
}
