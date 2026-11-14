/**
 * English copy for "Pay at the counter" (src/features/counter): the shop's QR is read once, and
 * everyone pays the shop their own share. Names arrive as people typed them (a shop's as its QR
 * has it); amounts pre-formatted.
 */
import type { Messages } from '../types'

export const counter = {
  'counter.entry.title': 'Pay at the counter',
  'counter.entry.body': 'Nobody fronts the bill: each of you pays the shop your own share. Nothing to collect afterwards.',
  'counter.entry.cta': 'Everyone pays the shop',
  'counter.entry.open': 'Open the counter: who’s paid',

  'counter.gone.title': 'This bill can’t be paid at the counter',
  'counter.gone.body': 'It needs a bill you saved, in rupees, that still exists on this phone.',

  'counter.setup.title': 'Everyone pays the shop',
  'counter.setup.body': 'Scan the shop’s QR once. Each of you then pays your own share straight to the shop, from your own phone. Nobody fronts the bill, and nobody owes anybody.',
  'counter.people.aria': 'Each person’s share',
  'counter.before.title': 'Paid here before? No scan needed',

  'counter.scan.camera': 'Scan the shop’s QR',
  'counter.scan.photo': 'Use a photo of the QR',
  'counter.scan.stop': 'Stop',
  'counter.scan.video.aria': 'The camera: point it at the shop’s UPI QR',
  'counter.scan.how': 'The QR on the counter or printed on the bill: the one you’d scan to pay. It’s read on this phone; nothing is uploaded.',
  'counter.scan.none': 'No QR code found in that photo. Try again, closer, with the whole code in the picture.',
  'counter.scan.other': 'That QR isn’t a UPI one. Use the shop’s payment QR: the one you’d scan to pay.',
  'counter.scan.noCamera': 'This browser can’t open the camera here. Use a photo of the QR instead.',
  'counter.scan.denied': 'The camera didn’t open. Allow the camera for this page, or use a photo of the QR instead.',

  'counter.fixed.title': 'This QR is for one payment of {amount}',
  'counter.fixed.body': 'It was made for the whole bill, so the shop’s till may expect a single payment. The shop’s own QR (the standee on the counter) takes any amount: scan that one if you can.',
  'counter.fixed.again': 'Scan another',
  'counter.fixed.use': 'Use it anyway',

  'counter.live.title': 'Pay {shop} directly',
  'counter.live.body': 'Everyone pays their own share to the shop. This list ticks itself as each of you pays.',
  'counter.live.done.title': 'All paid: {amount} to {shop}',
  'counter.live.done.body': 'Show this screen at the counter. Nobody owes anybody for this bill.',
  'counter.live.progress.aria': 'Paid so far',
  'counter.live.count': '{paid} of {count} paid',
  'counter.live.collected': '{collected} of {total} paid to {shop}',
  'counter.live.ticked': '{name} paid {amount}',
  'counter.live.on': 'Live: ticks itself when someone pays on their phone.',
  'counter.live.off': 'Live ticking isn’t available right now: friends send you an “I’ve paid” message, or tick them here yourself.',

  'counter.share.title': 'Get everyone to pay their share',
  'counter.share.qr.aria': 'QR code that opens each person’s share to pay {shop}',
  'counter.share.body': 'Friends at the table scan this with their camera, or send them the link. They pick their name and pay the shop.',
  'counter.share.more': 'Share',
  'counter.share.copy': 'Copy link',
  'counter.share.copied': 'Link copied',
  'counter.share.message': '{title}: everyone pays {shop} their own share. Tap, pick your name and pay:\n{link}',

  'counter.people.title': 'Who’s paid',
  'counter.people.paid': 'Paid',
  'counter.people.undo': 'Undo',
  'counter.people.undo.aria': 'Undo: {name} hasn’t paid',
  'counter.people.tick': 'Mark paid',
  'counter.people.tick.aria': 'Mark {name} as paid',
  'counter.people.payMine': 'Pay {amount}',

  'counter.mine.title': 'Pay {shop}',
  'counter.mine.body': 'Your share: {amount}',
  'counter.mine.done': 'You paid {amount} to {shop}',

  'counter.stop.cta': 'Stop paying at the counter',
  'counter.stop.done': 'Back to a normal split: whoever is ticked stays ticked.',

  // The pay page, when the money goes to a shop.
  'counter.pay.request': '<by>Pay your own share to</by> <what>{shop}</what>',
  'counter.pay.request.by': '{title} · set up by {name}',
  'counter.pay.collected': '{collected} of {owed} paid to the shop',
  'counter.pay.done.title': 'You’ve paid your share',
  'counter.pay.done.body': '{name} sees it on their phone. Show this at the counter if they ask.',
  'counter.pay.cash': 'I paid the shop in cash',
  'counter.pay.live': 'When you’ve paid, {name}’s list ticks you off by itself.',
  'counter.pay.tell.message': 'Hi {name}! Paid {amount} to {shop} for {title} ✓',
  'counter.pay.tell.message.cash': 'Hi {name}! Paid {amount} in cash to {shop} for {title} ✓',
} satisfies Messages
