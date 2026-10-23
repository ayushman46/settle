/** English copy for the expense page (src/features/expense). Keys: `expense.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const expense = {
  // `/app/expense/:id` when the expense no longer exists.
  'expense.gone.title': 'This expense is gone',
  'expense.gone.subtitle': 'It may have been deleted — on this phone or in another tab.',
  'expense.gone.cta': 'See activity',

  // The standing pill under the big amount (owner's side).
  'expense.standing.notIn': 'You’re not in this one',
  'expense.standing.lent': 'You lent {amount}',
  'expense.standing.borrowed': 'You borrowed {amount}',
  'expense.standing.owed': 'You’re owed {amount}',
  'expense.standing.settled': 'Settled',
  'expense.standing.owe': 'You owe {name} {amount}',
  'expense.standing.paidBack': 'You paid {name} back',

  // The hero (receipt header).
  'expense.hero.group.aria': 'In the group {name}',
  'expense.hero.paidBy': '{who, select, me {Paid by you} other {Paid by {name}}}',

  // Toasts when someone is ticked off (or back on).
  'expense.toast.allBack': 'Everyone’s paid — all {amount} is back',
  'expense.toast.allSettled': 'All settled with {name}',
  'expense.toast.markedPaid': '{who, select, me {You are marked as paid} other {{name} is marked as paid}}',
  'expense.toast.markedUnpaid': '{who, select, me {You are marked as not paid yet} other {{name} is marked as not paid yet}}',
  'expense.toast.deleted': '{title} deleted',
  'expense.toast.undo': 'Undo',

  // The main button.
  'expense.primary.group.cta': 'Settle up in {group}',
  'expense.primary.pay.cta': 'Pay {name} {amount}',
  'expense.primary.markPaid.cta': 'I’ve paid {name} back',
  'expense.primary.payLink.cta': 'Share pay link',
  'expense.primary.share.cta': 'Share',
  'expense.share.aria': 'Share',
  'expense.edit.aria': 'Edit {title}',
  'expense.more.aria': 'More options',

  // Sections.
  'expense.shares.title': 'Everyone’s share',
  'expense.shares.markAll.cta': 'Mark all paid',
  'expense.note.title': 'Note',

  // The small print: "Added 18 Oct, 9:41 pm · from a scanned bill · last changed 19 Oct, 8:02 am".
  'expense.added': 'Added {date}',
  'expense.added.changed': 'last changed {date}',
  'expense.added.source.scan': 'from a scanned bill',
  'expense.added.source.describe': 'with “Just say it”',
  'expense.added.source.sample': 'from the sample bill',
  'expense.added.source.recurring': 'from a recurring split',
  'expense.added.source.sms': 'from a bank SMS',
  'expense.added.source.voice': 'by voice',

  // The bill as printed.
  'expense.bill.title': 'The bill',
  'expense.bill.description': '{count, plural, one {# item · who had what} other {# items · who had what}}',
  'expense.bill.items.aria': 'Items',
  'expense.bill.everyone': 'Shared by everyone',
  'expense.bill.showAll.cta': 'Show all {count} items',
  'expense.bill.items': 'Items',
  'expense.bill.totalPaid': 'Total paid',
  'expense.bill.fees.equal.aria': 'Fees, shared equally',
  'expense.bill.fees.proportional.aria': 'Fees, by what each had',
  // One person's part of the delivery fees: "Fees · Riya".
  'expense.bill.fees.person': 'Fees · {name}',
  'expense.bill.tax': 'Tax',
  'expense.bill.service': 'Service charge',
  'expense.bill.tip': 'Tip',
  'expense.bill.discount': 'Discount',
  'expense.bill.roundOff': 'Round-off',
  'expense.bill.otherCharges': 'Other charges',
  'expense.bill.otherDiscounts': 'Other discounts',

  // The ⋮ menu.
  'expense.actions.eyebrow': 'Expense',
  'expense.actions.editBill': 'Edit the bill',
  'expense.actions.editBill.detail': 'Items, who had what, who paid',
  'expense.actions.edit': 'Edit',
  'expense.actions.edit.detail': 'Amount, people, how it’s split',
  'expense.actions.duplicate': 'Duplicate',
  'expense.actions.duplicate.detail': 'A copy dated today, to change and save',
  'expense.actions.markAll': 'Mark everyone as paid',
  'expense.actions.markAll.detail': 'When it’s all come back',
  'expense.actions.delete': 'Delete',
  'expense.actions.delete.detail': 'You can undo it straight after',
} as const satisfies Messages
