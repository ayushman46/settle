import { describe, expect, it } from 'vitest'
import type { Plan } from '../../../shared/api'
import { FALLBACK_BILLING_CONFIG, type BillingConfig } from '../../pro'
import {
  checkoutLabel,
  checkoutNote,
  cheapestPrice,
  daysLeft,
  defaultPlanId,
  endsInLabel,
  passSummary,
  planOptions,
  savingsAgainstMonthly,
} from './plans'

const [MONTHLY, YEARLY, LIFETIME] = FALLBACK_BILLING_CONFIG.plans as [Plan, Plan, Plan]

function config(plans: Plan[]): BillingConfig {
  return { ...FALLBACK_BILLING_CONFIG, plans }
}

describe('planOptions', () => {
  it('shows the launch passes in order with honest maths', () => {
    const options = planOptions(FALLBACK_BILLING_CONFIG)
    expect(options.map((o) => o.id)).toEqual(['pro_monthly', 'pro_yearly', 'pro_lifetime'])
    expect(options[0]).toMatchObject({ name: 'Monthly', price: '₹49', term: '30 days', perMonth: null, savingsPercent: null, lifetime: false })
    // 12 × ₹49 = ₹588; ₹399 saves ₹189 → 32.1% → 32 (rounded down).
    expect(options[1]).toMatchObject({ name: 'Yearly', price: '₹399', term: '1 year', perMonth: 'About ₹33 a month', savingsPercent: 32, badge: 'Best value' })
    expect(options[2]).toMatchObject({ name: 'Lifetime', price: '₹999', term: 'Yours for good', perMonth: null, savingsPercent: null, lifetime: true })
  })

  it('sorts passes the server sends in any order', () => {
    expect(planOptions(config([LIFETIME, MONTHLY, YEARLY])).map((o) => o.id)).toEqual(['pro_monthly', 'pro_yearly', 'pro_lifetime'])
  })

  it('works the saving out from the prices, not the server’s claim', () => {
    const generous = { ...YEARLY, savingsPercent: 60 }
    expect(planOptions(config([MONTHLY, generous]))[1]?.savingsPercent).toBe(32)
  })

  it('falls back to the server’s figure when there is no monthly pass to compare with', () => {
    expect(planOptions(config([YEARLY, LIFETIME]))[0]?.savingsPercent).toBe(32)
  })

  it('says nothing about savings when a longer pass costs more than monthly ones', () => {
    const pricey = { ...YEARLY, amount: 70000 }
    expect(planOptions(config([MONTHLY, pricey]))[1]?.savingsPercent).toBeNull()
  })

  it('names multi-year and odd-length passes plainly', () => {
    const twoYears: Plan = { ...YEARLY, days: 730, amount: 69900 }
    const week: Plan = { ...MONTHLY, days: 7, amount: 1900 }
    expect(planOptions(config([twoYears]))[0]?.term).toBe('2 years')
    expect(planOptions(config([week]))[0]?.term).toBe('7 days')
  })
})

describe('savingsAgainstMonthly', () => {
  it('compares against monthly passes for the same months', () => {
    expect(savingsAgainstMonthly(YEARLY, MONTHLY)).toBe(32)
  })

  it('has no saving for the monthly pass itself, lifetime, or without a monthly price', () => {
    expect(savingsAgainstMonthly(MONTHLY, MONTHLY)).toBeNull()
    expect(savingsAgainstMonthly(LIFETIME, MONTHLY)).toBeNull()
    expect(savingsAgainstMonthly(YEARLY, null)).toBeNull()
  })

  it('never rounds a saving up', () => {
    // 12 × 100 = 1200; 1195 saves 5 → 0.41% → no claim at all.
    expect(savingsAgainstMonthly({ ...YEARLY, amount: 1195 }, { ...MONTHLY, amount: 100 })).toBeNull()
    // 1189 saves 11 → 0.9% → still nothing.
    expect(savingsAgainstMonthly({ ...YEARLY, amount: 1189 }, { ...MONTHLY, amount: 100 })).toBeNull()
    // 1080 saves 120 → exactly 10%.
    expect(savingsAgainstMonthly({ ...YEARLY, amount: 1080 }, { ...MONTHLY, amount: 100 })).toBe(10)
  })
})

describe('defaultPlanId', () => {
  const options = planOptions(FALLBACK_BILLING_CONFIG)

  it('picks the yearly pass first', () => {
    expect(defaultPlanId(options)).toBe('pro_yearly')
  })

  it('honours a preferred pass that is on sale', () => {
    expect(defaultPlanId(options, 'pro_lifetime')).toBe('pro_lifetime')
  })

  it('falls back to the first pass, or nothing', () => {
    expect(defaultPlanId(planOptions(config([LIFETIME, MONTHLY])))).toBe('pro_monthly')
    expect(defaultPlanId([])).toBeNull()
  })
})

describe('labels', () => {
  it('names the cheapest pass', () => {
    expect(cheapestPrice(FALLBACK_BILLING_CONFIG)).toBe('₹49')
    expect(cheapestPrice(null)).toBeNull()
    expect(cheapestPrice(config([]))).toBeNull()
  })

  it('writes the buy button and its small print', () => {
    const [monthly, yearly, lifetime] = planOptions(FALLBACK_BILLING_CONFIG)
    expect(checkoutLabel(yearly!)).toBe('Get Pro — ₹399')
    expect(checkoutNote(monthly!)).toBe('One-time payment · 30 days · nothing renews')
    expect(checkoutNote(lifetime!)).toBe('One-time payment · Pro for good')
  })

  it('sums up the pass on this phone', () => {
    expect(passSummary({ id: 'x', plan: 'pro_lifetime', iat: 0, exp: null })).toBe('Lifetime pass · yours for good')
    const exp = Date.UTC(2027, 9, 22, 12) / 1000
    expect(passSummary({ id: 'x', plan: 'pro_yearly', iat: 0, exp })).toMatch(/^Yearly pass · until .*2027$/)
  })

  it('counts calendar days left', () => {
    const now = new Date(2026, 9, 22, 21, 0).getTime()
    expect(daysLeft(new Date(2026, 9, 22, 23, 0).getTime(), now)).toBe(0)
    expect(daysLeft(new Date(2026, 9, 23, 1, 0).getTime(), now)).toBe(1)
    expect(endsInLabel(new Date(2026, 9, 22, 23, 0).getTime(), now)).toBe('Ends today')
    expect(endsInLabel(new Date(2026, 9, 23, 1, 0).getTime(), now)).toBe('Ends tomorrow')
    expect(endsInLabel(new Date(2026, 10, 3, 9, 0).getTime(), now)).toBe('Ends in 12 days')
    expect(endsInLabel(new Date(2026, 9, 22, 20, 0).getTime(), now)).toBe('Ended')
  })
})
