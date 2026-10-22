/**
 * Buying a Pro pass from a screen: runs `startCheckout`, turns every ending into something to
 * show (a friendly failure, an honest "checkout isn't set up", a quiet "no payment was made"),
 * and hands the new license to `onSuccess` for the celebration.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useToast } from '../../components'
import { useProfile } from '../../data'
import type { License, PlanId } from '../../domain/types'
import { startCheckout } from '../../pro'

export type CheckoutPhase =
  | { kind: 'idle' }
  /** Razorpay is open (or loading) for `plan`. */
  | { kind: 'busy'; plan: PlanId }
  /** `message` is friendly and safe to show as is. */
  | { kind: 'failed'; message: string }
  /** The server says checkout isn't set up — offer "Redeem a code". */
  | { kind: 'unavailable' }

export interface CheckoutController {
  phase: CheckoutPhase
  /** Opens checkout for `plan`; resolves to the license when Pro was bought, else null. */
  buy: (plan: PlanId) => Promise<License | null>
  /** Clears a failure message (e.g. when another plan is picked). */
  reset: () => void
}

const IDLE: CheckoutPhase = { kind: 'idle' }

/** A real name to pre-fill the payment form with (not the "Me" placeholder). */
function payerName(name: string): string | undefined {
  const clean = name.trim()
  return clean && !/^(me|you)$/i.test(clean) ? clean : undefined
}

export function useCheckout(onSuccess: (license: License) => void): CheckoutController {
  const toast = useToast()
  const profile = useProfile()
  const [phase, setPhase] = useState<CheckoutPhase>(IDLE)
  const mounted = useRef(false)
  const latest = useRef({ onSuccess, name: profile.name, toast })

  useLayoutEffect(() => {
    latest.current = { onSuccess, name: profile.name, toast }
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const buy = useCallback(async (plan: PlanId): Promise<License | null> => {
    setPhase({ kind: 'busy', plan })
    const result = await startCheckout(plan, { name: payerName(latest.current.name) })
    if (!mounted.current) return result.status === 'success' ? result.license : null
    switch (result.status) {
      case 'success':
        setPhase(IDLE)
        latest.current.onSuccess(result.license)
        return result.license
      case 'cancelled':
        setPhase(IDLE)
        latest.current.toast('Checkout closed. No payment was made.')
        return null
      case 'failed':
        setPhase({ kind: 'failed', message: result.message })
        return null
      case 'unavailable':
        setPhase({ kind: 'unavailable' })
        return null
    }
  }, [])

  const reset = useCallback(() => {
    setPhase((current) => (current.kind === 'failed' ? IDLE : current))
  }, [])

  return { phase, buy, reset }
}
