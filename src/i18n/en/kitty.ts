/** English copy for The trip kitty (src/features/kitty): money pooled with one person up front. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const kitty = {
  'kitty.sheet.title': 'Trip kitty',

  // Starting one
  'kitty.setup.body': 'Everyone puts the same amount with one person, who pays for the group from it. Settle keeps count from the payments and bills you already add.',
  'kitty.setup.holder': 'Who holds the money',
  'kitty.setup.amount': 'Each person puts in',
  'kitty.setup.amount.label': 'Amount each',
  'kitty.setup.amount.error': 'Enter how much each person puts in',
  'kitty.setup.start': 'Start the kitty: {amount} each',
  'kitty.setup.started': 'Kitty started with {name}',
  'kitty.setup.started.you': 'Kitty started: you hold it',

  // The summary
  'kitty.summary.aria': 'The kitty so far',
  'kitty.summary.collected': 'Put in',
  'kitty.summary.spent': 'Spent from it',
  'kitty.summary.left': 'Left',
  'kitty.summary.lasts': 'Lasts till',
  'kitty.summary.lasts.none': 'No spending yet',
  'kitty.summary.lasts.out': 'Run out',
  'kitty.left.explain': 'Counted from {date}: what the rest of you hand {name}, less your shares of what {name} pays for the group.',
  'kitty.left.explain.you': 'Counted from {date}: what the others hand you, less their shares of what you pay for the group.',
  'kitty.holder.line': '{name}’s own share, {amount}, came from {name}’s own pocket, so it isn’t in these numbers.',
  'kitty.holder.line.you': 'Your own share, {amount}, came from your own pocket, so it isn’t in these numbers.',
  'kitty.over': '{name} has paid {amount} more for the rest of you than you put in.',
  'kitty.over.you': 'You’ve paid {amount} more for the others than they put in.',
  'kitty.pace': 'About {perDay} a day from the kitty so far.',
  'kitty.pace.none': 'Add what {name} pays for to the group, paid by {name}, and the kitty counts it.',
  'kitty.pace.none.you': 'Add what you pay for to the group, paid by you, and the kitty counts it.',

  // Each person
  'kitty.people.aria': 'Who has put in',
  'kitty.perHead': 'Each person puts in {amount} in all.',
  'kitty.row.holds': 'Holds the kitty',
  'kitty.row.putIn': 'Put in {amount}',
  'kitty.row.toPutIn': 'Still to put in {amount}',
  'kitty.row.partly': 'Put in {putIn}, {amount} still to go',
  'kitty.row.part': '{amount} of theirs left',
  'kitty.row.part.you': '{amount} of yours left',
  'kitty.row.short': 'Short {amount}: their share of the spending is more than they put in',
  'kitty.row.short.you': 'Short {amount}: your share of the spending is more than you put in',
  'kitty.row.got': 'Got it',
  'kitty.row.got.aria': 'Got it: {name} gave you {amount}',
  'kitty.row.pay': 'Pay {amount} to {name}',
  'kitty.row.paid': 'I’ve put in {amount}',
  'kitty.got.done': '{name} put in {amount}',
  'kitty.got.done.you': 'You put in {amount}',
  'kitty.got.failed': 'That payment couldn’t be saved. Try again.',

  // Asking the group
  'kitty.ask.cta': 'Ask everyone',
  'kitty.ask.message': 'Trip kitty for {group}: {amount} each, to {name}. {name} pays for things from it, and what’s left comes back at the end.',
  'kitty.ask.message.you': 'Trip kitty for {group}: {amount} each, to me. I’ll pay for things from it, and what’s left comes back at the end.',
  'kitty.ask.upi': 'UPI ID: {upi}',
  'kitty.ask.me': 'me',
  'kitty.ask.waiting': 'Still to put in: {names}',
  'kitty.ask.copied': 'Copied. Paste it in the group chat.',
  'kitty.ask.failed': 'Couldn’t share that. Try again.',

  // Topping up
  'kitty.topUp.title': 'The kitty is running low',
  'kitty.topUp.body': '{amount} more each covers the next 2 days at this pace.',
  'kitty.topUp.cta': 'Ask {amount} more each',
  'kitty.topUp.done': 'Now {amount} each in all',
  'kitty.topUp.message': 'Kitty top-up for {group}: it’s now {total} each in all, to {name}.',
  'kitty.topUp.message.you': 'Kitty top-up for {group}: it’s now {total} each in all, to me.',

  // Ending it
  'kitty.end.cta': 'End the kitty',
  'kitty.end.note': 'Ending it only stops counting here. Settle up already counts what’s in the kitty, so whatever is left goes back from there.',
  'kitty.end.done': 'Kitty ended with {amount} left. Settle up already counts it.',
  'kitty.end.done.empty': 'Kitty ended. Nothing was left in it.',
  'kitty.ended.title': 'Kitty ended',
  'kitty.ended.body': '{name} had {amount} of the others’ money left. Settle up already counts it.',
  'kitty.ended.body.you': 'You had {amount} of the others’ money left. Settle up already counts it.',
  'kitty.ended.body.empty': 'Nothing was left in it. Settle up already counts what was spent.',

  // The card above the expenses
  'kitty.card.title': 'Kitty with {name}',
  'kitty.card.title.you': 'Kitty with you',
  'kitty.card.left': '{left} left of {total}',
  'kitty.card.lasts': 'lasts till {date}',
  'kitty.card.out': 'run out',
  'kitty.card.collecting': '{done} of {count} have put in {amount}',
  'kitty.card.open': 'Open the kitty',
} satisfies Messages
