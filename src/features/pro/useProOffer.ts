/**
 * Everything a paywall needs to sell a pass: the plans (from the server, or remembered), the one
 * picked (yearly first), checkout, and whether checkout is switched on at all.
 */
import { useMemo, useState } from 'react'
import type { License, PlanId } from '../../domain/types'
import { FALLBACK_BILLING_CONFIG, hasFreshBillingConfig, useBillingConfig, type BillingConfig } from '../../pro'
import { defaultPlanId, planOptions, type PlanOption } from './plans'
import { useCheckout, type CheckoutController } from './useCheckout'

export interface ProOffer {
  /** null for a first-time visitor until the server answers (or fails → built-in plans). */
  config: BillingConfig | null
  /** The passes on sale, in display order; null while loading. */
  options: PlanOption[] | null
  selected: PlanOption | null
  select: (plan: PlanId) => void
  checkout: CheckoutController
  /** The server says checkout isn't set up — show the plans, but offer "Redeem a code" instead of a buy button. */
  checkoutOff: boolean
  /** Pro's fair-use AI allowance per day. */
  proAiPerDay: number
}

export function useProOffer(onBought: (license: License) => void, preferred: PlanId | null = null): ProOffer {
  const config = useBillingConfig()
  const checkout = useCheckout(onBought)
  const [picked, setPicked] = useState<PlanId | null>(null)
  const options = useMemo(() => (config ? planOptions(config) : null), [config])
  const selectedId = picked !== null && options?.some((o) => o.id === picked) ? picked : defaultPlanId(options ?? [], preferred)
  const selected = options?.find((o) => o.id === selectedId) ?? null
  // Only the server's own answer means "not set up": a remembered or built-in config can't tell.
  const checkoutOff =
    checkout.phase.kind === 'unavailable' || (config !== null && config.checkout !== 'razorpay' && hasFreshBillingConfig())

  return {
    config,
    options,
    selected,
    select: (plan) => {
      setPicked(plan)
      checkout.reset()
    },
    checkout,
    checkoutOff,
    proAiPerDay: (config ?? FALLBACK_BILLING_CONFIG).proAiPerDay,
  }
}
