/** English copy for Settle Day (src/features/settleday): a group’s day of the month to clear everything. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const settleday = {
  // The Tools hub.
  'settleday.tool.title': 'Settle Day',
  'settleday.tool.body': 'One day a month when your group clears everything, with a countdown.',

  // The day in words. `suffix` is st, nd, rd or th.
  'settleday.day.nth': 'the {n}{suffix, select, st {st} nd {nd} rd {rd} other {th}}',
  'settleday.day.last': 'the last day of the month',
  'settleday.every.nth': 'the {n}{suffix, select, st {st} nd {nd} rd {rd} other {th}} of every month',
  'settleday.every.last': 'the last day of every month',
  'settleday.chip.nth': '{n}{suffix, select, st {st} nd {nd} rd {rd} other {th}}',
  'settleday.chip.last': 'Last day',
  'settleday.chip.other': 'Other',
  'settleday.pick.aria': 'Settle day for {name}',
  'settleday.sheet.title': 'Which day of the month?',
  'settleday.sheet.body': 'Days 1 to 28 come round every month. For the month end, pick “Last day”.',
  'settleday.sheet.days.aria': 'Day of the month',

  // The card on the group page.
  'settleday.card.pick.title': 'Pick a settle day',
  'settleday.card.pick.body': 'One day a month when everyone in {name} clears what they owe.',
  'settleday.card.countdown': 'Settle day is {day}: {count, plural, =1 {tomorrow} other {# days to go}}',
  'settleday.card.next': 'Next one: {date}',
  'settleday.card.open': 'Open settle day',
  'settleday.card.today.title': 'Today is settle day',
  'settleday.card.yesterday.title': 'Settle day was yesterday',
  'settleday.card.square': 'Everyone in {name} is square. Nothing to pay.',
  'settleday.card.cta': 'Settle now',
  'settleday.open.pay': 'You pay {amount}. {count, plural, one {# payment clears} other {# payments clear}} {name}.',
  'settleday.open.get': '{amount} is coming to you. {count, plural, one {# payment clears} other {# payments clear}} {name}.',
  'settleday.open.others': '{count, plural, one {# payment between the others clears} other {# payments between the others clear}} {name}.',
  'settleday.set.toast': 'Settle day set: {every}',
  'settleday.remove.cta': 'Remove settle day',
  'settleday.remove.toast': 'Settle day removed for {name}',

  // Home's Today list.
  'settleday.today.title': 'Settle day in {name}',
  'settleday.today.title.yesterday': 'Settle day in {name} was yesterday',
  'settleday.today.pay': 'You pay {amount}. {count, plural, one {# payment} other {# payments}} in all.',
  'settleday.today.get': '{amount} is coming to you. {count, plural, one {# payment} other {# payments}} in all.',
  'settleday.today.others': '{count, plural, one {# payment} other {# payments}} between the others.',

  // The screen.
  'settleday.screen.title': 'Settle day',
  'settleday.screen.intro': 'One day a month when everyone clears what they owe. Pick the day, tell the group, and on the day it’s all on this page.',
  'settleday.screen.sub.waiting': 'On {every}: {count, plural, =1 {tomorrow} other {# days to go}}',
  'settleday.screen.sub.today': 'Today is settle day',
  'settleday.screen.sub.yesterday': 'Settle day was yesterday, and some payments are still open',
  'settleday.change.title': 'The day',
  'settleday.pay.title': 'Yours to pay',
  'settleday.pay.upi': 'Pay by UPI from here, or mark it paid if the money has already moved.',
  'settleday.pay.other': 'Mark each one paid once the money has moved.',
  'settleday.rest.title': 'Everyone else',
  'settleday.rest.body': 'Send a reminder, or mark a payment paid once you know it’s done.',
  'settleday.row.pay': 'Pay',
  'settleday.row.pay.aria': 'Pay {name} {amount}',
  'settleday.row.paid': 'Mark paid',
  'settleday.row.paid.aria': 'Mark paid: {sentence} {amount}',
  'settleday.row.remind': 'Remind',
  'settleday.row.remind.aria': 'Remind {name} about {amount}',
  'settleday.toast.paid': 'Recorded: {sentence} {amount}',
  'settleday.toast.error': 'That payment couldn’t be recorded. Try again.',
  'settleday.done.title': 'Paid today',
  'settleday.square.title': 'Everyone is square',
  'settleday.square.body': 'Nothing to settle in {name} right now.',
  'settleday.square.empty': 'No expenses in {name} yet, so there’s nothing to settle.',

  // A reminder to one person. Names here are the ones other people know (never “You”).
  'settleday.remind.today': 'Hi {from}, today is settle day for {group}. Your part: {amount} to {to}.',
  'settleday.remind.yesterday': 'Hi {from}, settle day for {group} was yesterday. Your part: {amount} to {to}.',
  'settleday.remind.plain': 'Hi {from}, we’re clearing up {group}. Your part: {amount} to {to}.',
  'settleday.remind.me': 'me',
  'settleday.remind.there': 'there',
  'settleday.remind.upi': 'UPI ID for {to}: {upi}',
  'settleday.remind.upi.mine': 'My UPI ID: {upi}',
  'settleday.remind.title': 'Reminder for {name}',
  'settleday.remind.copied': 'Reminder copied. Paste it in your chat with {name}.',
  'settleday.share.failed': 'Couldn’t share that. Try again.',

  // The message to the whole group.
  'settleday.tell.title': 'Tell the group',
  'settleday.tell.body': 'The day is saved on this phone only. Send this once so everyone knows it.',
  'settleday.tell.cta': 'Tell the group',
  'settleday.tell.copied': 'Message copied. Paste it in the group chat.',
  'settleday.tell.message': 'Our settle day for {group} is {every}. On that day everyone clears what they owe in the group.',
  'settleday.tell.next': 'Next one: {date}.',
  'settleday.tell.today': 'That’s today.',
  'settleday.tell.open': 'To settle today:',
  'settleday.tell.open.yesterday': 'It was yesterday. Still open:',
  'settleday.tell.line': '{from} pays {to} {amount}',
  'settleday.tell.more': 'and {count, plural, one {# more payment} other {# more payments}}',
  'settleday.tell.square': 'Right now everyone is square.',

  // The calendar file.
  'settleday.cal.cta': 'Add to calendar',
  'settleday.cal.body': 'A calendar entry that repeats every month. Settle can’t alert you while it’s closed. Your calendar can.',
  'settleday.cal.summary': 'Settle day: {group}',
  'settleday.cal.description': 'Clear what everyone owes in {group}. Open Settle to see who pays whom.',
  'settleday.cal.saved': 'Calendar file saved. Open it to add settle day to your calendar.',
  'settleday.cal.failed': 'Couldn’t make the calendar file. Try again.',
} satisfies Messages
