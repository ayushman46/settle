import { BadgeCheck, CreditCard, ShieldCheck } from 'lucide-react'
import { Banner, Button } from '../../components'
import { cx } from '../../lib/cx'
import { checkoutLabel } from './plans'
import type { ProOffer } from './useProOffer'
import styles from './OfferParts.module.css'

/** Why a pass can't be bought right now (checkout off, or the last try failed), if it can't. */
export function CheckoutNotice({ offer, onRedeem }: { offer: ProOffer; onRedeem: () => void }) {
  if (offer.checkoutOff) {
    return (
      <Banner tone="info" title="Checkout isn't set up yet" action={{ label: 'Redeem a code', onAction: onRedeem }}>
        Payments aren't switched on here yet, so passes can't be bought right now. Got a Pro code? You can redeem it.
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
  const { selected, checkout, checkoutOff } = offer
  if (checkoutOff) {
    return (
      <Button block className={className} onClick={onRedeem}>
        Redeem a code
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
      {selected ? checkoutLabel(selected) : 'Get Pro'}
    </Button>
  )
}

/** Three plain promises under the plans. */
export function TrustRow({ className }: { className?: string }) {
  return (
    <ul role="list" className={cx(styles.trust, className)} aria-label="How paying works">
      <li className={styles.trustItem}>
        <BadgeCheck aria-hidden="true" />
        One-time payment
      </li>
      <li className={styles.trustItem}>
        <ShieldCheck aria-hidden="true" />
        No account needed
      </li>
      <li className={styles.trustItem}>
        <CreditCard aria-hidden="true" />
        UPI or card via Razorpay
      </li>
    </ul>
  )
}
