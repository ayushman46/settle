import { BadgeCheck, CreditCard, ShieldCheck } from 'lucide-react'
import { Banner, Button } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { checkoutLabel } from './plans'
import type { ProOffer } from './useProOffer'
import styles from './OfferParts.module.css'

/** Why a pass can't be bought right now (checkout off, or the last try failed), if it can't. */
export function CheckoutNotice({ offer, onRedeem }: { offer: ProOffer; onRedeem: () => void }) {
  const t = useT()
  if (offer.checkoutOff) {
    return (
      <Banner tone="info" title={t('pro.checkout.off.title')} action={{ label: t('pro.redeem.cta'), onAction: onRedeem }}>
        {t('pro.checkout.off.body')}
      </Banner>
    )
  }
  const { phase } = offer.checkout
  if (phase.kind === 'failed') {
    return (
      <Banner tone="error" onDismiss={offer.checkout.reset}>
        {phase.message}
      </Banner>
    )
  }
  return null
}

export interface BuyButtonProps {
  offer: ProOffer
  /** Opens "Redeem a code" — the main action while checkout is off. */
  onRedeem: () => void
  className?: string
}

/** "Get Pro — ₹399" for the picked pass; "Redeem a code" while checkout isn't set up. */
export function BuyButton({ offer, onRedeem, className }: BuyButtonProps) {
  const t = useT()
  const { selected, checkout, checkoutOff } = offer
  if (checkoutOff) {
    return (
      <Button block className={className} onClick={onRedeem}>
        {t('pro.redeem.cta')}
      </Button>
    )
  }
  const busy = checkout.phase.kind === 'busy'
  return (
    <Button
      block
      className={className}
      loading={busy}
      disabled={!selected}
      onClick={() => {
        if (selected) void checkout.buy(selected.id)
      }}
    >
      {selected ? checkoutLabel(selected) : t('pro.checkout.cta.noPlan')}
    </Button>
  )
}

/** Three plain promises under the plans. */
export function TrustRow({ className }: { className?: string }) {
  const t = useT()
  return (
    <ul role="list" className={cx(styles.trust, className)} aria-label={t('pro.trust.aria')}>
      <li className={styles.trustItem}>
        <BadgeCheck aria-hidden="true" />
        {t('pro.trust.once')}
      </li>
      <li className={styles.trustItem}>
        <ShieldCheck aria-hidden="true" />
        {t('pro.trust.noAccount')}
      </li>
      <li className={styles.trustItem}>
        <CreditCard aria-hidden="true" />
        {t('pro.trust.methods')}
      </li>
    </ul>
  )
}
