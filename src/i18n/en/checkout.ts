/** English copy for Settle before you leave (src/features/checkout): a trip’s last-day checklist. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const checkout = {
  // The Tools hub.
  'checkout.tool.title': 'Settle before you leave',
  'checkout.tool.body': 'Last day of the trip: who pays whom, a QR for each, a tick when it’s done.',

  // The way in, on the group page.
  'checkout.link.title': 'Settle before you leave',
  'checkout.link.body': '{count, plural, one {# payment} other {# payments}} and everyone is square.',

  // The checklist.
  'checkout.title': 'Settle before you leave',
  'checkout.sub.open': '{count, plural, one {# payment} other {# payments}} and everyone is square.',
  'checkout.sub.some': '{paid} of {total} paid. {count, plural, one {# more payment} other {# more payments}} and everyone is square.',
  'checkout.sub.done': 'All paid. Everyone is square.',
  'checkout.sub.square': 'Nobody owes anybody.',
  'checkout.intro': 'Do these before anyone leaves. Tick each one as the money moves.',
  'checkout.notRupees': 'UPI only moves rupees, so there’s no Pay or QR here. Tick each payment once it’s made.',
  'checkout.progress': '{paid} of {total} paid',
  'checkout.list.aria': 'Payments before you leave',
  'checkout.row.pay': 'Pay',
  'checkout.row.pay.aria': 'Pay {name} {amount}',
  'checkout.row.qr': 'Show QR',
  'checkout.row.qr.aria': 'Show a QR for {from} to pay {to} {amount}',
  'checkout.row.addUpi': 'Add UPI ID',
  'checkout.row.addUpi.aria': 'Add a UPI ID for {name}, to show a QR',
  'checkout.row.noUpi': 'No UPI ID saved for {name}, so there’s no QR yet.',
  'checkout.row.noUpi.mine': 'Your UPI ID isn’t saved, so there’s no QR yet.',
  'checkout.row.tick': 'Mark paid',
  'checkout.row.tick.aria': 'Mark paid: {sentence} {amount}',
  'checkout.row.ticked': 'Paid',
  'checkout.row.ticked.aria': 'Paid: {sentence} {amount}. Tap to undo.',
  'checkout.toast.paid': 'Ticked: {sentence} {amount}',
  'checkout.toast.last': 'That was the last one. Everyone is square.',
  'checkout.toast.unticked': 'Open again: {sentence} {amount}',
  'checkout.error': 'That payment couldn’t be recorded. Try again.',
  'checkout.revised.title': 'The payments changed',
  'checkout.revised.body': 'An expense or a payment changed after you started, so the open payments were worked out again. The ticked ones are kept.',

  'checkout.empty.title': 'Nothing to settle yet',
  'checkout.empty.body': 'Add what the trip spends as you go. On the last day this page is the checklist: who pays whom, a QR for each, a tick when it’s done.',
  'checkout.empty.cta': 'Add an expense',

  // The QR, shown full screen for the payer to scan off this phone.
  'checkout.qr.title': 'Scan to pay {name}',
  'checkout.qr.eyebrow': 'For {name} to scan',
  'checkout.qr.body': 'Open any UPI app and scan. {amount} is already filled in.',
  'checkout.qr.aria': 'QR code to pay {name} {amount}',
  'checkout.qr.to': 'Pays to {upi}',
  'checkout.qr.honest': 'Settle can’t see the payment. Tick it once {name} shows you it went through.',
  'checkout.qr.paid': '{name} has paid',

  // All square.
  'checkout.square.title': 'All square',
  'checkout.square.aria': '{name}: all square',
  'checkout.square.body': 'Nobody owes anybody in {name}.',
  'checkout.square.spent': 'Spent',
  'checkout.square.people': 'People',
  'checkout.square.payments': 'Payments made',
  'checkout.dates.range': '{from} to {to}',
  'checkout.paid.title': 'Ticked here',
  'checkout.share.cta': 'Share',
  'checkout.share.more': 'Share as a picture',
  'checkout.share.title': '{name}: all square',
  'checkout.share.copied': 'Copied. Paste it in the group chat.',
  'checkout.share.failed': 'Couldn’t share that. Try again.',
  'checkout.text.head': '{emoji} {name}: all square',
  'checkout.text.stats': '{spent} spent · {people, plural, one {# person} other {# people}}',
  'checkout.text.stats.dated': '{dates} · {spent} spent · {people, plural, one {# person} other {# people}}',
  'checkout.text.payments': '{count, plural, =0 {Nobody owes anybody.} one {# payment and nobody owes anybody.} other {# payments and nobody owes anybody.}}',
} satisfies Messages
