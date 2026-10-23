/** Derived values for screens. Pure functions of the session. */
import type { CategoryId } from '../../shared/categories'
import { categoryFromText } from '../engine/categories'
import { t } from '../i18n'
import { currencyDigits } from '../lib/money'
import { validShares } from '../lib/split'
import { STEPS, type BillItem, type Minor, type Session, type StepId } from '../types'
import { isIsoDay } from './reducer'

export function itemsTotal(s: Session): Minor {
  let total = 0
  for (const item of s.items) total += item.amount
  return total
}

/** Σ of the bill's delivery-app fees (0 without any). */
export function feesTotal(s: Session): Minor {
  let total = 0
  for (const fee of s.meta.fees ?? []) total += fee.amount
  return total
}

/**
 * What the bill's own lines add up to: items + service charge + tax + delivery fees + tip −
 * discount. Used when no total was printed (or read), so known charges and discounts aren't
 * silently dropped.
 */
export function computedBillTotal(s: Session): Minor {
  const { serviceCharge, tax, tip, discount } = s.meta
  return itemsTotal(s) + (serviceCharge ?? 0) + (tax ?? 0) + feesTotal(s) + (tip ?? 0) - Math.abs(discount ?? 0)
}

/**
 * What we assume was paid until the user says otherwise: the printed bill total; without one, what
 * the bill's lines add up to (items plus any charges, less any discount); else just the items.
 */
export function defaultPaid(s: Session): Minor {
  const { total } = s.meta
  if (total !== null && total > 0) return total
  const computed = computedBillTotal(s)
  return computed > 0 ? computed : itemsTotal(s)
}

/** The amount being split. */
export function effectivePaid(s: Session): Minor {
  return s.paid ?? defaultPaid(s)
}

/**
 * The day the bill happened: the one picked, else the date printed on it when that reads as a
 * real day that isn't in the future, else `today` (YYYY-MM-DD).
 */
export function billDate(s: Session, today: string): string {
  if (s.date !== null) return s.date
  const printed = s.meta.date?.trim() ?? ''
  return isIsoDay(printed) && printed <= today ? printed : today
}

/** What the bill is for: the one picked (or the scan's guess), else what its name suggests, else food. */
export function billCategory(s: Session): CategoryId {
  return s.category ?? suggestedCategory(s)
}

/** What the bill's name suggests ("Blinkit" → groceries); a restaurant bill when it says nothing. */
export function suggestedCategory(s: Session): CategoryId {
  return categoryFromText(s.meta.merchant ?? '') ?? 'food'
}

/** True when someone (who still exists) is on the item. */
export function isAssigned(s: Session, itemId: string): boolean {
  return Object.keys(validShares(s.assignments[itemId], s.people)).length > 0
}

export function unassignedItems(s: Session): BillItem[] {
  return s.items.filter((item) => !isAssigned(s, item.id))
}

export function assignedCount(s: Session): number {
  return s.items.length - unassignedItems(s).length
}

/** Index of the first item nobody is on, or -1. */
export function firstUnassignedIndex(s: Session): number {
  return s.items.findIndex((item) => !isAssigned(s, item.id))
}

/** Whether the primary action on `step` may move on. */
export function canContinue(s: Session, step: StepId): boolean {
  switch (step) {
    case 'review':
      return s.items.length > 0 && s.items.every((item) => item.name.trim() !== '')
    case 'paid':
      return effectivePaid(s) > 0
    case 'people':
      return s.people.length >= 2
    case 'assign':
      return s.items.length > 0 && firstUnassignedIndex(s) === -1
    default:
      return true
  }
}

/** A bill with items is in progress (drives the "Continue" card on the home screen). */
export function hasProgress(s: Session): boolean {
  return s.items.length > 0
}

export function stepIndex(step: StepId): number {
  return STEPS.indexOf(step)
}

export function nextStep(step: StepId): StepId | null {
  return STEPS[stepIndex(step) + 1] ?? null
}

export function prevStep(step: StepId): StepId | null {
  const index = stepIndex(step)
  return index > 0 ? (STEPS[index - 1] ?? null) : null
}

/** TopBar progress: review…result are steps 1…5 of 5; the home screen has none. */
export function stepProgress(step: StepId): { current: number; total: number } | null {
  const index = stepIndex(step)
  return index > 0 ? { current: index, total: STEPS.length - 1 } : null
}

/**
 * The furthest step the data allows: a bill must exist for review, valid items for paid, an
 * amount for people, two people for assign/result. (Result tolerates unassigned items — it says
 * they were shared by everyone.)
 */
export function furthestReachableStep(s: Session): StepId {
  if (s.source === null && s.items.length === 0) return 'scan'
  if (!canContinue(s, 'review')) return 'review'
  if (!canContinue(s, 'paid')) return 'paid'
  if (!canContinue(s, 'people')) return 'people'
  return 'result'
}

/** `step`, or the furthest reachable step before it when the data doesn't allow it (yet). */
export function clampStep(s: Session, step: StepId): StepId {
  const cap = furthestReachableStep(s)
  return stepIndex(step) <= stepIndex(cap) ? step : cap
}

/**
 * Where "Continue" on the home screen goes: the furthest step visited (`furthest`) that the data
 * still allows, and at least the review step.
 */
export function resumeStep(s: Session, furthest: StepId = s.step): StepId {
  const target = clampStep(s, furthest)
  return stepIndex(target) >= 1 || !hasProgress(s) ? target : 'review'
}

/**
 * `roundoff`: a difference of less than one major unit (e.g. −₹0.24) that makes the printed total
 * add up. `other`: a bigger one ("Other charges" / "Other discounts"), a real charge or saving.
 */
export type BreakdownKind = 'items' | 'charge' | 'fee' | 'discount' | 'roundoff' | 'other' | 'total'

export interface BreakdownRow {
  /** `roundoff` keys the adjustment row whatever its kind (`roundoff` or `other`); fees are `fee:<id>`. */
  key: 'items' | 'serviceCharge' | 'tax' | 'tip' | 'discount' | 'roundoff' | 'total' | `fee:${string}`
  label: string
  /**
   * Signed contribution to the total: charges positive, the discount NEGATIVE. The rows above
   * `total` add up to it exactly. For `total` it is the bill total itself.
   */
  amount: Minor
  kind: BreakdownKind
}

/**
 * "What the bill says", for the paid screen: Items, Service charge, Tax, each fee, Tip, Discount (−),
 * Round-off / Other charges / Other discounts (whatever makes the printed total add up) and Bill
 * total. Without a printed total the last row is what the lines add up to ("Adds up to").
 * Zero/absent charges are left out.
 */
export function billBreakdown(s: Session): BreakdownRow[] {
  const { meta } = s
  const rows: BreakdownRow[] = [{ key: 'items', label: t('state.breakdown.items'), amount: itemsTotal(s), kind: 'items' }]

  const charges = [
    ['serviceCharge', t('state.breakdown.serviceCharge'), meta.serviceCharge],
    ['tax', t('state.breakdown.tax'), meta.tax],
    ['tip', t('state.breakdown.tip'), meta.tip],
  ] as const
  for (const [key, label, amount] of charges) {
    if (key === 'tip') for (const fee of meta.fees ?? []) rows.push({ key: `fee:${fee.id}`, label: fee.label, amount: fee.amount, kind: 'fee' })
    if (amount === null || amount === 0) continue
    rows.push({ key, label, amount, kind: 'charge' })
  }
  if (meta.discount !== null && meta.discount !== 0) {
    rows.push({ key: 'discount', label: t('state.breakdown.discount'), amount: -Math.abs(meta.discount), kind: 'discount' })
  }

  const computed = computedBillTotal(s)
  if (meta.total === null) {
    rows.push({ key: 'total', label: t('state.breakdown.addsUpTo'), amount: computed, kind: 'total' })
    return rows
  }

  const diff = meta.total - computed
  if (diff !== 0) {
    const roundOff = Math.abs(diff) < 10 ** currencyDigits(s.currency)
    const label = t(roundOff ? 'state.breakdown.roundOff' : diff > 0 ? 'state.breakdown.otherCharges' : 'state.breakdown.otherDiscounts')
    rows.push({ key: 'roundoff', label, amount: diff, kind: roundOff ? 'roundoff' : 'other' })
  }
  rows.push({ key: 'total', label: t('state.breakdown.total'), amount: meta.total, kind: 'total' })
  return rows
}
