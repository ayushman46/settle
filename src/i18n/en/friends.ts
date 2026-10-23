/** English copy for people (src/features/friends). Keys: `friends.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const friends = {
  // The people list (`/app/friends`).
  'friends.list.title': 'People',
  'friends.list.subtitle': 'Everyone you split with — they don’t need the app.',
  'friends.list.empty.title': 'No people yet',
  'friends.list.empty.body': 'Add the friends you split with. A name is enough — a UPI ID makes paying them a tap.',
  'friends.list.empty.cta': 'Add a person',
  'friends.list.search.label': 'Search people',
  'friends.list.search.placeholder': 'Search by name',
  'friends.list.search.clear.aria': 'Clear search',
  'friends.list.results.aria': 'Search results',
  'friends.list.all.aria': 'Your people',
  // A row that adds what was searched for as a new person.
  'friends.list.add.title': 'Add “{name}”',
  'friends.list.add.subtitle': 'New to your people',
  'friends.list.none': 'No one called “{query}”.',
  'friends.list.count': '{count, plural, one {# person} other {# people}}',
  'friends.list.add.cta': 'Add person',
  // Under each name: where you stand (or their UPI ID when square).
  'friends.line.owesYou': 'owes you {amount}',
  'friends.line.youOwe': 'you owe {amount}',
  'friends.line.settled': 'settled up',

  // Add or edit a person.
  'friends.form.add.title': 'Add a person',
  'friends.form.edit.title': 'Edit {name}',
  'friends.form.add.description': 'They don’t need the app — just a name to split with.',
  'friends.form.add.cta': 'Add person',
  'friends.form.saved.toast': 'Saved',
  'friends.form.added.toast': '{name} added',
  'friends.form.name.label': 'Name',
  // An example name in the empty name field.
  'friends.form.name.placeholder': 'Riya',
  'friends.form.name.taken': '{name} is already in your people.',
  'friends.form.upi.label': 'UPI ID',
  'friends.form.upi.hint': 'Optional — so they can be paid in a tap.',
  'friends.form.phone.label': 'Phone',
  'friends.form.phone.hint': 'Optional — for WhatsApp and SMS reminders.',
  'friends.form.phone.error': 'That doesn’t look like a phone number. Use 7 to 15 digits, like 98765 43210.',
  'friends.form.color.label': 'Avatar colour',
  'friends.color.peach': 'Peach',
  'friends.color.mint': 'Mint',
  'friends.color.sky': 'Sky',
  'friends.color.lilac': 'Lilac',
  'friends.color.lemon': 'Lemon',
  'friends.color.rose': 'Rose',
  'friends.color.teal': 'Teal',
  'friends.color.sand': 'Sand',

  // One person (`/app/friends/:id`).
  'friends.gone.title': 'This person isn’t here',
  'friends.gone.subtitle': 'They may have been removed — on this phone or in another tab.',
  'friends.gone.cta': 'See your people',
  'friends.detail.edit.aria': 'Edit {name}',
  'friends.detail.split.cta': 'Split with {name}',
  'friends.detail.upi.aria': 'UPI ID {upi}. Copy',
  'friends.detail.upi.add': 'Add UPI ID',
  'friends.detail.upi.copied.toast': 'UPI ID copied',
  'friends.detail.upi.copy.error': 'Couldn’t copy. Long-press the UPI ID to copy it.',
  'friends.detail.call.aria': 'Call {name} on {phone}',
  'friends.detail.groups.title': 'Groups together',
  'friends.detail.expenses.title': 'Expenses with {name}',
  'friends.detail.expenses.empty.title': 'Nothing split yet',
  'friends.detail.expenses.empty.body': 'Split a bill, a cab or the rent with {name} — it shows up here.',
  'friends.detail.expenses.fewer.cta': 'Show fewer',
  'friends.detail.expenses.all.cta': 'Show all {count}',
  'friends.detail.remove.cta': 'Remove from your people',
  'friends.detail.removed.toast': '{name} removed from your people',
  // "Someone" is what past splits call a removed person.
  'friends.remove.title': 'Remove {name}?',
  'friends.remove.body': '{name} leaves your people and any groups. Past splits stay, showing them as “Someone”.',
  'friends.remove.cta': 'Remove {name}',
  'friends.remove.keep.cta': 'Keep {name}',
  'friends.blocked.title': '{name} can’t be removed yet',
  'friends.blocked.ok.cta': 'OK',

  // Where I stand with them.
  'friends.standing.square': 'You and {name} are square',
  'friends.standing.owesYou': '{name} owes you',
  'friends.standing.youOwe': 'You owe {name}',
  // Other currencies under the amount: "Also owes you $20 · you owe €5".
  'friends.standing.also': 'Also {list}',
  'friends.standing.nothing': 'Nothing to settle — nice.',
  'friends.standing.remind.cta': 'Remind',
  'friends.standing.pay.cta': 'Pay via UPI',
  'friends.settle.cta': 'Settle up',
  'friends.allSquare': 'All square with {name}',
  'friends.allSquare.subtitle': 'Nothing left to settle.',

  // Where the money comes from: each shared group, and splits outside groups.
  'friends.sources.title': 'Where it’s from',
  'friends.sources.splits': '{count, plural, one {# split} other {# splits}} outside groups',
  'friends.sources.paysYou': '{name} pays you',
  'friends.sources.youPay': 'You pay {name}',
  'friends.sources.even': 'Evens out',
  // What a reminder is for when it covers several splits ("for our splits").
  'friends.sources.ourSplits': 'our splits',

  // Settle up with one person.
  'friends.settle.title': 'Settle up with {name}',
  'friends.settle.owesYou': '{name} owes you {amount} in all.',
  'friends.settle.youOwe': 'You owe {name} {amount} in all.',
  'friends.settle.square': 'You and {name} are square.',
  'friends.settle.all.cta': 'Settle everything',
  'friends.settle.inGroup.aria': 'Settle up in {name}',
  'friends.settle.inGroup.cta': 'Settle in group',
  'friends.settle.mark.cta': 'Mark as settled',
  'friends.settle.marked.toast': '{count, plural, one {# split marked as settled} other {# splits marked as settled}}',

  // Why someone can't be removed yet. {groups} is a list of group names.
  'friends.blocked.money': '{name} still has money to settle.',
  'friends.blocked.money.groups': '{name} still has money to settle in {groups}.',
  'friends.blocked.money.splits': '{name} still has money to settle on {count, plural, one {# split} other {# splits}} outside groups.',
  'friends.blocked.money.both': '{name} still has money to settle in {groups} and on {count, plural, one {# split} other {# splits}} outside groups.',
  // {titles}: the recurring splits' names, in quotes.
  'friends.blocked.recurring': '{name} is in your recurring {count, plural, one {split} other {splits}} {titles}.',
  'friends.blocked.settleFirst': 'Settle up first, then they can go.',
  'friends.blocked.takeOut': 'Take them out of it first, then they can go.',
} as const satisfies Messages
