/**
 * Raising a stuck payment, one rung at a time: where to take it (your UPI app or bank, the RBI
 * Ombudsman, the business, the National Consumer Helpline, AirSewa, a consumer commission), the
 * letter ready to copy, share or send, and "I've raised it" (date and complaint number).
 *
 * STUB — the letters agent replaces the body; the props are the contract.
 */
import { BottomSheet } from '../../components'
import type { StuckPayment, StuckStepKind } from '../../data/stores'
import { useT } from '../../i18n'

export interface RaiseSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** The rung to raise. */
  step: StuckStepKind
  /** The bank complaint is for compensation only (the money is back, late). */
  compensationOnly?: boolean
}

export function RaiseSheet({ open, onClose }: RaiseSheetProps) {
  const t = useT()
  return <BottomSheet open={open} onClose={onClose} title={t('stuckhelp.title.bank')} />
}
