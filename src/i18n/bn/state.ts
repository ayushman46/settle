/** Bengali copy for bill state labels (the breakdown of what the bill says). Keys: `state.<area>.<element>`. */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'ফি',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'আইটেম',
  'state.breakdown.serviceCharge': 'সার্ভিস চার্জ',
  'state.breakdown.tax': 'ট্যাক্স',
  'state.breakdown.tip': 'টিপস',
  'state.breakdown.discount': 'ছাড়',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'রাউন্ড-অফ',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'অন্যান্য চার্জ',
  'state.breakdown.otherDiscounts': 'অন্যান্য ছাড়',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'যোগফল',
  'state.breakdown.total': 'বিলের মোট',
} as const satisfies Messages
