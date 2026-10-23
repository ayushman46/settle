/** English copy for the split screen (src/features/split). Keys: `split.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const split = {
  // `/app/split/:id/edit` when the expense no longer exists.
  'split.gone.title': 'This expense is gone',
  'split.gone.subtitle': 'It may have been deleted — on this phone or in another tab.',
  'split.gone.cta': 'See activity',

  // The screen's title, heading and tab title.
  'split.screen.new.title': 'New split',
  'split.screen.edit.title': 'Edit split',
  'split.screen.edit.heading': 'Edit {title}',
  // The browser tab while editing: "Edit Dinner at Toit · Settle".
  'split.screen.edit.docTitle': 'Edit {title} · {brand}',
  'split.save.new.cta': 'Save split',
  'split.save.cta': 'Save changes',
  'split.currency.toast': 'Now in {code}',
  'split.undo.cta': 'Undo',
  'split.saved.title': 'Split saved',

  // The amount and the details.
  'split.amount.label': 'Amount',
  'split.amount.itemized.label': 'Total paid',
  'split.amount.itemized.hint': 'Tax, tips and discounts are spread over the items again.',
  'split.title.label': "What's it for?",
  // Under the details when the group keeps balances in another currency.
  'split.groupCurrency.note': 'In {currency}, so it’s settled person to person — not in {group}’s {groupCurrency} balances.',

  // The trip tip (travel without a group).
  'split.tip.trip.title': 'Splitting a whole trip?',
  'split.tip.trip.body': 'Put it in a group: every expense adds up, and {brand} works out the fewest payments at the end.',
  'split.tip.trip.cta': 'Start a trip group',
  'split.tip.trip.dismiss': 'Just this once',
  // The rent tip.
  'split.tip.rent.cta': 'Split by %',
  'split.tip.rent.body': 'Rooms of different sizes? Rent is often fairer split by percentage.',

  // Sections.
  'split.section.items.title': 'Split item by item',
  'split.section.people.title': 'Split with',
  'split.section.how.title': 'How to split',

  // An itemized bill being edited or copied.
  'split.bill.line': '{items, plural, one {# item} other {# items}} · {people, plural, one {# person} other {# people}}',
  'split.bill.editing.body': 'Who had what stays as it is. To change it, open the bill.',
  'split.bill.copy.body': 'The same items and people as the original — change who had what after saving.',
  'split.bill.change.cta': 'Change who had what',

  // Discard confirm.
  'split.discard.new.title': 'Discard this split?',
  'split.discard.title': 'Discard changes?',
  'split.discard.new.description': 'What you’ve entered won’t be saved.',
  'split.discard.description': 'Your changes to {title} won’t be saved.',
  'split.discard.cta': 'Discard',
  'split.keep.cta': 'Keep editing',

  // Where a prefilled split came from.
  'split.origin.describe.title': 'Filled in from what you typed',
  'split.origin.scan.title': 'Filled in from your bill',
  'split.origin.scan.body': 'Check the amount — AI can misread a blurry photo.',
  'split.origin.recurring.title': 'This month’s {title}',
  'split.origin.recurring.untitled': 'From a recurring split',
  'split.origin.recurring.body': 'Check it, then save to start collecting.',
  'split.origin.duplicate.title': 'A copy of {title}',
  'split.origin.duplicate.untitled': 'A copy',
  'split.origin.duplicate.body': 'Dated today, and nobody is marked as paid yet.',
  'split.origin.sms.title': 'Filled in from your SMS',
  'split.origin.sms.body': 'Add who’s in, check it, then save.',
  'split.origin.voice.title': 'Filled in from what you said',
  'split.origin.rotation.title': 'The next round',
  // Body for "what you typed", "what you said" and the next round.
  'split.origin.check.body': 'Check the amount and who’s in, then save.',

  // The note field.
  'split.note.label': 'Note',
  'split.note.placeholder': 'Anything to remember — optional',
  'split.note.full': 'That’s the limit',
  'split.note.left': '{count} left',

  // What saving means (Save's hint) and what it means once saved (the success moment).
  'split.outcome.nothingToCollect': 'Nothing to collect — it’s all on you.',
  'split.outcome.one.future': '{name} will owe you {amount}',
  'split.outcome.one.now': '{name} owes you {amount}',
  // {names}: "Riya and Sam", "Riya, Sam and Ali".
  'split.outcome.each.future': '{names} will owe you {amount} each',
  'split.outcome.each.now': '{names} owe you {amount} each',
  'split.outcome.inAll.future': 'You’ll get back {amount} from {names}',
  'split.outcome.inAll.now': '{names} owe you {amount} in all',
  'split.outcome.many.future': 'You’ll get back {amount} from {count} people',
  'split.outcome.many.now': '{count} people owe you {amount}',
  'split.outcome.owe.future': 'You’ll owe {name} {amount}',
  'split.outcome.owe.now': 'You owe {name} {amount}',
  'split.outcome.nothingToPay': 'Nothing to pay back.',
  'split.outcome.getsBack.future': '{name} will get back {amount}',
  'split.outcome.getsBack.now': '{name} gets back {amount}',

  // After saving an edit.
  'split.changes.toast': 'Changes saved',
  'split.changes.meAgain.toast': 'Changes saved. You owe more now, so you’re marked as not paid yet.',
  'split.changes.othersAgain.toast':
    '{count, plural, one {Changes saved. {names} owes more now, so they’re marked as not paid yet.} other {Changes saved. {names} owe more now, so they’re marked as not paid yet.}}',

  // Quick starts: the title field's examples per category (and the title a rent split starts with).
  'split.placeholder.food': 'Dinner at Toit, Swiggy order…',
  'split.placeholder.groceries': 'Blinkit, DMart, weekly veggies…',
  'split.placeholder.rent': 'Rent, maintenance, deposit…',
  'split.placeholder.utilities': 'Electricity, Wi-Fi, gas cylinder…',
  'split.placeholder.travel': 'Flights, hotel, Goa trip…',
  'split.placeholder.transport': 'Uber to the airport, fuel…',
  'split.placeholder.shopping': 'Amazon order, new curtains…',
  'split.placeholder.entertainment': 'Movie tickets, concert…',
  'split.placeholder.subscription': 'Netflix, Spotify, YouTube Premium…',
  'split.placeholder.gift': 'Birthday gift for Neha…',
  'split.placeholder.health': 'Pharmacy, doctor’s visit…',
  'split.placeholder.other': 'Dinner, rent, cab, Netflix…',
  'split.template.rent.title': 'Rent',
} as const satisfies Messages
