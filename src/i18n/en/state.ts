/** English copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'Fee',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'Items',
  'state.breakdown.serviceCharge': 'Service charge',
  'state.breakdown.tax': 'Tax',
  'state.breakdown.tip': 'Tip',
  'state.breakdown.discount': 'Discount',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'Round-off',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'Other charges',
  'state.breakdown.otherDiscounts': 'Other discounts',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'Adds up to',
  'state.breakdown.total': 'Bill total',
} as const satisfies Messages
