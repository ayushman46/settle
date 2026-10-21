import { describe, expect, it } from 'vitest'
import { buildPlans, DEFAULT_PRICES, isPlanId, parsePrices, PLAN_DAYS, yearlySavingsPercent } from './plans'

describe('parsePrices', () => {
  it('defaults to ₹49 / ₹399 / ₹999', () => {
    expect(parsePrices(undefined)).toEqual({ prices: { pro_monthly: 4900, pro_yearly: 39900, pro_lifetime: 99900 }, problems: [] })
    expect(parsePrices('')).toEqual({ prices: DEFAULT_PRICES, problems: [] })
  })

  it('reads overrides in paise, in any order and spacing, keeping the rest', () => {
    expect(parsePrices(' pro_lifetime=149900 ;PRO_MONTHLY = 9_900').prices).toEqual({ pro_monthly: 9900, pro_yearly: 39900, pro_lifetime: 149900 })
  })

  it('ignores unknown plans and impossible prices, saying why', () => {
    const { prices, problems } = parsePrices('pro_weekly=900,pro_monthly=49.5,pro_yearly=50,pro_lifetime=-1,junk')
    expect(prices).toEqual(DEFAULT_PRICES)
    expect(problems).toHaveLength(5)
    expect(problems[0]).toContain('unknown plan "pro_weekly"')
    expect(problems[1]).toContain('pro_monthly=49.5')
  })
})

describe('yearlySavingsPercent', () => {
  it('compares the yearly pass with twelve monthly ones, rounding down', () => {
    // 12 × 49 = 588 → 399 saves 32.1%
    expect(yearlySavingsPercent(DEFAULT_PRICES)).toBe(32)
    expect(yearlySavingsPercent({ ...DEFAULT_PRICES, pro_yearly: 58_799 })).toBe(null) // saves 0.002%
    expect(yearlySavingsPercent({ ...DEFAULT_PRICES, pro_yearly: 58_800 })).toBe(null)
    expect(yearlySavingsPercent({ ...DEFAULT_PRICES, pro_yearly: 70_000 })).toBe(null)
    expect(yearlySavingsPercent({ ...DEFAULT_PRICES, pro_monthly: 10_000, pro_yearly: 60_000 })).toBe(50)
  })
})

describe('buildPlans', () => {
  it('lists the three one-time passes with honest copy', () => {
    expect(buildPlans(DEFAULT_PRICES)).toEqual([
      { id: 'pro_monthly', name: 'Monthly', amount: 4900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
      { id: 'pro_yearly', name: 'Yearly', amount: 39900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 32 },
      { id: 'pro_lifetime', name: 'Lifetime', amount: 99900, currency: 'INR', days: null, badge: 'Pay once', savingsPercent: null },
    ])
  })

  it('drops "Best value" when yearly saves nothing', () => {
    const yearly = buildPlans({ ...DEFAULT_PRICES, pro_yearly: 60_000 })[1]
    expect(yearly).toMatchObject({ badge: null, savingsPercent: null })
  })
})

describe('plan ids and lengths', () => {
  it('knows the three plans', () => {
    expect(['pro_monthly', 'pro_yearly', 'pro_lifetime'].every(isPlanId)).toBe(true)
    for (const value of ['pro', 'PRO_MONTHLY', '', null, 1]) expect(isPlanId(value)).toBe(false)
    expect(PLAN_DAYS).toEqual({ pro_monthly: 30, pro_yearly: 365, pro_lifetime: null })
  })
})
