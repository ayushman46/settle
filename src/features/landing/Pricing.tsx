import { ArrowRight, Check } from 'lucide-react'
import { Badge } from '../../components'
import { BRAND } from '../../domain/types'
import { cx } from '../../lib/cx'
import { useBillingConfig } from '../../pro/config'
import { CtaLink } from './CtaLink'
import { FREE_PERKS, pricingPlans, proPerks } from './pricingPlans'
import page from './LandingPage.module.css'
import styles from './Pricing.module.css'

function Perks({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.perks} role="list">
      {items.map((perk) => (
        <li key={perk} className={styles.perk}>
          <Check aria-hidden="true" className={styles.check} strokeWidth={3} />
          {perk}
        </li>
      ))}
    </ul>
  )
}

/** Free vs Pro, with the Pro passes the server is selling right now (or the launch prices). */
export function Pricing() {
  const config = useBillingConfig()
  const plans = pricingPlans(config)
  const checkoutLive = config?.checkout === 'razorpay'

  return (
    <section id="pricing" className={page.section} aria-labelledby="pricing-title">
      <div className={page.sectionHead}>
        <p className={page.eyebrow}>Pricing</p>
        <h2 id="pricing-title" className={page.h2}>
          Free for everyday splitting
        </h2>
        <p className={page.lede}>
          Go Pro for unlimited AI, recurring splits and insights. One-time passes — never auto-renewed.
        </p>
      </div>

      <div className={styles.grid}>
        <article className={styles.plan} aria-labelledby="plan-free">
          <h3 id="plan-free" className={styles.planName}>
            Free
          </h3>
          <p className={styles.price}>
            <span className={styles.amount}>₹0</span>
            <span className={styles.per}>forever</span>
          </p>
          <p className={styles.blurb}>Everything you need to split and get paid back.</p>
          <Perks items={FREE_PERKS} />
          <CtaLink to="/app" variant="secondary" block className={styles.cta}>
            Open {BRAND.name} — free
          </CtaLink>
        </article>

        <article className={cx(styles.plan, styles.pro)} aria-labelledby="plan-pro">
          <div className={styles.proHead}>
            <h3 id="plan-pro" className={styles.planName}>
              {BRAND.name} Pro
            </h3>
            <Badge tone="pro">Pro</Badge>
          </div>
          <ul className={styles.passes} role="list" aria-label="Pro passes">
            {plans.map((plan) => (
              <li key={plan.id} className={cx(styles.pass, plan.featured && styles.featured)}>
                <span className={styles.passMain}>
                  <span className={styles.passName}>
                    {plan.name}
                    {plan.badge && <Badge tone={plan.featured ? 'accent' : 'neutral'}>{plan.badge}</Badge>}
                  </span>
                  <span className={styles.passDetail}>
                    {[plan.detail, plan.perMonth, plan.savings].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.passPrice}>{plan.price}</span>
              </li>
            ))}
          </ul>
          <Perks items={proPerks(config)} />
          <CtaLink to="/app/pro" block iconEnd={<ArrowRight strokeWidth={2.25} />} className={styles.cta}>
            Get {BRAND.name} Pro
          </CtaLink>
          <p className={styles.fine}>
            One-time payment. No subscription, nothing to cancel.
            {checkoutLive && ' Pay with UPI or card, securely through Razorpay.'}
          </p>
        </article>
      </div>
    </section>
  )
}
