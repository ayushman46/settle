/** English copy for Udhaar limit (src/features/limit): a ceiling per friend. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const limit = {
  // Tools hub
  'limit.tool.title': 'Udhaar limit',
  'limit.tool.body': 'Set the most a friend can owe you. Settle speaks up before a split crosses it',

  // The limits screen
  'limit.title': 'Udhaar limit',
  'limit.subtitle': 'Udhaar is what friends owe you. Pick the most you’re comfortable with, and Settle tells you before a split crosses it. It never stops you.',
  'limit.everyone.title': 'A limit for everyone',
  'limit.everyone.body': 'Used for anyone who doesn’t have a limit of their own.',
  'limit.people.title': 'Your people',
  'limit.people.owes': 'Owes you {owed}',
  'limit.people.nothing': 'Owes you nothing',
  'limit.people.limit': 'limit {amount}',
  'limit.people.limit.everyone': 'limit {amount}, as for everyone',
  'limit.people.noLimit': 'no limit',
  'limit.people.line': '{owes} · {limit}',
  'limit.empty.title': 'Nobody to set a limit for yet',
  'limit.empty.text': 'Add the people you split with. Then pick the most each can owe you, and Settle tells you before a split goes over.',
  'limit.empty.cta': 'Add people',

  // One person’s row
  'limit.row.aria': 'Udhaar limit for {name}',
  'limit.row.title': 'Udhaar limit',
  'limit.row.body': 'The most you’re comfortable with {name} owing you. Settle tells you before a split crosses it. It never stops you.',
  'limit.pick.aria': 'Limit for {name}',
  'limit.pick.everyone.aria': 'Limit for everyone',
  'limit.pick.other': 'Other',
  'limit.pick.other.set': 'Other: {amount}',
  'limit.pick.everyone': 'As for everyone: {amount}',
  'limit.pick.none': 'None',
  'limit.other.label': 'Your own amount',
  'limit.other.save': 'Set limit',
  'limit.other.error': 'Type an amount above zero.',
  'limit.status.everyone': 'Using your limit for everyone, {amount}.',
  'limit.status.over': '{name} owes you {owed} now: {over} over the limit.',
  'limit.status.within': '{name} owes you {owed} now: {left} to go before the limit.',
  'limit.status.at': '{name} owes you {owed} now: right at the limit.',
  'limit.status.nothing': '{name} owes you nothing right now.',

  // Toasts
  'limit.toast.set': 'Limit for {name}: {amount}',
  'limit.toast.none': 'No limit for {name}',
  'limit.toast.everyone.back': '{name} follows your limit for everyone',
  'limit.toast.everyone.set': 'Limit for everyone: {amount}',
  'limit.toast.everyone.none': 'No limit for everyone',

  // The note on a new expense
  'limit.note.title': '{count, plural, one {Over a limit you set} other {Over limits you set}}',
  'limit.note.crosses': 'This takes {name} to {after} owed to you, over the {limit} you set.',
  'limit.note.crosses.everyone': 'This takes {name} to {after} owed to you, over the {limit} you set for everyone.',
  'limit.note.already': '{name} already owes you {before}, over the {limit} you set. This makes it {after}.',
  'limit.note.already.everyone': '{name} already owes you {before}, over the {limit} you set for everyone. This makes it {after}.',
  'limit.note.more': '{count, plural, one {And # more person.} other {And # more people.}}',
  'limit.note.fine': 'You can still save it.',

  // The badge in To collect
  'limit.badge': 'Over your {limit} limit',
} satisfies Messages
