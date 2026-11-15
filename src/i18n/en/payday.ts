/** English copy for Payday-aware (src/features/payday): your payday and your friends’. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const payday = {
  // The Tools hub
  'payday.tool.title': 'Ask after payday',
  'payday.tool.body': 'See the best day to ask each friend, and clear what you owe on your own payday.',

  // The screen
  'payday.title': 'Payday',
  'payday.subtitle': 'Ask people the day after they get paid. Clear what you owe on your own payday.',

  // A payday in a sentence ({day} is "1st", "22nd") and on a chip
  'payday.value.day': 'the {day}',
  'payday.value.last': 'the last day of the month',
  'payday.value.lastWorking': 'the last working day of the month',
  'payday.chip.last': 'Last day',
  'payday.chip.lastWorking': 'Last working day',
  'payday.chip.other': 'Other',
  'payday.chip.unknown': 'Don’t know',

  // Yours
  'payday.mine.title': 'Your payday',
  'payday.mine.unset': 'Tell Settle once. On that day it lines up everyone you owe, to clear in one go.',
  'payday.mine.set': 'You get paid on {payday}. Next payday: {date}.',
  'payday.mine.chips.aria': 'Your payday',
  'payday.mine.toast.set': 'Your payday: {payday}',
  'payday.mine.toast.cleared': 'Your payday is forgotten',

  // A friend’s (the friend page, and the list on the Payday screen)
  'payday.friend.question': 'When does {name} get paid?',
  'payday.friend.why': 'Settle shows the best day to ask: the day after.',
  'payday.friend.set': 'Gets paid on {payday}. Next payday: {date}.',
  'payday.friend.chips.aria': '{name}’s payday',
  'payday.friend.toast.set': '{name} gets paid on {payday}',
  'payday.friend.toast.cleared': '{name}’s payday is forgotten',

  // The picker sheet
  'payday.sheet.mine.title': 'When do you get paid?',
  'payday.sheet.mine.description': 'Pick the day of the month. It stays on this phone.',
  'payday.sheet.friend.title': 'When does {name} get paid?',
  'payday.sheet.friend.description': 'Pick the day of the month. Only you see it.',
  'payday.sheet.grid.aria': 'Day of the month',
  'payday.sheet.day.aria': 'The {day}',
  'payday.sheet.short': 'In a shorter month, the 29th, 30th or 31st means the last day.',
  'payday.sheet.last': 'Last day of the month',
  'payday.sheet.lastWorking': 'Last working day',
  'payday.sheet.lastWorking.note': 'The last working day skips Saturday and Sunday. Settle doesn’t know bank holidays.',
  'payday.sheet.clear': 'Don’t know',

  // The hint on a To collect row ({payday} and {ask} are "the 1st", "the 2nd")
  'payday.hint.upcoming': 'Gets paid on {payday}: best to ask on {ask}',
  'payday.hint.today': 'Payday is today: best to ask tomorrow',
  'payday.hint.yesterday': 'Payday was yesterday: a good day to ask',

  // Home: your payday
  'payday.card.aria': 'Payday',
  'payday.card.title':
    '{when, select, today {Payday.} yesterday {Payday was yesterday.} other {Payday was 2 days ago.}} You owe {amount} to {count, plural, one {{name}} other {# people}}',
  'payday.card.body': '{count, plural, one {One payment clears it.} other {Go through them one by one, the largest first.}}',
  'payday.card.cta': 'Clear everything',
  'payday.card.dismiss.aria': 'Not this month',
  'payday.card.dismissed': 'Put away until your next payday',

  // Home: a payday worked out from salary alerts, offered
  'payday.guess.aria': 'Is this your payday?',
  'payday.guess.title': 'Looks like you get paid on {payday}. Remember it?',
  'payday.guess.body': 'Salary alerts came on {days}. Settle kept only the dates, not the amounts.',
  'payday.guess.days.and': '{first} and {last}',
  'payday.guess.days.sep': ', ',
  'payday.guess.yes': 'Remember it',
  'payday.guess.other': 'Another day',
  'payday.guess.no': 'Not now',
  'payday.guess.toast.no': 'Okay, not saved',

  // Who to ask when
  'payday.ask.title': 'Who to ask when',
  'payday.ask.description': 'Everyone who owes you, the soonest first.',
  'payday.ask.today': 'Ask today',
  'payday.ask.today.body': 'Payday was yesterday',
  'payday.ask.tomorrow': 'Ask tomorrow',
  'payday.ask.tomorrow.body': 'Payday is today',
  'payday.ask.on': 'Ask on {date}',
  'payday.ask.on.body': 'Gets paid on {payday}',
  'payday.ask.unknown': 'Payday not known',
  'payday.ask.unknown.body': 'Tap to add it',
  'payday.ask.row.aria': '{name} owes you {amount}. {when}. {why}',
  'payday.ask.empty.title': 'Nobody owes you right now',
  'payday.ask.empty.body': 'When someone does, Settle shows the best day to ask: the day after their payday.',
  'payday.ask.empty.cta': 'Add a split',

  // Friends’ paydays
  'payday.friends.title': 'Friends’ paydays',
  'payday.friends.description': 'Tap a name to set or change it. Only you see this.',
  'payday.friends.set': 'Gets paid on {payday}',
  'payday.friends.unset': 'Not set',
  'payday.friends.row.aria': '{name}: {payday}. Change',
  'payday.friends.more': 'Show all {count}',

  // Today on Home
  'payday.today.mine.title': '{when, select, today {Payday} yesterday {Payday was yesterday} other {Payday was 2 days ago}}: clear what you owe',
  'payday.today.mine.body': '{count, plural, one {You owe {name}} other {You owe # people}}',
  'payday.today.ask.title': 'A good day to ask {name}',
  'payday.today.ask.body': 'Their payday was yesterday',
} satisfies Messages
