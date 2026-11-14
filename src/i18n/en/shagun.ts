/**
 * English copy for the shagun book (src/features/shagun): who gave what at your functions and what
 * you gave at theirs, and "What should I give?". Names arrive as people typed them; amounts and
 * dates pre-formatted.
 */
import type { Messages } from '../types'

export const shagun = {
  'shagun.title': 'Shagun book',
  'shagun.subtitle': 'Who gave what, so you always give back right',
  'shagun.row.title': 'Shagun book',
  'shagun.row.empty': 'Who gave what at weddings, so you give back right',
  'shagun.row.families': '{count, plural, one {# family} other {# families}}',

  // Empty book
  'shagun.empty.title': 'Your shagun book',
  'shagun.empty.text': 'Write down who gave what at your wedding, housewarming or naming. When their function comes, Settle tells you what to give back.',
  'shagun.empty.cta': 'Add your first function',

  // Headline
  'shagun.totals.received': 'Received',
  'shagun.totals.given': 'Given',
  'shagun.totals.families': 'from {count, plural, one {# family} other {# families}}',
  'shagun.totals.to': 'to {count, plural, one {# family} other {# families}}',
  'shagun.export': 'Export as CSV',
  'shagun.export.done': '{count, plural, one {# entry} other {# entries}} saved as a spreadsheet',
  'shagun.export.failed': 'Couldn’t save the file. Try again.',
  'shagun.addEnvelopes': 'Add envelopes',

  // What should I give?
  'shagun.give.title': 'What should I give?',
  'shagun.give.field': 'Whose function is it?',
  'shagun.give.placeholder': 'Type a family name',
  'shagun.give.pick.aria': 'Families in your book',
  'shagun.give.none': 'No history with them yet.',
  'shagun.give.none.hint': 'Nothing from {name} is written down, so there’s nothing to match. Give what feels right.',
  'shagun.give.record': 'I gave {amount}',
  'shagun.give.recorded': 'Written down: you gave {name} {amount} today',
  'shagun.give.failed': 'Couldn’t write it down: the book is full.',

  // The reason, in one sentence (or two short ones)
  'shagun.advice.gave': 'They gave {gave} in {year}.',
  'shagun.advice.gave.at': 'They gave {gave} {at} in {year}.',
  'shagun.advice.give': '{years, plural, =0 {Give back {amount}.} one {With a year gone by, {amount}.} other {With # years gone by, {amount}.}}',
  'shagun.advice.gift': 'They gave you {gift} in {year}, not money. Give something of about that worth.',
  'shagun.advice.gift.at': 'They gave you {gift} {at} in {year}, not money. Give something of about that worth.',
  'shagun.advice.gift.unnamed': 'a gift',
  'shagun.at.mine': '{kind, select, wedding {at your wedding} engagement {at your engagement} housewarming {at your housewarming} naming {at your baby’s naming} birthday {at your birthday} festival {at your festival} other {at your function}}',
  'shagun.at.theirs': 'at {name}',

  // Kinds
  'shagun.kind.wedding': 'Wedding',
  'shagun.kind.engagement': 'Engagement',
  'shagun.kind.housewarming': 'Housewarming',
  'shagun.kind.naming': 'Baby / naming',
  'shagun.kind.birthday': 'Birthday',
  'shagun.kind.festival': 'Festival',
  'shagun.kind.other': 'Other',
  'shagun.default.mine': '{kind, select, wedding {Our wedding} engagement {Our engagement} housewarming {Our housewarming} naming {Our baby’s naming} birthday {Our birthday} festival {Our festival} other {Our function}}, {month}',
  'shagun.default.theirs': '{kind, select, wedding {A wedding} engagement {An engagement} housewarming {A housewarming} naming {A naming} birthday {A birthday} festival {A festival} other {A function}}, {month}',

  // Tabs, search, sorting
  'shagun.tabs.aria': 'Show',
  'shagun.tabs.families': 'Families',
  'shagun.tabs.functions': 'Functions',
  'shagun.search': 'Search families',
  'shagun.search.none': 'No family called “{query}” in the book.',
  'shagun.sort.aria': 'Sort families',
  'shagun.sort.name': 'Name',
  'shagun.sort.amount': 'Amount',
  'shagun.sort.recent': 'Recent',
  'shagun.family.line.both': 'Gave you {received} · You gave {given}',
  'shagun.family.line.received': 'Gave you {received}',
  'shagun.family.line.given': 'You gave {given}',
  'shagun.family.line.gifts': 'Gifts only',
  'shagun.more': 'Show {count} more',

  // Functions list
  'shagun.functions.add': 'Add a function',
  'shagun.functions.none': 'No functions yet. Add one to keep its envelopes together.',
  'shagun.function.line': '{date} · {count, plural, =0 {nothing written down yet} one {# family} other {# families}}',
  'shagun.function.yours': 'Yours',
  'shagun.function.theirs': 'Theirs',

  // Function sheet
  'shagun.fnsheet.add': 'Add a function',
  'shagun.fnsheet.edit': 'Change the function',
  'shagun.fnsheet.whose': 'Whose function',
  'shagun.fnsheet.mine': 'Ours',
  'shagun.fnsheet.theirs': 'Someone else’s',
  'shagun.fnsheet.kind': 'What kind',
  'shagun.fnsheet.name': 'Name',
  'shagun.fnsheet.name.hint': 'Leave it empty for “{name}”',
  'shagun.fnsheet.date': 'When',
  'shagun.fnsheet.save': 'Save',
  'shagun.fnsheet.full': 'The book has as many functions as it can hold.',

  // Function screen
  'shagun.fn.gone.title': 'This function isn’t in the book',
  'shagun.fn.gone.body': 'It may have been deleted on this phone.',
  'shagun.fn.collected': 'Collected {amount} from {count, plural, one {# family} other {# families}}',
  'shagun.fn.gave': 'You gave {amount}',
  'shagun.fn.nothing': 'Nothing written down yet. Add the envelopes while they’re in hand.',
  'shagun.fn.rename': 'Change',
  'shagun.fn.delete': 'Delete',
  'shagun.fn.deleted': 'Deleted “{name}”',
  'shagun.fn.deleted.entries': 'Deleted “{name}” and its {count, plural, one {# entry} other {# entries}}',
  'shagun.fn.entries': 'Envelopes',
  'shagun.fn.search': 'Search this function',

  // Fast entry
  'shagun.entry.title': 'Add envelopes',
  'shagun.entry.loose': 'Not tied to a function',
  'shagun.entry.direction.aria': 'Which way',
  'shagun.entry.received': 'They gave',
  'shagun.entry.given': 'I gave',
  'shagun.entry.name': 'Family or name',
  'shagun.entry.name.placeholder': 'Sharma ji',
  'shagun.entry.names.aria': 'Names already in the book',
  'shagun.entry.amount': 'Amount',
  'shagun.entry.chips.aria': 'Common amounts',
  'shagun.entry.gift': 'Gift (optional)',
  'shagun.entry.gift.placeholder': 'Silver coin, saree',
  'shagun.entry.save': 'Save & next',
  'shagun.entry.done': 'Done',
  'shagun.entry.count': '{count, plural, =0 {Nothing added yet} one {# envelope · {total}} other {# envelopes · {total}}}',
  'shagun.entry.needName': 'Write whose envelope it is.',
  'shagun.entry.needAmount': 'Add an amount or a gift.',
  'shagun.entry.full': 'The book is full: it holds 10,000 entries.',
  'shagun.entry.recent': 'Just added',
  'shagun.entry.recent.merged': 'added to the earlier one',
  'shagun.entry.undo.aria': 'Undo {name} {amount}',
  'shagun.entry.undone': 'Taken out: {name}',
  'shagun.dup.text': '{name} is already down for {amount} at this function. Add to the earlier {amount} or keep both?',
  'shagun.dup.add': 'Add to it ({total})',
  'shagun.dup.both': 'Keep both',

  // Family screen
  'shagun.family.none.title': 'No history with them yet',
  'shagun.family.none.body': 'Nothing from {name} is in the book. Add what they gave you or what you gave them.',
  'shagun.family.net.ahead': 'They’ve given you {amount} more than you’ve given them',
  'shagun.family.net.behind': 'You’ve given them {amount} more than they’ve given you',
  'shagun.family.net.even': 'Even: you’ve given each other the same',
  'shagun.family.history': 'History',
  'shagun.family.add': 'Add an entry',
  'shagun.family.received': 'Gave you {amount}',
  'shagun.family.given': 'You gave {amount}',
  'shagun.family.receivedGift': 'Gave you {gift}',
  'shagun.family.givenGift': 'You gave {gift}',
  'shagun.family.edit.aria': 'Change {what}',
  'shagun.family.delete.aria': 'Delete {what}',
  'shagun.family.deleted': 'Deleted: {what}',

  // Entry sheet
  'shagun.esheet.add': 'Add an entry',
  'shagun.esheet.edit': 'Change the entry',
  'shagun.esheet.function': 'At which function',
  'shagun.esheet.noFunction': 'None',
  'shagun.esheet.date': 'When',
  'shagun.esheet.note': 'Note (optional)',
  'shagun.esheet.save': 'Save',
} as const satisfies Messages
