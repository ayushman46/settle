/** English copy for share texts and cards (src/share). Keys: `share.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const share = {
  // Category names, in the app and on everything that leaves it (pay links, cards, summaries).
  'share.category.food': 'Food & drinks',
  'share.category.groceries': 'Groceries',
  'share.category.rent': 'Rent',
  'share.category.utilities': 'Bills & utilities',
  'share.category.travel': 'Travel & stays',
  'share.category.transport': 'Transport',
  'share.category.shopping': 'Shopping',
  'share.category.entertainment': 'Entertainment',
  'share.category.subscription': 'Subscriptions',
  'share.category.gift': 'Gifts',
  'share.category.health': 'Health',
  'share.category.other': 'Other',

  // Reminder ("nudge") tones.
  'share.nudge.tone.friendly': 'Friendly',
  'share.nudge.tone.funny': 'Funny',
  'share.nudge.tone.firm': 'Firm',
  // Reminder wordings, sent to the friend in the sender's language. `{to}` is their first name,
  // `{amount}` the money, `{what}` what it was for. Keep the same number of wordings per tone.
  'share.nudge.friendly.0': 'Hey {to}! 👋 Just a gentle reminder: your share for {what} is {amount}. No rush!',
  'share.nudge.friendly.1': 'Hi {to} 🙂 Your share for {what} comes to {amount}. Settle whenever you get a sec!',
  'share.nudge.friendly.2': "Hey {to}, hope you're doing well! Quick one: {amount} for {what}. Thanks a ton 🙏",
  'share.nudge.friendly.3': '{to}! A small nudge for {what}: your bit is {amount}. Thank you 😊',
  'share.nudge.funny.0': "Knock knock, {to} 🚪 Who's there? {amount}. {amount} who? {amount} for {what} 😄",
  'share.nudge.funny.1': 'Breaking news 📰 {amount} for {what} was last seen heading your way, {to}. Help it find its way home 🏠',
  'share.nudge.funny.2': "{to}, my wallet keeps asking about you 👀 {amount} for {what}, whenever you're ready!",
  'share.nudge.funny.3': "Plot twist, {to}: {what} wasn't free 🍿 Your share is {amount} 😅",
  'share.nudge.firm.0': 'Hi {to}, a reminder that {amount} for {what} is still pending. Please settle it today.',
  'share.nudge.firm.1': 'Hi {to}, your share of {amount} for {what} is due. Please pay at the earliest.',
  'share.nudge.firm.2': '{to}, following up on {amount} for {what}. Could you clear it today, please?',
  // The words before the pay link at the end of a reminder ("Tap to pay: https://…").
  'share.nudge.link.friendly': 'Tap to pay',
  'share.nudge.link.funny': "One tap and we're square",
  'share.nudge.link.firm': 'Pay here',
  // The UPI line of a reminder.
  'share.nudge.upi.mine': 'My UPI: {upi}',
  'share.nudge.upi': 'Pay {name} on UPI: {upi}',
  // Greeting when there's no name ("Hey there!"), and what it was for when there's no title.
  'share.nudge.there': 'there',
  'share.nudge.ourSplit': 'our split',

  // A UPI payment request sent from the pay sheet (then "Pay Riya on UPI: …" and the link).
  'share.upiRequest.for': 'Hi {name}, your share for {merchant} is {amount}.',
  'share.upiRequest.bill': 'Hi {name}, your share of the bill is {amount}.',

  // The full text summary of a split ("Copy text").
  'share.summary.total': 'Total {amount}',
  'share.summary.totalSplit': 'Total {amount} · split {count, plural, one {# way} other {# ways}}',
  // After the payer's amount: "Ayush   ₹691.50 · paid the bill".
  'share.summary.paidTheBill': 'paid the bill',
  'share.summary.payUpi': 'Pay {name} on UPI: {upi}',
  'share.summary.payTap': 'Pay in a tap: {link}',
  'share.summary.footer': '— split with {brand}',

  // The short message that carries a pay link into the group chat. 🧾 starts the first line.
  'share.message.settled': '🧾 {title} · all settled up ✓',
  'share.message.total': '🧾 {title} · {amount}',
  'share.message.split': '🧾 {title} · {amount} split {count} ways',
  'share.message.see': 'See the split 👇',
  'share.message.payMe': 'Tap your name to pay me with any UPI app 👇',
  'share.message.pay': 'Tap your name to pay {name} with any UPI app 👇',
  'share.message.seeShare': 'Tap your name to see your share 👇',
  'share.message.yourShare': 'Hi {name}! Your share of {title} is {amount} 🧾',
  'share.message.oneTapMe': 'Pay me with any UPI app — your exact share is on the page 👇',
  'share.message.oneTap': 'Pay {name} with any UPI app — your exact share is on the page 👇',
  'share.message.seeYours': 'See your share 👇',

  // The share card image of a split (drawn in the sender's language).
  'share.card.morePeople': '{count, plural, one {# more person} other {# more people}}',
  'share.card.paidBy': 'Paid by {name}',
  'share.card.splitWays': 'split {count, plural, one {# way} other {# ways}}',
  'share.card.status.payer': 'Paid the bill',
  'share.card.status.paid': 'Paid back',
  'share.card.status.owes': 'Yet to pay',
  'share.card.status.zero': 'Nothing to pay',
  'share.card.paidCount': '{paid} of {count} paid',
  'share.card.allSettled': 'All settled up',
  'share.card.collected': '{collected} of {owed} collected',
  'share.card.madeWith': 'Made with {brand}',
  // Names when there's nothing better to show (the owner, a removed friend).
  'share.card.me': 'Me',
  'share.card.friend': 'Friend',
  // The group summary card.
  'share.card.kind.trip': 'Trip',
  'share.card.kind.home': 'Home',
  'share.card.kind.couple': 'Couple',
  'share.card.kind.event': 'Event',
  'share.card.kind.other': 'Group',
  'share.card.someone': 'Someone',
  'share.card.someone.object': 'someone',
  'share.card.pays': '{from} pays {to}',
  'share.card.people': '{count, plural, one {# person} other {# people}}',
  'share.card.expenses': '{count, plural, one {# expense} other {# expenses}}',
  'share.card.totalSpent': 'Total spent',
  'share.card.settled': "Everyone's settled up",
  'share.card.settled.body': 'No payments needed',
  'share.card.empty': 'Nothing to settle yet',
  'share.card.empty.body': 'No expenses so far',
  'share.card.payments': '{count, plural, one {# payment} other {# payments}}',
  'share.card.toSettle': 'To settle up',
  'share.card.morePayments': '{count, plural, one {# more payment} other {# more payments}}',

  // Names used when a person never gave one (share/fallbacks.ts): the organiser or payee, a numbered person, anyone unnamed.
  'share.fallback.friend': 'Your friend',
  'share.fallback.person': 'Person {n}',
  'share.fallback.someone': 'Someone',
  // The note on a UPI payment that has no title (it shows in the payer's UPI app).
  'share.upi.note': 'Bill split',
  // Why a share card image couldn't be made.
  'share.card.error.canvas': "This browser can't draw images",
  'share.card.error.render': "Couldn't create the image",
} as const satisfies Messages
