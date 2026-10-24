/** Telugu copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  // The name a delivery fee gets when it arrives without one (kept on the bill).
  'state.fee.default': 'ఫీజు',

  // "What the bill says" rows on the "What you paid" step, top to bottom.
  'state.breakdown.items': 'ఐటమ్‌లు',
  'state.breakdown.serviceCharge': 'సర్వీస్ ఛార్జ్',
  'state.breakdown.tax': 'పన్ను',
  'state.breakdown.tip': 'టిప్',
  'state.breakdown.discount': 'డిస్కౌంట్',
  // A difference under ₹1 that makes the printed total add up.
  'state.breakdown.roundOff': 'రౌండ్-ఆఫ్',
  // A bigger difference between the lines and the printed total.
  'state.breakdown.otherCharges': 'ఇతర ఛార్జీలు',
  'state.breakdown.otherDiscounts': 'ఇతర డిస్కౌంట్లు',
  // The last row when the bill printed no total: what its lines add up to.
  'state.breakdown.addsUpTo': 'మొత్తం కలిపితే',
  'state.breakdown.total': 'బిల్లు మొత్తం',
} as const satisfies Messages
