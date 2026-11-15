/** English copy for Small change rule (src/features/chhutta): tiny dues called even. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const chhutta = {
  // Tools hub
  'chhutta.tool.title': 'Small change rule',
  'chhutta.tool.body': 'A due of ₹7 isn’t worth a UPI request. One tap calls it even, and Settle keeps count.',

  // On the group page
  'chhutta.card.title': 'Small change',
  'chhutta.card.title.gentle': 'Small change (chhutta)',
  'chhutta.card.between': '{amount} between {from} and {to} is small change. Call it even?',
  'chhutta.card.owesYou': '{name} owes you {amount}. That’s small change. Call it even?',
  'chhutta.card.youOwe': 'You owe {name} {amount}. That’s small change: if {name} is fine with it, call it even.',
  'chhutta.card.cta': 'Call it even',
  'chhutta.card.cta.aria.between': 'Call it even: {amount} between {from} and {to}',
  'chhutta.card.cta.aria.you': 'Call it even: {amount} with {name}',
  'chhutta.card.keep': 'Keep it',
  'chhutta.card.notNow': 'Not now',
  'chhutta.card.gentle.fine': 'Want this every time? Pick a limit under Small change in this group’s settings.',
  'chhutta.card.done.between': 'Called even: {amount} between {from} and {to}',
  'chhutta.card.done.you': 'Called even: {amount} with {name}',
  'chhutta.card.kept': 'Kept: {amount} stays in the balances',
  'chhutta.card.failed': 'Couldn’t save that. Try again.',

  // The setting
  'chhutta.row.title': 'Small change',
  'chhutta.row.body': 'Ignore dues under',
  'chhutta.row.off': 'Off',
  'chhutta.row.hint.on': 'A due under {amount} in this group gets a one-tap “Call it even”. Nothing is let go until someone taps.',
  'chhutta.row.hint.off': 'Off: Settle won’t suggest letting anything go in this group.',
  'chhutta.row.hint.unset': 'Pick a limit and dues under it get a one-tap “Call it even”.',

  // The log
  'chhutta.log.both': 'You’ve let {letGo} go this year, and been let off {letOff}.',
  'chhutta.log.letGo': 'You’ve let {letGo} go this year.',
  'chhutta.log.letOff': 'You’ve been let off {letOff} this year.',

  // A friend's whole balance
  'chhutta.friend.owesYou': '{name} owes you {amount} in all. Small change.',
  'chhutta.friend.youOwe': 'You owe {name} {amount} in all. Small change: if {name} is fine with it, call it even.',
  'chhutta.friend.mixed': 'Only {amount} is open between you and {name}. Small change.',
  'chhutta.friend.cta': 'Call it even',
  'chhutta.friend.cta.aria': 'Call it even with {name}: {amount}',
  'chhutta.friend.done.letGo': 'You let {amount} go. You and {name} are even.',
  'chhutta.friend.done.letOff': '{amount} called even. You and {name} are even.',
} satisfies Messages
