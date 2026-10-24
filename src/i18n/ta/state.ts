/** Tamil copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'கட்டணம்',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'பொருட்கள்',
  'state.breakdown.serviceCharge': 'சேவைக் கட்டணம்',
  'state.breakdown.tax': 'வரி',
  'state.breakdown.tip': 'டிப்',
  'state.breakdown.discount': 'தள்ளுபடி',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'வட்டமிடல்',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'மற்ற கட்டணங்கள்',
  'state.breakdown.otherDiscounts': 'மற்ற தள்ளுபடிகள்',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'கூட்டுத்தொகை',
  'state.breakdown.total': 'பில் மொத்தம்',
} as const satisfies Messages
