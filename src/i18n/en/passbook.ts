/** English copy for Statement (src/features/passbook): a passbook between you and a friend. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const passbook = {
  // Tools hub
  'passbook.tool.title': 'Statement',
  'passbook.tool.body': 'Every bill and payment between you and a friend, with a running balance',

  // The screen
  'passbook.title': 'Statement',
  'passbook.subtitle': 'Every bill and payment between you and {name}, oldest first, like a bank passbook.',
  'passbook.range.aria': 'Dates',
  'passbook.range.month': 'This month',
  'passbook.range.three': '3 months',
  'passbook.range.all': 'All',
  'passbook.period.all': 'Everything till {to}',
  'passbook.period.from': '{from} to {to}',
  'passbook.currency.heading': 'In {currency}',
  'passbook.ledger.aria': 'Statement in {currency}',
  'passbook.entries.aria': 'Entries, oldest first',

  // Opening and closing
  'passbook.opening': 'Opening balance',
  'passbook.opening.earlier': '{count, plural, one {From # earlier entry} other {From # earlier entries}}',
  'passbook.closing': 'Closing balance',
  'passbook.closing.matches': 'The same as on {name}’s page',
  'passbook.balance.owesYou': '{name} owes you {amount}',
  'passbook.balance.youOwe': 'You owe {name} {amount}',
  'passbook.balance.square': 'All square',
  'passbook.run.owesYou': 'Owes you {amount}',
  'passbook.run.youOwe': 'You owe {amount}',

  // What a line is
  'passbook.kind.paidForThem': 'You paid for {name}',
  'passbook.kind.paidForYou': '{name} paid for you',
  'passbook.kind.lent': 'You lent {name}',
  'passbook.kind.borrowed': 'You borrowed from {name}',
  'passbook.kind.theyPaid': '{name} paid you',
  'passbook.kind.theyPaid.part': '{name} paid you a part',
  'passbook.kind.youPaid': 'You paid {name}',
  'passbook.kind.youPaid.part': 'You paid {name} a part',
  'passbook.kind.group': 'Settled as a group',
  'passbook.what.payment': 'Payment',
  'passbook.what.payment.for': 'Payment for {title}',
  'passbook.row.in': '{kind} · {group}',
  'passbook.group.note':
    '{group} settles as a group, in the fewest payments, so someone else there pays or is paid part of this. That line makes the total the same as on {name}’s page.',
  'passbook.none.inDates': 'Nothing in these dates.',

  // Outside the app, by name
  'passbook.out.paidForThem': '{me} paid for {name}',
  'passbook.out.paidForYou': '{name} paid for {me}',
  'passbook.out.lent': '{me} lent {name}',
  'passbook.out.borrowed': '{me} borrowed from {name}',
  'passbook.out.theyPaid': '{name} paid {me}',
  'passbook.out.theyPaid.part': '{name} paid {me} a part',
  'passbook.out.youPaid': '{me} paid {name}',
  'passbook.out.youPaid.part': '{me} paid {name} a part',
  'passbook.out.owes': '{who} owes {whom} {amount}',

  // Share, print, spreadsheet
  'passbook.share': 'Share as text',
  'passbook.share.title': 'Statement: {me} and {name}',
  'passbook.share.title.you': 'My statement with {name}',
  'passbook.share.cut': '{count, plural, one {The # entry before these is in the opening balance.} other {The # entries before these are in the opening balance.}}',
  'passbook.share.made': 'Made with {app}',
  'passbook.share.copied': 'Statement copied. Paste it in a chat.',
  'passbook.share.failed': 'Couldn’t share the statement. Try again.',
  'passbook.print': 'Print or save as PDF',
  'passbook.csv': 'Download spreadsheet',
  'passbook.csv.busy': 'Making the file',
  'passbook.csv.saved': 'Statement saved as a spreadsheet',
  'passbook.csv.shared': 'Statement shared as a spreadsheet',
  'passbook.csv.failed': 'Couldn’t save the file. Try again.',

  // The printed sheet
  'passbook.doc.title': 'Statement',
  'passbook.doc.between': 'Between',
  'passbook.doc.between.names': '{me} and {name}',
  'passbook.doc.between.you': '{name} and the holder of this statement',
  'passbook.doc.madeOn': 'Made on',
  'passbook.doc.date': 'Date',
  'passbook.doc.details': 'Details',
  'passbook.doc.gave': '{me} gave',
  'passbook.doc.got': '{me} got',
  'passbook.doc.gave.you': 'Gave',
  'passbook.doc.got.you': 'Got',
  'passbook.doc.balance': 'Balance',
  'passbook.doc.note': 'A record kept by one of the two, not a bank statement.',

  // Nothing yet
  'passbook.empty.title': 'No entries with {name} yet',
  'passbook.empty.text': 'Split a bill with {name}, or write down udhaar, and it shows up here by itself: every line, and what’s owed after it.',
  'passbook.empty.cta': 'Split something with {name}',
  'passbook.gone.title': 'No statement to show',
  'passbook.gone.text': 'This person isn’t in your people any more, and there is nothing between you.',
  'passbook.gone.cta': 'See your people',

  // The row on a person’s page
  'passbook.link.title': 'Statement',
  'passbook.link.body': '{count, plural, one {# entry} other {# entries}}, with the balance after each',
} satisfies Messages
