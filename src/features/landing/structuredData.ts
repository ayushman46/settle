/**
 * schema.org data for search engines: what Settle is, what it costs, and the FAQ — built from the
 * same plans and answers the page shows. No ratings or review counts: we don't have any to claim.
 */
import { BRAND } from '../../domain/types'
import { fromMinor } from '../../lib/money'
import { FALLBACK_BILLING_CONFIG, type BillingConfig } from '../../pro/config'
import { FAQ } from './faqData'

export const LANDING_DESCRIPTION = `${BRAND.name} splits any expense — restaurant bills (AI reads the photo), rent, trips, flatmates and subscriptions — and gets you paid back by UPI with one link. Free, no sign-up, private by default.`

/** The JSON-LD for the landing page, safe to put inside a `<script>` element. */
export function landingStructuredData(origin: string, config: BillingConfig | null): string {
  const plans = (config ?? FALLBACK_BILLING_CONFIG).plans
  const url = origin ? `${origin}/` : undefined
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: BRAND.name,
    alternateName: BRAND.tagline,
    description: LANDING_DESCRIPTION,
    ...(url ? { url } : {}),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any — runs in the browser',
    browserRequirements: 'Requires JavaScript',
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
      ...plans.map((plan) => ({
        '@type': 'Offer',
        name: `${BRAND.name} Pro — ${plan.name}`,
        price: String(fromMinor(plan.amount, plan.currency)),
        priceCurrency: plan.currency,
      })),
    ],
  }
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer.join(' ') },
    })),
  }
  // "<" can't appear raw inside a script element ("</script>"); < is the same JSON.
  return JSON.stringify([app, faq]).replace(/</g, '\\u003c')
}
