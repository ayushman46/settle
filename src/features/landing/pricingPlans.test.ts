import { describe, expect, it } from 'vitest'
import { FREE_AI_PER_DAY } from '../../domain/types'
import { FALLBACK_BILLING_CONFIG, type BillingConfig } from '../../pro/config'
import { cheapestPrice, FREE_PERKS, pricingPlans, proPerks } from './pricingPlans'

const SERVER: BillingConfig = {
  checkout: 'razorpay',
  keyId: 'rzp_test_1',
  currency: 'INR',
  plans: [
    { id: 'pro_lifetime', name: 'Forever', amount: 149_900, currency: 'INR', days: null, badge: null, savingsPercent: null },
    { id: 'pro_yearly', name: 'Yearly', amount: 49_900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 29 },
    { id: 'pro_monthly', name: 'Monthly', amount: 5_900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
  ],
  licensePublicKey: null,
  proAiPerDay: 150,
}

describe('pricingPlans', () => {
  it('shows the launch prices until the server answers', () => {
    const rows = pricingPlans(null)
    expect(rows.map((r) => [r.id, r.price])).toEqual([
      ['pro_monthly', '₹49'],
      ['pro_yearly', '₹399'],
      ['pro_lifetime', '₹999'],
    ])
  })

  it('describes each pass honestly', () => {
    const [monthly, yearly, lifetime] = pricingPlans(FALLBACK_BILLING_CONFIG)
    expect(monthly).toMatchObject({ detail: '30 days', perMonth: null, savings: null, featured: false })
    // ₹399 / 12 = ₹33.25 a month; 12 × ₹49 = ₹588, so ₹399 saves 32%.
    expect(yearly).toMatchObject({
      detail: 'A full year',
      perMonth: 'About ₹33 a month',
      savings: 'Save 32%',
      badge: 'Best value',
      featured: true,
    })
    expect(lifetime).toMatchObject({ detail: 'Yours for good — it never expires', perMonth: null, badge: 'Pay once' })
  })

  it('follows the server: its prices, names and savings, in monthly → yearly → lifetime order', () => {
    const rows = pricingPlans(SERVER)
    expect(rows.map((r) => r.id)).toEqual(['pro_monthly', 'pro_yearly', 'pro_lifetime'])
    expect(rows.map((r) => r.price)).toEqual(['₹59', '₹499', '₹1,499'])
    expect(rows[1]).toMatchObject({ savings: 'Save 29%', perMonth: 'About ₹41 a month' })
    expect(rows[2]?.name).toBe('Forever')
  })

  it('names multi-year and odd-length passes plainly', () => {
    const config: BillingConfig = {
      ...SERVER,
      plans: [
        { id: 'pro_monthly', name: 'Week', amount: 1_900, currency: 'INR', days: 7, badge: null, savingsPercent: null },
        { id: 'pro_yearly', name: 'Two years', amount: 69_900, currency: 'INR', days: 730, badge: null, savingsPercent: null },
      ],
    }
    expect(pricingPlans(config).map((r) => r.detail)).toEqual(['7 days', '2 years'])
  })

  it('finds the cheapest pass', () => {
    expect(cheapestPrice(null)).toBe('₹49')
    expect(cheapestPrice(SERVER)).toBe('₹59')
    expect(cheapestPrice({ ...SERVER, plans: [] })).toBeNull()
  })
})

describe('perks', () => {
  it('states the free AI allowance from the product constant', () => {
    expect(FREE_PERKS.some((p) => p.startsWith(`${FREE_AI_PER_DAY} AI`))).toBe(true)
  })

  it('states Pro’s fair-use AI limit from the server', () => {
    expect(proPerks(null)).toContain(`Unlimited AI — fair use, up to ${FALLBACK_BILLING_CONFIG.proAiPerDay} a day`)
    expect(proPerks(SERVER)).toContain('Unlimited AI — fair use, up to 150 a day')
    expect(proPerks(SERVER)[0]).toBe('Everything in Free')
  })
})
