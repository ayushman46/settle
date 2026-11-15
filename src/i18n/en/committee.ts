/** English copy for Committee (src/features/committee): a rotating savings group among friends. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const committee = {
  'committee.tool.title': 'Committee / BC',
  'committee.tool.body': 'A rotating savings group: everyone puts in, one person takes the whole pot each month.',

  'committee.title': 'Committee',
  'committee.subtitle': 'Everyone puts in the same amount each month. One person takes the whole pot, until everyone has had it once.',

  // List.
  'committee.empty.title': 'No committees yet',
  'committee.empty.text': 'Start a committee: friends or family, any amount, any number of people.',
  'committee.empty.cta': 'Start a committee',
  'committee.add': 'New committee',

  // Setup.
  'committee.setup.title': 'Start a committee',
  'committee.setup.name.label': 'Name',
  'committee.setup.name.placeholder': 'Family BC, Building committee…',
  'committee.setup.amount.label': 'Amount per hand, per month',
  'committee.setup.people.label': 'Who is in it',
  'committee.setup.day.label': 'Day of the month',
  'committee.setup.start.label': 'First month',
  'committee.setup.mode.label': 'Who gets the pot',
  'committee.setup.mode.order': 'Fixed order',
  'committee.setup.mode.draw': 'Draw each month',
  'committee.setup.organiser.label': 'Organiser',
  'committee.setup.cta': 'Start',
  'committee.setup.note': 'A record for a committee among people who know each other. Settle doesn\'t hold the money.',

  // Detail.
  'committee.month.heading': '{month}',
  'committee.month.pot': 'Pot: {amount}',
  'committee.month.taker': '{name} gets the pot',
  'committee.month.paid.all': 'All {count} paid',
  'committee.month.paid.partial': '{paid} of {count} paid',
  'committee.month.handover': 'Handed over {date}',
  'committee.month.pending': 'Waiting for the draw',

  // Positions.
  'committee.position.received': 'Received {date}',
  'committee.position.waiting': 'Waiting',
  'committee.position.paidIn': '{count, plural, one {# month} other {# months}} paid in',
  'committee.position.total': 'Total paid in: {amount}',

  // Actions.
  'committee.pay.cta': 'Mark paid',
  'committee.pay.done': 'Marked as paid',
  'committee.draw.cta': 'Draw',
  'committee.draw.done': 'Drawn',
  'committee.handover.cta': 'Mark handed over',
  'committee.handover.done': 'Handed over',

  // Today.
  'committee.today.due': '{name}: pay ₹{amount} into the committee',
  'committee.today.chase': '{name}: {count, plural, one {# person} other {# people}} haven\'t paid yet',
  'committee.today.handover': '{name}: pot ready to hand over to {taker}',

  // Message.
  'committee.message': '{name}: ₹{amount} in. {paid} of {count} paid. {taker} gets the pot.',
} satisfies Messages
