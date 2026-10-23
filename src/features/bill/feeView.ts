/**
 * Food-delivery fees on the bill screens (spec 08): each fee kind's emoji and words, the fee
 * policy's explanation on the "What you paid" step, each person's fee lines on the result, and the
 * undo / convert helpers the review step uses. Pure — no React.
 */
import { t, type MessageKey } from '../../i18n'
import { newId } from '../../lib/ids'
import { formatMoney } from '../../lib/money'
import type { PersonSplit } from '../../lib/split'
import { MAX_ITEMS } from '../../state/reducer'
import { BILL_FEE_KINDS, type BillFee, type BillFeeKind, type BillItem, type FeeSplit, type Minor, type Session } from '../../types'

export { BILL_FEE_KINDS }

/** The emoji shown before a fee of each kind (decorative; the label carries the meaning). */
export const FEE_EMOJI: Readonly<Record<BillFeeKind, string>> = {
  delivery: '🛵',
  platform: '🧾',
  packaging: '📦',
  surge: '🌧️',
  small_order: '🛒',
  tip: '🙏',
  donation: '💚',
  fee_tax: '🏛️',
  other: '➕',
}

/** A known kind for anything (unknown → 'other'). */
export function feeKind(kind: unknown): BillFeeKind {
  return (BILL_FEE_KINDS as readonly unknown[]).includes(kind) ? (kind as BillFeeKind) : 'other'
}

const KIND_KEYS = {
  delivery: 'delivery.fee.kind.delivery',
  platform: 'delivery.fee.kind.platform',
  packaging: 'delivery.fee.kind.packaging',
  surge: 'delivery.fee.kind.surge',
  small_order: 'delivery.fee.kind.small_order',
  tip: 'delivery.fee.kind.tip',
  donation: 'delivery.fee.kind.donation',
  fee_tax: 'delivery.fee.kind.fee_tax',
  other: 'delivery.fee.kind.other',
} as const satisfies Record<BillFeeKind, MessageKey>

const DEFAULT_KEYS = {
  delivery: 'delivery.fee.default.delivery',
  platform: 'delivery.fee.default.platform',
  packaging: 'delivery.fee.default.packaging',
  surge: 'delivery.fee.default.surge',
  small_order: 'delivery.fee.default.small_order',
  tip: 'delivery.fee.default.tip',
  donation: 'delivery.fee.default.donation',
  fee_tax: 'delivery.fee.default.fee_tax',
  other: 'delivery.fee.default.other',
} as const satisfies Record<BillFeeKind, MessageKey>

/** The kind's short name for the kind picker: "Delivery", "Surge/rain", "GST on fees"… */
export function feeKindLabel(kind: BillFeeKind): string {
  return t(KIND_KEYS[feeKind(kind)])
}

/** The name a fee of `kind` gets when none is typed: "Delivery fee", "Rain fee", "Fee"… */
export function defaultFeeLabel(kind: BillFeeKind): string {
  return t(DEFAULT_KEYS[feeKind(kind)])
}

/** A fee row's accessible name: "Delivery fee, ₹35, edit". */
export function feeRowLabel(fee: Pick<BillFee, 'label' | 'amount'>, currency: string): string {
  return t('delivery.review.fees.row.aria', { label: fee.label, amount: formatMoney(fee.amount, currency, { trimZeros: true }) })
}

/** What the fee policy explanation needs from the bill. */
export interface FeePolicyFacts {
  feeSplit: FeeSplit
  /** Σ fees (minor). */
  fees: Minor
  /** Tax, service charge and tip read from the bill (minor, ≥ 0) — "tax" in the copy. */
  charges: Minor
  /** The coupon / discount (minor, ≥ 0). */
  coupon: Minor
  currency: string
}

/** The facts for `explainFeePolicy` from a bill in progress. */
export function feePolicyFacts(session: Session, fees: Minor): FeePolicyFacts {
  const { tax, serviceCharge, tip, discount } = session.meta
  return {
    feeSplit: session.feeSplit ?? 'proportional',
    fees,
    charges: Math.max(0, tax ?? 0) + Math.max(0, serviceCharge ?? 0) + Math.max(0, tip ?? 0),
    coupon: Math.abs(discount ?? 0),
    currency: session.currency,
  }
}

/**
 * The line under the fee policy: "₹90 in fees split equally between everyone who ordered — tax and
 * the ₹100 coupon go by what each had." (equally) or "Fees, tax and the coupon are all shared by
 * what each person had." (by what each had) — naming only the tax and coupon the bill has.
 */
export function explainFeePolicy(facts: FeePolicyFacts): string {
  const money = (minor: Minor) => formatMoney(minor, facts.currency, { trimZeros: true })
  const hasTax = facts.charges > 0
  const hasCoupon = facts.coupon > 0
  const variant = hasTax && hasCoupon ? '' : hasCoupon ? '.coupon' : hasTax ? '.tax' : '.only'
  if (facts.feeSplit === 'equal') {
    switch (variant) {
      case '':
        return t('delivery.paid.explain.equal', { fees: money(facts.fees), coupon: money(facts.coupon) })
      case '.coupon':
        return t('delivery.paid.explain.equal.coupon', { fees: money(facts.fees), coupon: money(facts.coupon) })
      case '.tax':
        return t('delivery.paid.explain.equal.tax', { fees: money(facts.fees) })
      default:
        return t('delivery.paid.explain.equal.only', { fees: money(facts.fees) })
    }
  }
  switch (variant) {
    case '':
      return t('delivery.paid.explain.proportional')
    case '.coupon':
      return t('delivery.paid.explain.proportional.coupon')
    case '.tax':
      return t('delivery.paid.explain.proportional.tax')
    default:
      return t('delivery.paid.explain.proportional.only')
  }
}

/** One person's lines on the result step when the bill has fees. */
export interface PersonFeeLines {
  /** Their part of the fees (0 = no "Fees" line). */
  fees: Minor
  /** Everything else on top of their items: tax, charges, coupon and round-off (signed; 0 = no line). */
  other: Minor
  /** True when they had nothing (shown as "Didn't order"). */
  none: boolean
}

/** `total − itemsSubtotal − fees` is "Tax, charges & offers"; nobody with no items and no total "ordered". */
export function personFeeLines(p: Pick<PersonSplit, 'fees' | 'itemsSubtotal' | 'total'>): PersonFeeLines {
  return {
    fees: p.fees,
    other: p.total - p.itemsSubtotal - p.fees,
    none: p.itemsSubtotal === 0 && p.total === 0,
  }
}

/**
 * Undo for a removed fee: `current` with the fee from `before` back in its old place (after its
 * nearest earlier neighbour that still exists). Anything changed since is kept. Null when it
 * can't be done (another bill, already back, another currency, or the bill is full of fees).
 */
export function restoreFee(current: Session, before: Session, feeId: string, maxFees: number): Session | null {
  if (current.id !== before.id || current.currency !== before.currency) return null
  const old = before.meta.fees ?? []
  const index = old.findIndex((f) => f.id === feeId)
  const fee = old[index]
  const now = current.meta.fees ?? []
  if (!fee || now.some((f) => f.id === feeId) || now.length >= maxFees) return null
  let insertAt = 0
  for (let i = index - 1; i >= 0; i--) {
    const neighbour = old[i]
    const at = neighbour ? now.findIndex((f) => f.id === neighbour.id) : -1
    if (at !== -1) {
      insertAt = at + 1
      break
    }
  }
  const fees = [...now.slice(0, insertAt), fee, ...now.slice(insertAt)]
  return { ...current, meta: { ...current.meta, fees } }
}

/** A fee as a bill item (a tip only one person gives): same name and amount, quantity 1. Null when the bill is full. */
export function feeAsItem(session: Session, fee: BillFee): BillItem | null {
  if (session.items.length >= MAX_ITEMS) return null
  return { id: newId(), name: fee.label, quantity: 1, amount: fee.amount }
}
