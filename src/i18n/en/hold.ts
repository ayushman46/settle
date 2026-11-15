/** English copy for On hold (src/features/hold): a disputed expense kept out of the balances. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const hold = {
  // Tools hub
  'hold.tool.title': 'On hold',
  'hold.tool.body': 'A disputed expense stays out of the balances until it’s sorted, then goes back as it was.',

  // On the expense page
  'hold.button': 'Put on hold',
  'hold.sheet.title': 'Put this on hold?',
  'hold.sheet.body': 'It comes out of every balance until it’s sorted out. Nothing is deleted: put it back any time, exactly as it was.',
  'hold.sheet.shared': 'This group is shared. Everyone in the group stops seeing it until you put it back.',
  'hold.sheet.reason': 'What’s wrong with it?',
  'hold.reason.amount': 'Wrong amount',
  'hold.reason.absent': 'I wasn’t there',
  'hold.reason.twice': 'Paid twice',
  'hold.reason.checking': 'Checking the bill',
  'hold.reason.other': 'Something else',
  'hold.sheet.note': 'What is it?',
  'hold.sheet.note.placeholder': 'Sam is finding the bill',
  'hold.sheet.cta': 'Put it on hold',
  'hold.done': '{title} is on hold. It’s out of the balances.',
  'hold.full': 'That’s a lot on hold already. Put some back first.',
  'hold.failed': 'Couldn’t put that on hold. Try again.',

  // The cards
  'hold.card.title': '{count, plural, one {# expense on hold} other {# expenses on hold}}',
  'hold.card.body': 'Left out of the balances until you sort them out.',
  'hold.card.body.one': 'Left out of the balances until you sort it out.',
  'hold.row.aria': '{title}, {amount}',
  'hold.row.today': 'On hold since today',
  'hold.row.days': '{count, plural, one {On hold for # day} other {On hold for # days}}',
  'hold.row.back': 'Put it back',
  'hold.row.back.aria': 'Put {title} back',
  'hold.row.change': 'Change it',
  'hold.row.change.aria': 'Put {title} back and change it',
  'hold.row.delete': 'Delete for good',
  'hold.row.delete.aria': 'Delete {title} for good',
  'hold.back.done': '{title} is back in the balances, as it was',
  'hold.delete.done': 'Deleted {title}',

  // Today
  'hold.today.week': '{title} has been on hold for a week',
  'hold.today.weeks': '{title} has been on hold for {weeks} weeks',
  'hold.today.body': '{amount} is out of the balances. Put it back, change it or delete it.',
  'hold.today.body.group': '{amount} in {group} is out of the balances. Put it back, change it or delete it.',
} satisfies Messages
