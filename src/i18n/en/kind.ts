/** English copy for Paid in kind (src/features/kind): a due settled with something that isn’t money. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const kind = {
  // Tools hub
  'kind.tool.title': 'Paid in kind',
  'kind.tool.body': 'Settle a due with something that isn’t money: a ticket, a favour, cash given earlier.',

  // The button on a friend
  'kind.button': 'Settle without money',
  'kind.button.aria': 'Settle with {name} without money',

  // The sheet
  'kind.sheet.title': 'Settle without money',
  'kind.sheet.body.in': '{name} owes you {amount}. If they made it up some other way, say how and it’s settled.',
  'kind.sheet.body.out': 'You owe {name} {amount}. If you made it up some other way, say how and it’s settled.',
  'kind.currency.aria': 'Which money to settle',
  'kind.currency.in': '{amount} owed to you',
  'kind.currency.out': '{amount} you owe',
  'kind.amount.label': 'How much it settles',
  'kind.amount.hint.all': 'All of it. Type less if it covers only a part.',
  'kind.amount.hint.part': 'Leaves {left} still to settle.',
  'kind.what.label': 'What it was',
  'kind.what.in.ticket': 'Bought my ticket',
  'kind.what.in.elsewhere': 'Paid my share somewhere else',
  'kind.what.in.cash': 'Gave it in cash earlier',
  'kind.what.in.favour': 'Did me a favour',
  'kind.what.in.other': 'Something else',
  'kind.what.out.ticket': 'Bought their ticket',
  'kind.what.out.elsewhere': 'Paid their share somewhere else',
  'kind.what.out.cash': 'Gave it in cash earlier',
  'kind.what.out.favour': 'Did them a favour',
  'kind.what.out.other': 'Something else',
  'kind.text.label': 'In your words',
  'kind.text.placeholder': 'Next dinner’s on me',
  'kind.date.label': 'When',
  'kind.date.aria': 'The day it was settled',
  'kind.fine': 'It’s saved like any other payment, marked “Other”, and this note is kept with it.',
  'kind.cta': 'Settle {amount}',
  'kind.cta.empty': 'Settle',

  // What is missing
  'kind.error.amount': 'Type how much this settles.',
  'kind.error.over': 'Only {amount} is open, so that is the most this can settle.',
  'kind.error.what': 'Pick what it was.',
  'kind.error.text': 'Say what it was, in a few words.',

  // After
  'kind.toast.all': 'Settled {amount} with {name}, without money.',
  'kind.toast.part': 'Settled {amount} with {name}, without money. {left} is still open.',
  'kind.toast.failed': 'Nothing is open between you any more, so nothing was changed.',

  // The note, shown beside the payment later
  'kind.note.line': 'Settled without money: {what}',
  'kind.note.in.ticket': '{name} bought your ticket',
  'kind.note.in.elsewhere': '{name} paid your share somewhere else',
  'kind.note.in.cash': '{name} gave it in cash earlier',
  'kind.note.in.favour': '{name} did you a favour',
  'kind.note.in.other': 'something else from {name}',
  'kind.note.out.ticket': 'you bought a ticket for {name}',
  'kind.note.out.elsewhere': 'you paid for {name} somewhere else',
  'kind.note.out.cash': 'you gave it in cash earlier',
  'kind.note.out.favour': 'you did {name} a favour',
  'kind.note.out.other': 'something else from you',
  'kind.note.text': '“{text}”',
} satisfies Messages
