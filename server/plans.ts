/**
 * Settle Pro plans: one-time passes priced in paise. Prices come from `PRO_PRICES`; the
 * copy and the savings figure are worked out here so every client shows the same honest numbers.
 */
import { PLAN_IDS, type Plan, type PlanId } from '../shared/api'

export const DEFAULT_PRICES: Readonly<Record<PlanId, number>> = {
  pro_monthly: 4900,
  pro_yearly: 39900,
  pro_lifetime: 99900,
}

/** How long each pass lasts; null = forever. */
export const PLAN_DAYS: Readonly<Record<PlanId, number | null>> = {
  pro_monthly: 30,
  pro_yearly: 365,
  pro_lifetime: null,
}

const PLAN_NAMES: Readonly<Record<PlanId, string>> = {
  pro_monthly: 'Monthly',
  pro_yearly: 'Yearly',
  pro_lifetime: 'Lifetime',
}

/** Razorpay's smallest order is ₹1; anything over ₹1,00,000 for an app pass is a typo. */
const MIN_PRICE = 100
const MAX_PRICE = 10_000_000

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value)
}

/**
 * Reads `PRO_PRICES` ("pro_monthly=4900,pro_yearly=39900,pro_lifetime=99900", paise). Plans it
 * doesn't mention, and values that aren't whole paise in range, keep their defaults.
 * @returns the prices, plus a note for the operator about every entry that was ignored.
 */
export function parsePrices(raw: string | undefined): { prices: Record<PlanId, number>; problems: string[] } {
  const prices: Record<PlanId, number> = { ...DEFAULT_PRICES }
  const problems: string[] = []
  for (const entry of (raw ?? '').split(/[,;\n]+/).map((part) => part.trim())) {
    if (entry === '') continue
    const [key = '', value = ''] = entry.split('=', 2).map((part) => part.trim())
    const plan = key.toLowerCase()
    const amount = Number(value.replace(/_/g, ''))
    if (!isPlanId(plan)) problems.push(`PRO_PRICES: unknown plan "${key}" (use ${PLAN_IDS.join(', ')}).`)
    else if (!/^\d[\d_]*$/.test(value) || !Number.isSafeInteger(amount) || amount < MIN_PRICE || amount > MAX_PRICE) {
      problems.push(`PRO_PRICES: ${plan}=${value} isn't a price in paise between ${MIN_PRICE} and ${MAX_PRICE}; using ${DEFAULT_PRICES[plan]}.`)
    } else prices[plan] = amount
  }
  return { prices, problems }
}

/** Whole percent saved by the yearly pass against twelve monthly ones, rounded down (never overstated). */
export function yearlySavingsPercent(prices: Readonly<Record<PlanId, number>>): number | null {
  const twelveMonths = prices.pro_monthly * 12
  if (twelveMonths <= 0 || prices.pro_yearly >= twelveMonths) return null
  const percent = Math.floor(((twelveMonths - prices.pro_yearly) / twelveMonths) * 100)
  return percent >= 1 ? percent : null
}

/** The plan cards, in display order. */
export function buildPlans(prices: Readonly<Record<PlanId, number>>): Plan[] {
  const savings = yearlySavingsPercent(prices)
  return PLAN_IDS.map((id) => ({
    id,
    name: PLAN_NAMES[id],
    amount: prices[id],
    currency: 'INR',
    days: PLAN_DAYS[id],
    badge: id === 'pro_yearly' && savings !== null ? 'Best value' : id === 'pro_lifetime' ? 'Pay once' : null,
    savingsPercent: id === 'pro_yearly' ? savings : null,
  }))
}
