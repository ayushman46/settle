/**
 * The refunds recorded on this phone, newest first: each with the expense exactly as it was
 * before (for an exact Undo). An expense refunded in full lives only here until it is put back,
 * so this store belongs in backups.
 */
import * as z from 'zod/mini'
import { expenseSchema, isCanonicalExpense } from '../../data/schemas'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import type { Expense } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import type { RefundRecord } from './engine'

export interface RefundState {
  refunds: RefundRecord[]
}

/** Part refunds remembered (the oldest are forgotten: their expenses keep the smaller total and the note). */
export const MAX_PART_REFUNDS = 200
/** Expenses refunded in full that can be kept at once (never dropped to make room). */
export const MAX_FULL_REFUNDS = 200

const id = z.string().check(z.minLength(1), z.maxLength(200))

const recordShape = z.object({
  id,
  expenseId: id,
  kind: z.enum(['lower', 'remove']),
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  toId: id,
  date: z.string().check(z.refine(isIsoDate)),
  createdAt: z.catch(z.number(), 0),
  before: z.unknown(),
  afterId: z.catch(z.nullable(id), null),
  companionIds: z.catch(z.array(id), []),
  savedAt: z.catch(z.number(), 0),
})

/** An expense as the app saved it comes back untouched; anything else is repaired like any stored expense, or dropped. */
function readExpense(raw: unknown): Expense | null {
  if (isCanonicalExpense(raw)) return raw
  const parsed = z.safeParse(expenseSchema, raw)
  return parsed.success ? parsed.data : null
}

/** Keeps full refunds (they hold the only copy of their expense) ahead of the cap on part refunds. */
function capped(records: readonly RefundRecord[]): RefundRecord[] {
  let parts = 0
  return records.filter((r) => r.kind === 'remove' || ++parts <= MAX_PART_REFUNDS)
}

/** Reads each record on its own: one unreadable record is dropped, never the rest. */
const refundsSchema: ZodType<RefundRecord[]> = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const out: RefundRecord[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(recordShape, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      const before = readExpense(parsed.data.before)
      if (!before || before.id !== parsed.data.expenseId) continue
      seen.add(parsed.data.id)
      out.push({ ...parsed.data, before })
    }
    return capped(out)
  }),
)

export const refundSchema = z.object({ refunds: z.catch(refundsSchema, []) })

export const refundStore = createStore<RefundState>({
  key: STORAGE_KEYS.refund,
  schema: refundSchema,
  initial: () => ({ refunds: [] }),
  version: 1,
})

export function useRefunds(): readonly RefundRecord[] {
  return useStore(refundStore, (state) => state.refunds)
}

/** True when another expense refunded in full can be kept. */
export function hasRoomForFullRefund(): boolean {
  return refundStore.get().refunds.filter((r) => r.kind === 'remove').length < MAX_FULL_REFUNDS
}

export function addRefundRecord(record: RefundRecord): void {
  refundStore.update((state) => ({ ...state, refunds: capped([record, ...state.refunds.filter((r) => r.id !== record.id)]) }))
}

/** Removes a record and returns where it was (for putting it back), or -1. */
export function removeRefundRecord(recordId: string): number {
  const state = refundStore.get()
  const index = state.refunds.findIndex((r) => r.id === recordId)
  if (index !== -1) refundStore.set({ ...state, refunds: state.refunds.filter((r) => r.id !== recordId) })
  return index
}

/** Puts a record back at `index`. */
export function restoreRefundRecord(record: RefundRecord, index: number): void {
  refundStore.update((state) => {
    const rest = state.refunds.filter((r) => r.id !== record.id)
    const at = Math.min(Math.max(0, index), rest.length)
    return { ...state, refunds: [...rest.slice(0, at), record, ...rest.slice(at)] }
  })
}
