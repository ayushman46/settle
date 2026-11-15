/**
 * What interest keeps on this phone, per loan (the loan itself is an ordinary udhaar expense): the
 * rate, the amount it started from, an optional date to pay it back by, and each payment recorded
 * on the loan's interest page with how it was divided. The principal part of a payment also goes
 * through the app's normal "paid back" path, so balances everywhere stay right; the interest part
 * lives only here.
 */
import { useMemo } from 'react'
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import type { Minor } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { isRate, MAX_RATE_BP, RATE_PERS, type Rate, type RatePer } from './engine'

export interface ByaajPayment {
  id: string
  /** The day the money changed hands (YYYY-MM-DD). */
  date: string
  /** The part that paid interest. */
  interest: Minor
  /** The part that came off the amount lent. */
  principal: Minor
  createdAt: number
  /** The "paid back" record the app made for the principal part of a part payment, when it made one. */
  repaidExpenseId: string | null
  /** The group payment the app recorded for the principal part, for a loan inside a group. */
  settlementId: string | null
}

export interface ByaajPlan {
  /** The loan: an expense of kind 'loan'. */
  expenseId: string
  bp: number
  per: RatePer
  /** The amount still lent when interest was added (interest runs on this from the loan's date). */
  principal: Minor
  /** Pay it back by (YYYY-MM-DD), or null. */
  dueOn: string | null
  payments: ByaajPayment[]
  createdAt: number
}

export interface ByaajState {
  /** Loan (expense id) → its interest. */
  plans: Record<string, ByaajPlan>
}

/** At most this many loans carry interest (the newest are kept). */
export const MAX_PLANS = 200
/** At most this many payments are kept on one loan. */
export const MAX_PAYMENTS = 400

const isoDay = z.string().check(z.refine(isIsoDate))
const money = z.int().check(z.gte(0), z.lte(MAX_MINOR))

const paymentSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(80)),
  date: isoDay,
  interest: money,
  principal: money,
  createdAt: z.catch(z.number(), 0),
  repaidExpenseId: z.catch(z.nullable(z.string().check(z.maxLength(80))), null),
  settlementId: z.catch(z.nullable(z.string().check(z.maxLength(80))), null),
})

/** Reads each payment on its own: one unreadable payment is dropped, never the loan. */
const paymentsSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: ByaajPayment[] = []
    for (const value of raw) {
      const parsed = z.safeParse(paymentSchema, value)
      if (parsed.success && parsed.data.interest + parsed.data.principal > 0) read.push(parsed.data)
    }
    return read.slice(-MAX_PAYMENTS)
  }),
)

const planSchema = z.object({
  expenseId: z.string().check(z.minLength(1), z.maxLength(80)),
  bp: z.int().check(z.gte(1), z.lte(MAX_RATE_BP)),
  per: z.enum(RATE_PERS),
  principal: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  dueOn: z.catch(z.nullable(isoDay), null),
  payments: z.catch(paymentsSchema, []),
  createdAt: z.catch(z.number(), 0),
})

/** Reads each loan's interest on its own: one unreadable entry is dropped, never the rest. */
const plansSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: ByaajPlan[] = []
    for (const [expenseId, value] of Object.entries(raw)) {
      const parsed = z.safeParse(planSchema, value)
      if (parsed.success && parsed.data.expenseId === expenseId) read.push(parsed.data)
    }
    read.sort((a, b) => b.createdAt - a.createdAt)
    return Object.fromEntries(read.slice(0, MAX_PLANS).map((plan) => [plan.expenseId, plan])) as Record<string, ByaajPlan>
  }),
)

export const byaajSchema = z.object({ plans: z.catch(plansSchema, {}) })

export const byaajStore = createStore<ByaajState>({
  key: STORAGE_KEYS.byaaj,
  schema: byaajSchema,
  initial: () => ({ plans: {} }),
  version: 1,
})

const NO_PLANS: readonly ByaajPlan[] = []

function listPlans(state: ByaajState): readonly ByaajPlan[] {
  const plans = Object.values(state.plans)
  return plans.length === 0 ? NO_PLANS : plans
}

/** The loan's interest, or null when it has none. */
export function useByaajPlan(expenseId: string): ByaajPlan | null {
  return useStore(byaajStore, (state) => (Object.hasOwn(state.plans, expenseId) ? (state.plans[expenseId] ?? null) : null))
}

const wholeState = (state: ByaajState): ByaajState => state

/** Every loan with interest (in no particular order). */
export function useByaajPlans(): readonly ByaajPlan[] {
  const state = useStore(byaajStore, wholeState)
  return useMemo(() => listPlans(state), [state])
}

export function byaajPlanFor(expenseId: string): ByaajPlan | null {
  const plans = byaajStore.get().plans
  return Object.hasOwn(plans, expenseId) ? (plans[expenseId] ?? null) : null
}

function writePlan(plan: ByaajPlan | null, expenseId: string): void {
  const state = byaajStore.get()
  const plans = { ...state.plans }
  delete plans[expenseId]
  if (plan) {
    plans[expenseId] = plan
    const entries = Object.values(plans)
    if (entries.length > MAX_PLANS) {
      entries.sort((a, b) => b.createdAt - a.createdAt)
      byaajStore.set({ ...state, plans: Object.fromEntries(entries.slice(0, MAX_PLANS).map((p) => [p.expenseId, p])) })
      return
    }
  }
  byaajStore.set({ ...state, plans })
}

const NOTHING = (): void => undefined

/**
 * Adds interest to a loan (or replaces it). Returns an undo that puts back exactly what was there
 * before (nothing, or the earlier rate with its payments). Ignores a rate or an amount that can't be kept.
 */
export function setByaaj(expenseId: string, input: { rate: Rate; principal: Minor; dueOn?: string | null; now: number }): () => void {
  if (expenseId === '' || !isRate(input.rate) || !Number.isSafeInteger(input.principal) || input.principal <= 0 || input.principal > MAX_MINOR) return NOTHING
  const before = byaajPlanFor(expenseId)
  writePlan(
    {
      expenseId,
      bp: input.rate.bp,
      per: input.rate.per,
      principal: input.principal,
      dueOn: input.dueOn && isIsoDate(input.dueOn) ? input.dueOn : null,
      payments: before?.payments ?? [],
      createdAt: before?.createdAt ?? input.now,
    },
    expenseId,
  )
  return () => writePlan(before, expenseId)
}

/** Changes the rate (interest is then counted at the new rate from the loan's date). Returns an undo. */
export function setByaajRate(expenseId: string, rate: Rate): () => void {
  const plan = byaajPlanFor(expenseId)
  if (!plan || !isRate(rate) || (plan.bp === rate.bp && plan.per === rate.per)) return NOTHING
  writePlan({ ...plan, bp: rate.bp, per: rate.per }, expenseId)
  return () => {
    const now = byaajPlanFor(expenseId)
    if (now) writePlan({ ...now, bp: plan.bp, per: plan.per }, expenseId)
  }
}

/** Sets or clears the day to pay it back by. Returns an undo. */
export function setByaajDueOn(expenseId: string, dueOn: string | null): () => void {
  const plan = byaajPlanFor(expenseId)
  const next = dueOn && isIsoDate(dueOn) ? dueOn : null
  if (!plan || plan.dueOn === next) return NOTHING
  writePlan({ ...plan, dueOn: next }, expenseId)
  return () => {
    const now = byaajPlanFor(expenseId)
    if (now) writePlan({ ...now, dueOn: plan.dueOn }, expenseId)
  }
}

/** Takes interest off a loan (the loan and what was paid back on it stay as they are). Returns an undo that puts it back, payments and all. */
export function removeByaaj(expenseId: string): () => void {
  const plan = byaajPlanFor(expenseId)
  if (!plan) return NOTHING
  writePlan(null, expenseId)
  return () => {
    if (!byaajPlanFor(expenseId)) writePlan(plan, expenseId)
  }
}

/** Writes a payment down on the loan. False when the loan has no interest or the payment is empty. */
export function addByaajPayment(expenseId: string, payment: ByaajPayment): boolean {
  const plan = byaajPlanFor(expenseId)
  const parsed = z.safeParse(paymentSchema, payment)
  if (!plan || !parsed.success || parsed.data.interest + parsed.data.principal <= 0) return false
  writePlan({ ...plan, payments: [...plan.payments.filter((p) => p.id !== payment.id), parsed.data].slice(-MAX_PAYMENTS) }, expenseId)
  return true
}

/** Takes one payment off the loan again (for Undo). */
export function removeByaajPayment(expenseId: string, paymentId: string): void {
  const plan = byaajPlanFor(expenseId)
  if (!plan || !plan.payments.some((p) => p.id === paymentId)) return
  writePlan({ ...plan, payments: plan.payments.filter((p) => p.id !== paymentId) }, expenseId)
}
