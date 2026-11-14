/** English copy for Who was there when (src/features/presence): came late, left early, nights stayed. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const presence = {
  // The sheet
  'presence.sheet.title': 'Who was there when',
  'presence.sheet.description': 'Came a day late or left early? Set their days and Settle takes them off what happened without them.',
  'presence.sheet.from': 'Here from',
  'presence.sheet.to': 'Until',
  'presence.sheet.from.aria': '{name}: here from',
  'presence.sheet.to.aria': '{name}: until',
  'presence.sheet.whole': 'Whole trip',
  'presence.sheet.whole.aria': '{name} was there the whole trip',
  'presence.sheet.note': 'Both days count: “Until” is the last day they were there. Kept on this phone.',
  'presence.sheet.done': 'Done',

  // A stay, in a few words
  'presence.stay.whole': 'Whole trip',
  'presence.stay.from': 'From {date}',
  'presence.stay.to': 'Until {date}',
  'presence.stay.both': '{from} to {to}',

  // The banner
  'presence.banner.before': '{name} joined on {date} but is on {count, plural, one {# expense} other {# expenses}} from before.',
  'presence.banner.before.you': 'You joined on {date} but you’re on {count, plural, one {# expense} other {# expenses}} from before.',
  'presence.banner.after': '{name} was there until {date} but is on {count, plural, one {# expense} other {# expenses}} from after.',
  'presence.banner.after.you': 'You were there until {date} but you’re on {count, plural, one {# expense} other {# expenses}} from after.',
  'presence.banner.both': '{name} was there {from} to {to} but is on {count, plural, one {# expense} other {# expenses}} from other days.',
  'presence.banner.both.you': 'You were there {from} to {to} but you’re on {count, plural, one {# expense} other {# expenses}} from other days.',
  'presence.banner.ask':
    'Take {name} off {count, plural, one {it} other {them}}? The people who were there share {count, plural, one {it} other {them}} instead.',
  'presence.banner.ask.you':
    'Take yourself off {count, plural, one {it} other {them}}? The people who were there share {count, plural, one {it} other {them}} instead.',
  'presence.banner.apply': 'Take {name} off',
  'presence.banner.apply.you': 'Take me off',
  'presence.banner.leave': 'Leave them',
  'presence.banner.done': 'Took {name} off {count, plural, one {# expense} other {# expenses}}',
  'presence.banner.done.you': 'Took you off {count, plural, one {# expense} other {# expenses}}',
  'presence.banner.failed': 'Couldn’t change those expenses. Open one to fix it by hand.',
  'presence.banner.left': 'Left as they are',

  // Fix by hand
  'presence.hand.more': '{count, plural, one {This one needs} other {These need}} fixing by hand:',
  'presence.hand.only': '{count, plural, one {It needs} other {They need}} fixing by hand:',
  'presence.hand.ok': 'OK',
  'presence.hand.dismiss': 'Stop showing these',
  'presence.hand.item': '{title} · {date}',
  'presence.reason.paid': 'already paid back',
  'presence.reason.bill': 'itemised bill',
  'presence.reason.mode': 'split another way',
  'presence.reason.last': 'the only one on it',

  // Split by nights
  'presence.nights.title': 'Split by nights',
  'presence.nights.body': 'Not everyone stayed the same number of nights.',
  'presence.nights.count': '{count, plural, one {# night} other {# nights}}',
  'presence.nights.row': '{name}: {nights}, {amount}',
  'presence.nights.range':
    'Nights counted from {from} to {to}: from the first day of the trip to the last, by when people were there and the group’s expenses.',
  'presence.nights.cta': 'Split by nights',
  'presence.nights.done': 'Now split by the nights each person stayed',
  'presence.nights.failed': 'Couldn’t change the split. Try editing it instead.',
  'presence.nights.list': 'Nights each person stayed',
} satisfies Messages
