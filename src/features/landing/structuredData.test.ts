import { describe, expect, it } from 'vitest'
import { BRAND } from '../../domain/types'
import type { BillingConfig } from '../../pro/config'
import { FAQ } from './faqData'
import { landingStructuredData, LANDING_DESCRIPTION } from './structuredData'

interface Thing {
  '@type': string
  [key: string]: unknown
}

function parse(json: string): Thing[] {
  return JSON.parse(json) as Thing[]
}

describe('landingStructuredData', () => {
  it('describes the app with its free tier and every Pro pass', () => {
    const [app] = parse(landingStructuredData('https://settle.example', null))
    expect(app).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: BRAND.name,
      url: 'https://settle.example/',
      description: LANDING_DESCRIPTION,
      applicationCategory: 'FinanceApplication',
    })
    expect(app?.offers).toEqual([
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
      { '@type': 'Offer', name: `${BRAND.name} Pro — Monthly`, price: '49', priceCurrency: 'INR' },
      { '@type': 'Offer', name: `${BRAND.name} Pro — Yearly`, price: '399', priceCurrency: 'INR' },
      { '@type': 'Offer', name: `${BRAND.name} Pro — Lifetime`, price: '999', priceCurrency: 'INR' },
    ])
  })

  it('uses the server’s prices once known', () => {
    const config: BillingConfig = {
      checkout: null,
      keyId: null,
      currency: 'INR',
      plans: [{ id: 'pro_yearly', name: 'Yearly', amount: 44_950, currency: 'INR', days: 365, badge: null, savingsPercent: null }],
      licensePublicKey: null,
      proAiPerDay: 200,
    }
    const [app] = parse(landingStructuredData('https://settle.example', config))
    expect(app?.offers).toEqual([
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
      { '@type': 'Offer', name: `${BRAND.name} Pro — Yearly`, price: '449.5', priceCurrency: 'INR' },
    ])
  })

  it('carries the same questions and answers as the page', () => {
    const [, faq] = parse(landingStructuredData('', null))
    expect(faq?.['@type']).toBe('FAQPage')
    expect(faq?.mainEntity).toEqual(
      FAQ.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer.join(' ') },
      })),
    )
  })

  it('claims no ratings or reviews', () => {
    const json = landingStructuredData('https://settle.example', null)
    expect(json).not.toMatch(/"(aggregateRating|review|reviewCount|ratingValue)"/)
  })

  it('leaves the url out when the origin is unknown', () => {
    const [app] = parse(landingStructuredData('', null))
    expect(app).not.toHaveProperty('url')
  })

  it('can never close its <script> element early', () => {
    const json = landingStructuredData('https://x.example/</script><script>alert(1)</script>', null)
    expect(json).not.toContain('<')
    expect(parse(json)[0]?.url).toBe('https://x.example/</script><script>alert(1)</script>/')
  })
})
