/**
 * The plans to pay in parts, kept on this phone: who, which way, the dated parts and which are
 * ticked. Never a balance: what is owed is always read from the app's own records.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { isRunning, MAX_PARTS, type KistPlan } from './engine'

export interface KistState {
  plans: KistPlan[]
}

/** At most this many plans are kept: running ones first, then the newest. */
export const MAX_PLANS = 200

const amount = z.int().check(z.gt(0), z.lte(MAX_MINOR))
const id = z.string().check(z.minLength(1), z.maxLength(80))
const isoDate = z.string().check(z.refine(isIsoDate))

const recordSchema = z.union([
  z.object({ kind: z.literal('group'), groupId: id, settlementId: id, amount: z.int() }),
  z.object({ kind: z.literal('split'), expenseId: id, amount: z.int() }),
])

/** Reads each record on its own: one that makes no sense is dropped, never the part. */
const recordsSchema = z.pipe(
  z.catch(z.array(z.unknown()), []),
  z.transform((raw: unknown[]) => raw.flatMap((r) => {
    const parsed = z.safeParse(recordSchema, r)
    return parsed.success ? [parsed.data] : []
  })),
)

const partSchema = z.object({
  amount,
  due: isoDate,
  paidAt: z.catch(z.nullable(z.int().check(z.gte(0))), null),
  paidOn: z.catch(z.nullable(isoDate), null),
  how: z.catch(z.nullable(z.enum(['plan', 'counted'])), null),
  records: recordsSchema,
})

const paidBeforeSchema = z.pipe(
  z.catch(z.record(z.string(), z.unknown()), {}),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_MINOR) out[key] = value
    }
    return out
  }),
)

const planSchema = z.object({
  id,
  friendId: id,
  direction: z.enum(['pay', 'receive']),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  every: z.catch(z.enum(['month', 'week']), 'month'),
  parts: z.array(partSchema).check(z.minLength(1), z.maxLength(MAX_PARTS)),
  createdAt: z.int().check(z.gte(0)),
  endedAt: z.catch(z.nullable(z.int().check(z.gte(0))), null),
  paidBefore: paidBeforeSchema,
})

/** A part that says it is paid has all three of when, which day and how; one that is not has none. */
function tidy(plan: z.infer<typeof planSchema>): KistPlan {
  return {
    ...plan,
    parts: plan.parts.map((p) =>
      p.paidAt === null ? { ...p, paidAt: null, paidOn: null, how: null, records: [] } : { ...p, how: p.how ?? 'plan', paidOn: p.paidOn ?? p.due },
    ),
  }
}

function capped(plans: readonly KistPlan[]): KistPlan[] {
  if (plans.length <= MAX_PLANS) return [...plans]
  const order = [...plans].sort((a, b) => Number(isRunning(b)) - Number(isRunning(a)) || b.createdAt - a.createdAt)
  const keep = new Set(order.slice(0, MAX_PLANS).map((p) => p.id))
  return plans.filter((p) => keep.has(p.id))
}

/** Reads each plan on its own: one unreadable plan is dropped, never the rest. Two with one id: the first stays. */
const plansSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: KistPlan[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(planSchema, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      seen.add(parsed.data.id)
      read.push(tidy(parsed.data))
    }
    return capped(read)
  }),
)

export const kistSchema = z.object({ plans: z.catch(plansSchema, []) })

export const kistStore = createStore<KistState>({
  key: STORAGE_KEYS.kist,
  schema: kistSchema,
  initial: () => ({ plans: [] }),
  version: 1,
})

export function usePlans(): KistPlan[] {
  return useStore(kistStore, (state) => state.plans)
}

export function usePlan(planId: string | null | undefined): KistPlan | null {
  return useStore(kistStore, (state) => (planId ? (state.plans.find((p) => p.id === planId) ?? null) : null))
}

export function planById(planId: string): KistPlan | null {
  return kistStore.get().plans.find((p) => p.id === planId) ?? null
}

/** The plan still running with this friend, or null. One at a time keeps "which plan was that for?" from ever coming up. */
export function runningPlanWith(friendId: string, plans: readonly KistPlan[] = kistStore.get().plans): KistPlan | null {
  return plans.find((p) => p.friendId === friendId && isRunning(p)) ?? null
}

/** Adds a plan, or puts back one that was deleted (in its old place in time order). */
export function putPlan(plan: KistPlan): void {
  const parsed = z.safeParse(planSchema, plan)
  if (!parsed.success) return
  const state = kistStore.get()
  const rest = state.plans.filter((p) => p.id !== plan.id)
  const plans = [...rest, tidy(parsed.data)].sort((a, b) => a.createdAt - b.createdAt)
  kistStore.set({ ...state, plans: capped(plans) })
}

/** Swaps a plan for a changed copy of itself. Nothing happens when it is no longer there. */
export function replacePlan(plan: KistPlan): void {
  const state = kistStore.get()
  if (!state.plans.some((p) => p.id === plan.id)) return
  kistStore.set({ ...state, plans: state.plans.map((p) => (p.id === plan.id ? plan : p)) })
}

/** Deletes a plan (only the plan: payments already recorded stay). Returns it, for Undo. */
export function removePlan(planId: string): KistPlan | null {
  const state = kistStore.get()
  const plan = state.plans.find((p) => p.id === planId) ?? null
  if (!plan) return null
  kistStore.set({ ...state, plans: state.plans.filter((p) => p.id !== planId) })
  return plan
}
