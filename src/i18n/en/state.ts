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
  'state.error.expense.noPeople': 'Add at least one person to split with.',
  'state.error.expense.badTotal': 'Enter an amount above zero.',
  'state.error.expense.exactMismatch': "The amounts don't add up to the total yet.",
  'state.error.expense.percentMismatch': "The percentages don't add up to 100% yet.",
  'state.error.expense.payerMissing': 'Choose who paid.',
  'state.error.expense.zeroWeights': 'Give at least one person a share.',
  'state.error.expense.nothingHad': 'Type what at least one person had.',
  'state.error.expense.notFound': 'That expense no longer exists.',
  'state.error.data.notFound': "That couldn't be found — it may have been deleted.",
  'state.error.data.emptyName': 'Add a name first.',
  'state.error.data.duplicateName': 'Someone with that name is already in your people.',
  'state.error.data.limit': "You've reached the limit here — remove something you no longer need.",
  'state.error.data.invalid': "That doesn't look right — please check and try again.",
} as const satisfies Messages
