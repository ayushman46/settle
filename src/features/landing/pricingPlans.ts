/** What the pricing table says, from the server's plans (or the built-in launch prices). */
import { BRAND, FREE_AI_PER_DAY, type PlanId } from '../../domain/types'
import { currencyDigits, formatMoney } from '../../lib/money'
import { FALLBACK_BILLING_CONFIG, planMonths, planPerMonth, type BillingConfig, type Plan } from '../../pro/config'

export interface PlanRow {
  id: PlanId
  name: string
  /** "₹399". */
  price: string
  /** "365 days", "Pay once, yours for good". */
  detail: string
  /** "About ₹33 a month" for passes longer than a month. */
  perMonth: string | null
  /** The server's highlight ("Best value"). */
  badge: string | null
  /** "Save 32%", straight from the server's honest maths. */
  savings: string | null
  /** The plan to draw the eye to (the yearly pass). */
  featured: boolean
}

const ORDER: readonly PlanId[] = ['pro_monthly', 'pro_yearly', 'pro_lifetime']

function price(plan: Plan): string {
  return formatMoney(plan.amount, plan.currency, { trimZeros: true })
}

/** "₹33" for ₹33.25: whole rupees read better after "About". */
function wholeUnits(minor: number, currency: string): string {
  const unit = 10 ** currencyDigits(currency)
  return formatMoney(Math.floor(minor / unit) * unit, currency, { trimZeros: true })
}

function duration(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365
    return years === 1 ? 'A full year' : `${years} years`
  }
  return days === 1 ? '1 day' : `${days} days`
}

/** The Pro passes in display order (monthly, yearly, lifetime), from `config` or the launch prices. */
export function pricingPlans(config: BillingConfig | null): PlanRow[] {
  const plans = [...(config ?? FALLBACK_BILLING_CONFIG).plans].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  return plans.map((plan) => {
    const months = planMonths(plan)
    const perMonth = planPerMonth(plan)
    return {
      id: plan.id,
      name: plan.name,
      price: price(plan),
      detail: plan.days === null ? 'Yours for good — it never expires' : duration(plan.days),
      perMonth: months !== null && months > 1 && perMonth !== null ? `About ${wholeUnits(perMonth, plan.currency)} a month` : null,
      badge: plan.badge,
      savings: plan.savingsPercent !== null ? `Save ${plan.savingsPercent}%` : null,
      featured: plan.id === 'pro_yearly',
    }
  })
}

/** The cheapest pass, for "Pro from ₹49" (null when there are no plans). */
export function cheapestPrice(config: BillingConfig | null): string | null {
  const plans = (config ?? FALLBACK_BILLING_CONFIG).plans
  if (plans.length === 0) return null
  const cheapest = plans.reduce((low, plan) => (plan.amount < low.amount ? plan : low))
  return price(cheapest)
}

export const FREE_PERKS: readonly string[] = [
  'Unlimited splits, groups and friends',
  'Pay links, UPI QR codes and the collect tracker',
  'Nudges on WhatsApp and SMS',
  `${FREE_AI_PER_DAY} AI bill reads or “Just say it” splits a day`,
  'Backup and restore, light and dark mode',
]

/** Pro's perks; the fair-use AI allowance comes from the server. */
export function proPerks(config: BillingConfig | null): string[] {
  const perDay = (config ?? FALLBACK_BILLING_CONFIG).proAiPerDay
  return [
    'Everything in Free',
    `Unlimited AI — fair use, up to ${perDay} a day`,
    'Recurring splits for rent, Wi-Fi and subscriptions',
    'Insights by category, month and friend',
    'CSV export and accent colours',
    `Share cards without the ${BRAND.name} footer`,
  ]
}
