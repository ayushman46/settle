/** English copy for Why this payment? (src/features/why): Settle up explains each line; pay only who you actually owe. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const why = {
  // Tools hub
  'why.tool.title': 'Why this payment?',
  'why.tool.body': 'Every Settle up payment explains itself. Or pay only the people you directly owe.',

  // Under each payment on Settle up
  'why.button': 'Why?',
  'why.title.fromYou': 'Why you pay {to} {amount}',
  'why.title.toYou': 'Why {from} pays you {amount}',
  'why.title': 'Why {from} pays {to} {amount}',

  // The sheet
  'why.head.payer.you': 'Why you owe',
  'why.head.payer': 'Why {name} owes',
  'why.head.receiver.you': 'Why you’re owed',
  'why.head.receiver': 'Why {name} is owed',
  'why.head.link': 'Why it goes to {to}',
  'why.head.pair.you': 'Between the two of you',
  'why.head.pair': 'Between {from} and {to}',
  'why.head.bills': 'Where the {amount} comes from',
  'why.bills.more': '{count, plural, one {and # more bill: {amount}} other {and # more bills: {amount}}}',
  'why.bills.untitled': 'A bill',
  'why.note': 'Worked out from this group’s expenses and recorded payments.',
  'why.note.pair': 'Only what’s between these two is counted. Nobody else’s debts are mixed in.',

  // Whoever pays: only bills so far
  'why.payer.simple.you': 'In this group you’ve had {had} of things and paid {paid}, so you’re {short} short.',
  'why.payer.simple': 'In this group {name} has had {had} of things and paid {paid}, so {name} is {short} short.',
  'why.payer.simple.none.you': 'In this group you’ve had {had} of things and haven’t paid any of the bills, so you’re {short} short.',
  'why.payer.simple.none': 'In this group {name} has had {had} of things and hasn’t paid any of the bills, so {name} is {short} short.',
  // Whoever is paid: only bills so far
  'why.receiver.simple.you': 'In this group you’ve paid {paid} of bills and had {had} of things yourself, so you’re owed {over}.',
  'why.receiver.simple': 'In this group {name} has paid {paid} of bills and had {had} of things, so {name} is owed {over}.',
  'why.receiver.simple.none.you': 'In this group you’ve paid {paid} of bills, all for other people, so you’re owed {over}.',
  'why.receiver.simple.none': 'In this group {name} has paid {paid} of bills, all for other people, so {name} is owed {over}.',

  // Either side, when there are loans or payments too: one fact a sentence, then what it leaves
  'why.side.both.you': 'In this group you’ve had {had} of things and paid {paid} of bills.',
  'why.side.both': 'In this group {name} has had {had} of things and paid {paid} of bills.',
  'why.side.had.you': 'In this group you’ve had {had} of things and haven’t paid any of the bills.',
  'why.side.had': 'In this group {name} has had {had} of things and hasn’t paid any of the bills.',
  'why.side.paid.you': 'In this group you’ve paid {paid} of bills, all for other people.',
  'why.side.paid': 'In this group {name} has paid {paid} of bills, all for other people.',
  'why.side.borrowed.you': 'You’ve borrowed {amount} in this group.',
  'why.side.borrowed': '{name} has borrowed {amount} in this group.',
  'why.side.lent.you': 'You’ve lent {amount} in this group.',
  'why.side.lent': '{name} has lent {amount} in this group.',
  'why.side.sent.you': 'Payments you’ve made so far: {amount}.',
  'why.side.sent': 'Payments {name} has made so far: {amount}.',
  'why.side.received.you': 'Payments you’ve got so far: {amount}.',
  'why.side.received': 'Payments {name} has got so far: {amount}.',
  'why.payer.so.you': 'That leaves you {short} short.',
  'why.payer.so': 'That leaves {name} {short} short.',
  'why.receiver.so.you': 'That leaves you owed {over}.',
  'why.receiver.so': 'That leaves {name} owed {over}.',
  'why.payer.bare.you': 'Across this group’s expenses and payments, you’re {short} short.',
  'why.payer.bare': 'Across this group’s expenses and payments, {name} is {short} short.',
  'why.receiver.bare.you': 'Across this group’s expenses and payments, you’re owed {over}.',
  'why.receiver.bare': 'Across this group’s expenses and payments, {name} is owed {over}.',
  'why.payer.part': '{amount} of that goes to {to}.',
  'why.receiver.part': '{amount} of that comes from {from}.',

  // One debt between two people
  'why.owes.fromYou': 'You owe {to} {amount}.',
  'why.owes.toYou': '{from} owes you {amount}.',
  'why.owes': '{from} owes {to} {amount}.',
  'why.list.and': '{first} and {last}',

  // Why this payment goes to this person
  'why.link.direct.fromYou': 'Between just the two of you, you owe {to} {amount}.',
  'why.link.direct.toYou': 'Between just the two of you, {from} owes you {amount}.',
  'why.link.direct': 'Between just the two of them, {from} owes {to} {amount}.',
  'why.link.direct.same': 'This payment is exactly that.',
  'why.link.direct.less': 'Settling the whole group together brings this payment down to {amount}.',
  'why.chain.so': 'So {amount} goes straight from {from} to {to}, skipping {skipped}.',
  'why.chain.so.clean':
    'So {amount} goes straight from {from} to {to}, skipping {skipped}: {count, plural, =2 {two payments become one} =3 {three payments become one} other {# payments become one}}.',
  'why.link.rest': 'The other {amount} comes from the rest of the group’s debts, settled together.',
  'why.link.general.fewer': 'A payment straight from {from} to {to} settles the same money in fewer payments: {simple} for the group instead of {direct}.',
  'why.link.general': 'A payment straight from {from} to {to} settles the same money for everyone.',
  'why.link.count': 'Settled this way, the group needs {simple, plural, one {# payment} other {# payments}} instead of {direct}.',

  // Pay only people I actually owe: what is between two people
  'why.pair.paidFor': '{payer} paid {amount} for things {haver} had.',
  'why.pair.lent': '{lender} lent {borrower} {amount}.',
  'why.pair.payments': 'Payments so far from {from} to {to}: {amount}.',
  'why.pair.so.fromYou': 'So you owe {to} {amount}.',
  'why.pair.so': 'So {from} owes {to} {amount}.',
  'why.pair.bare.fromYou': 'Counting only the bills and payments between the two of you, you owe {to} {amount}.',
  'why.pair.bare': 'Counting only the bills and payments between these two, {from} owes {to} {amount}.',
  'why.pair.net': 'Counting only what’s between these two, the debt is {amount}.',
  'why.pair.loop': '{amount} of it goes round in a circle of debts ({route}), so it cancels out and nobody pays it.',
  'why.pair.loops': '{amount} of it goes round in circles of debts within the group, so it cancels out and nobody pays it.',
  'why.pair.left': 'That leaves {amount} for {from} to pay {to}.',

  // The switch on Settle up
  'why.direct.label': 'Pay only people I actually owe',
  'why.direct.compare': '{direct, plural, one {# payment} other {# payments}} instead of {simple}',
  'why.direct.compare.same': '{count, plural, one {# payment} other {# payments}} either way',
  'why.direct.off': 'Turn on so nobody pays someone they don’t directly owe: {compare}.',
  'why.direct.on': 'Each payment goes to someone the payer directly owes: {compare}. Nobody ends up paying more or getting less overall.',
  'why.direct.on.same': 'Each payment goes to someone the payer directly owes. Right now that’s the same payments either way.',
  'why.direct.subtitle':
    '{count, plural, one {# payment squares everyone up, to someone directly owed.} other {# payments square everyone up, each to someone directly owed.}}',
} satisfies Messages
