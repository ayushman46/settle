/** Hindi copy for the bill draft state (src/state). Keys: `state.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const state = {
  'state.fee.default': 'चार्ज',

  'state.breakdown.items': 'आइटम',
  'state.breakdown.serviceCharge': 'सर्विस चार्ज',
  'state.breakdown.tax': 'टैक्स',
  'state.breakdown.tip': 'टिप',
  'state.breakdown.discount': 'छूट',
  'state.breakdown.roundOff': 'राउंड-ऑफ़',
  'state.breakdown.otherCharges': 'दूसरे चार्ज',
  'state.breakdown.otherDiscounts': 'दूसरी छूट',
  'state.breakdown.addsUpTo': 'कुल जोड़',
  'state.breakdown.total': 'कुल बिल',
} as const satisfies Messages
