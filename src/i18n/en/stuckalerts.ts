/** English copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts = {
  'stuckalerts.failed': '{amount} to {name} failed but took your money — tracking it in Stuck money',
  'stuckalerts.failed.anon': 'A {amount} payment failed but took your money — tracking it in Stuck money',
  'stuckalerts.failed.late':
    '{amount} to {name} failed but took your money — it’s {days, plural, one {# day} other {# days}} late: your bank owes you {compensation} for the wait so far',
  'stuckalerts.failed.anon.late':
    'A {amount} payment failed but took your money — it’s {days, plural, one {# day} other {# days}} late: your bank owes you {compensation} for the wait so far',
  'stuckalerts.failed.atm': 'The ATM didn’t give you {amount} but took it from your account — tracking it in Stuck money',
  'stuckalerts.failed.atm.late':
    'The ATM didn’t give you {amount} but took it from your account — it’s {days, plural, one {# day} other {# days}} late: your bank owes you {compensation} for the wait so far',
  'stuckalerts.check': '{amount} to {name} may be stuck — did it leave your account?',
  'stuckalerts.check.anon': 'A {amount} payment may be stuck — did it leave your account?',
  'stuckalerts.refund': 'Tracking {name}’s refund of {amount} till it lands',
  'stuckalerts.refund.anon': 'Tracking a refund of {amount} till it lands',
  'stuckalerts.added.many': '{count, plural, one {# payment} other {# payments}} added to Stuck money',
  'stuckalerts.back.failed': '{amount} from the failed {name} payment is back',
  'stuckalerts.back.failed.anon': '{amount} from a failed payment is back',
  'stuckalerts.back.failed.late':
    '{amount} from the failed {name} payment is back — {days, plural, one {# day} other {# days}} late: your bank owes you {compensation} for the wait',
  'stuckalerts.back.failed.anon.late':
    '{amount} from a failed payment is back — {days, plural, one {# day} other {# days}} late: your bank owes you {compensation} for the wait',
  'stuckalerts.back.refund': '{name}’s refund of {amount} is in',
  'stuckalerts.back.refund.anon': 'A refund of {amount} is in',
  'stuckalerts.back.part': '{back} of your {amount} is back — {rest} still to come, and Settle keeps tracking it',
  'stuckalerts.back.many': '{count, plural, one {# stuck payment is} other {# stuck payments are}} back',
  'stuckalerts.cleared': '{amount} to {name} went through after all — nothing stuck',
  'stuckalerts.cleared.anon': 'A {amount} payment went through after all — nothing stuck',
  'stuckalerts.cleared.many': '{count, plural, one {# payment} other {# payments}} went through after all — nothing stuck',
} as const satisfies Messages
