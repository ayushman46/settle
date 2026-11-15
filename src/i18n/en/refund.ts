/** English copy for Refund splitter (src/features/refund): a refund goes back in the same proportions. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const refund = {
  // Tools hub
  'refund.tool.title': 'Refund splitter',
  'refund.tool.body': 'A refund, cashback or deposit comes back: everyone’s share drops in the same proportion.',

  // On the expense page
  'refund.button': 'Got money back?',
  'refund.sheet.title': 'Got money back on this?',
  'refund.sheet.body': 'A refund, cashback or a deposit returned. Everyone’s share comes down in the same proportion, so nobody works it out by hand.',
  'refund.sheet.amount': 'How much came back',
  'refund.sheet.all': 'All of it: {amount}',
  'refund.sheet.half': 'Half: {amount}',
  'refund.sheet.who': 'Who got the money',
  'refund.sheet.who.paid': '{name} (paid)',
  'refund.sheet.date': 'When it came back',
  'refund.sheet.save': 'Save refund of {amount}',
  'refund.sheet.missing': 'Enter how much came back',
  'refund.sheet.tooMuch': 'That’s more than the {amount} paid',

  // What will happen
  'refund.preview.title': 'What changes',
  'refund.preview.lower': '{title} becomes {amount}, down from {was}.',
  'refund.preview.share': '{amount}, was {was}',
  'refund.preview.share.same': '{amount}, no change',
  'refund.preview.remove': 'All of it came back, so {title} comes out of the balances. It’s kept under “Refunded in full”, and you can put it back.',
  'refund.preview.remove.shared': 'This group is shared. Everyone in the group stops seeing {title} once it’s out.',
  'refund.preview.holder': '{borrower} got money {lender} paid, so {borrower} owes {lender} {amount}. It’s added as its own entry.',
  'refund.preview.holder.youGot': 'You got money {lender} paid, so you owe {lender} {amount}. It’s added as its own entry.',
  'refund.preview.holder.yourMoney': '{borrower} got money you paid, so {borrower} owes you {amount}. It’s added as its own entry.',
  'refund.preview.overpaid': '{lender} had already paid {borrower} back, so {borrower} owes {lender} {amount}. It’s added as its own entry.',
  'refund.preview.overpaid.you': 'You had already paid {borrower} back, so {borrower} owes you {amount}. It’s added as its own entry.',
  'refund.preview.overpaid.toYou': '{lender} had already paid you back, so you owe {lender} {amount}. It’s added as its own entry.',

  // Refunds already on it
  'refund.past.title': 'Already refunded',
  'refund.past.line': '{amount} on {date}',
  'refund.past.line.to': '{amount} on {date}, to {name}',
  'refund.past.takeOff': 'Take it off',
  'refund.past.takeOff.aria': 'Take off the refund of {amount}',
  'refund.past.locked': 'The expense was changed after this refund. To change it now, edit the expense.',
  'refund.past.earlier': 'Take off the newer refund first.',
  'refund.takenOff': 'Refund taken off. {title} is {amount} again.',

  // Saved
  'refund.done.lower': '{amount} refund saved. {title} is now {total}.',
  'refund.done.remove': '{title} was refunded in full. It’s out of the balances.',
  'refund.failed.gone': 'That expense isn’t there any more.',
  'refund.failed.full': 'Too many fully refunded expenses are kept. Clear some first.',
  'refund.failed.stuck': 'This one can’t be changed here. Edit the expense instead.',
  'refund.failed': 'Couldn’t save the refund. Nothing was changed.',

  // Kept in the expense's note and on the entries beside it (others may read these)
  'refund.note.line': '{amount} refunded on {date}',
  'refund.note.line.to': '{amount} refunded on {date}, to {name}',
  'refund.companion.title': 'Refund on {title}',
  'refund.companion.note.holder': '{borrower} got the {amount} refund on {title} ({date}). {lender} had paid, so {borrower} owes it to {lender}.',
  'refund.companion.note.overpaid': '{title} was refunded on {date}. {lender} had already paid {borrower} back, so {borrower} owes {lender} {amount}.',

  // Refunded in full
  'refund.full.title': '{count, plural, one {# expense refunded in full} other {# expenses refunded in full}}',
  'refund.full.body': 'All the money came back, so these are out of the balances.',
  'refund.full.body.one': 'All the money came back, so it’s out of the balances.',
  'refund.full.row.aria': '{title}, {amount}',
  'refund.full.row.line': 'Came back on {date}',
  'refund.full.row.line.to': 'Came back on {date}, to {name}',
  'refund.full.back': 'Put it back',
  'refund.full.back.aria': 'Put {title} back',
  'refund.full.clear': 'Clear',
  'refund.full.clear.aria': 'Clear {title} from this list',
  'refund.full.back.done': '{title} is back in the balances, as it was',
  'refund.full.clear.done': 'Cleared {title}',
  'refund.full.back.failed': 'Couldn’t put that back.',
} satisfies Messages
