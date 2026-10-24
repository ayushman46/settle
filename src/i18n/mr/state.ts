/** Marathi copy for bill state labels (the breakdown of what the bill says). Keys: `state.<area>.<element>`. */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'शुल्क',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'वस्तू',
  'state.breakdown.serviceCharge': 'सर्व्हिस चार्ज',
  'state.breakdown.tax': 'कर',
  'state.breakdown.tip': 'टिप',
  'state.breakdown.discount': 'सवलत',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'राउंड-ऑफ',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'इतर शुल्क',
  'state.breakdown.otherDiscounts': 'इतर सवलती',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'बेरीज',
  'state.breakdown.total': 'बिलाची एकूण रक्कम',
} as const satisfies Messages
