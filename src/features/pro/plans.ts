/**
 * What the paywall says about each Pro pass and about the pass on this device — worked out from
 * the real prices, so every saving is honest ("Save 32%" means 32% less than monthly passes for
 * the same time, rounded down) and nothing ever says "subscription".
 */
import type { License, PlanId } from '../../domain/types'
import { daysBetween, toIsoDate } from '../../engine/dates'
import { currencyDigits, formatMoney } from '../../lib/money'
import { planMonths, planPerMonth, type BillingConfig, type Plan } from '../../pro'

export interface PlanOption {
  id: PlanId
  /** "Yearly". */
  name: string
  /** "₹399". */
  price: string
  /** Minor units (paise). */
  amount: number
  currency: Plan['currency']
  /** "30 days", "1 year", "Yours for good". */
  term: string
  /** "About ₹33 a month" — only for passes longer than a month. */
  perMonth: string | null
  /** Whole percent saved against monthly passes for the same time (rounded down); null when none. */
  savingsPercent: number | null
  /** The server's highlight ("Best value", "Pay once"). */
  badge: string | null
  /** Never runs out. */
  lifetime: boolean
}

/** Display order: monthly, yearly, lifetime. */
const ORDER: readonly PlanId[] = ['pro_monthly', 'pro_yearly', 'pro_lifetime']

/** The pass the paywall picks first: the yearly one (best value for most people). */
export const PREFERRED_PLAN: PlanId = 'pro_yearly'

/** Names for a license's plan when the price list isn't to hand. */
export const PLAN_NAMES: Readonly<Record<PlanId, string>> = {
  pro_monthly: 'Monthly',
  pro_yearly: 'Yearly',
  pro_lifetime: 'Lifetime',
}

export function priceLabel(amount: number, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/** Rounds down to whole rupees (or the currency's unit) — "about ₹33", never "about ₹33.25". */
function wholeUnitsDown(amount: number, currency: string): number {
  const unit = 10 ** currencyDigits(currency)
  const whole = Math.floor(amount / unit) * unit
  return whole > 0 ? whole : amount
}

function termLabel(days: number | null): string {
  if (days === null) return 'Yours for good'
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? '1 year' : `${years} years`
  }
  return days === 1 ? '1 day' : `${days} days`
}

/**
 * Percent saved by `plan` against buying `monthly` passes for the same number of months,
 * rounded down so it's never overstated; null when it saves nothing (or can't be compared).
 */
export function savingsAgainstMonthly(plan: Plan, monthly: Plan | null): number | null {
  const months = planMonths(plan)
  if (!monthly || monthly.id === plan.id || months === null || months <= 1 || monthly.amount <= 0) return null
  const atMonthly = monthly.amount * months
  if (plan.amount >= atMonthly) return null
  const percent = Math.floor(((atMonthly - plan.amount) * 100) / atMonthly)
  return percent > 0 ? percent : null
}

/** The passes on sale, in display order, ready to show. */
export function planOptions(config: BillingConfig): PlanOption[] {
  const monthly = config.plans.find((p) => p.id === 'pro_monthly') ?? null
  return [...config.plans]
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
    .map((plan) => {
      const months = planMonths(plan)
      const perMonth = planPerMonth(plan)
      return {
        id: plan.id,
        name: plan.name,
        price: priceLabel(plan.amount, plan.currency),
        amount: plan.amount,
        currency: plan.currency,
        term: termLabel(plan.days),
        perMonth:
          months !== null && months > 1 && perMonth !== null
            ? `About ${priceLabel(wholeUnitsDown(perMonth, plan.currency), plan.currency)} a month`
            : null,
        // From the actual prices when there's a monthly pass to compare with; else the server's figure.
        savingsPercent: monthly ? savingsAgainstMonthly(plan, monthly) : plan.savingsPercent,
        badge: plan.badge,
        lifetime: plan.days === null,
      }
    })
}

/** The pass to pick first: `preferred` when it's on sale, else the yearly pass, else the first. */
export function defaultPlanId(options: readonly PlanOption[], preferred: PlanId | null = null): PlanId | null {
  if (preferred && options.some((o) => o.id === preferred)) return preferred
  return (options.find((o) => o.id === PREFERRED_PLAN) ?? options[0])?.id ?? null
}

/** The cheapest pass's price ("₹49") for "Pro from ₹49", or null when nothing is on sale. */
export function cheapestPrice(config: BillingConfig | null): string | null {
  const plans = config?.plans ?? []
  if (plans.length === 0) return null
  const cheapest = plans.reduce((low, plan) => (plan.amount < low.amount ? plan : low))
  return priceLabel(cheapest.amount, cheapest.currency)
}

/** What a screen reader says for a pass: "Yearly, ₹399 for 1 year, about ₹33 a month, save 32%, Best value". */
export function planSpokenLabel(option: PlanOption): string {
  const parts = [option.name, option.lifetime ? `${option.price}, ${option.term.toLowerCase()}` : `${option.price} for ${option.term}`]
  if (option.perMonth) parts.push(option.perMonth.charAt(0).toLowerCase() + option.perMonth.slice(1))
  if (option.savingsPercent !== null) parts.push(`save ${option.savingsPercent}%`)
  if (option.badge) parts.push(option.badge)
  return parts.join(', ')
}

/** The buy button: "Get Pro — ₹399". */
export function checkoutLabel(option: PlanOption): string {
  return `Get Pro — ${option.price}`
}

/** The small print under the buy button. */
export function checkoutNote(option: PlanOption): string {
  return option.lifetime ? 'One-time payment · Pro for good' : `One-time payment · ${option.term} · nothing renews`
}

/* ------------------------------------------------------------------ the pass on this device */

function dateFormatter(): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

const DATE = dateFormatter()

/** "22 Oct 2027" (in the person's locale) for an epoch-ms instant. */
export function passDate(epochMs: number): string {
  const date = new Date(epochMs)
  return DATE ? DATE.format(date) : date.toISOString().slice(0, 10)
}

/** Calendar days from `now` to `expiresAt` (epoch ms, local dates): 0 = today; negative once it's a past day. */
export function daysLeft(expiresAt: number, now: number = Date.now()): number {
  return daysBetween(toIsoDate(new Date(now)), toIsoDate(new Date(expiresAt)))
}

/** "Yearly pass · until 22 Oct 2027", "Lifetime pass · yours for good". */
export function passSummary(license: License): string {
  const name = PLAN_NAMES[license.plan]
  if (license.exp === null) return `${name} pass · yours for good`
  return `${name} pass · until ${passDate(license.exp * 1000)}`
}

/** "Ends today", "Ends tomorrow", "Ends in 12 days"; "Ended" once it has run out. */
export function endsInLabel(expiresAt: number, now: number = Date.now()): string {
  if (expiresAt <= now) return 'Ended'
  const days = daysLeft(expiresAt, now)
  if (days <= 0) return 'Ends today'
  if (days === 1) return 'Ends tomorrow'
  return `Ends in ${days} days`
}
