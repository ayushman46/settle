/** English copy for House help's salary (src/features/help): salary, days off, advances, bonus. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const help = {
  'help.tool.title': 'House help salary',
  'help.tool.body': 'Maid, cook, driver, nanny: salary, advances, days off, bonus, payslip.',

  // List screen.
  'help.title': 'House help',
  'help.subtitle': 'Salary, advances, days off and bonus, to the paisa.',
  'help.empty.title': 'Nobody added yet',
  'help.empty.text': 'Add Asha didi, the cook, driver — anyone you pay at home.',
  'help.empty.cta': 'Add someone',
  'help.add': 'Add',

  // Work chips.
  'help.work.maid': 'Maid',
  'help.work.cook': 'Cook',
  'help.work.driver': 'Driver',
  'help.work.nanny': 'Nanny',
  'help.work.gardener': 'Gardener',
  'help.work.car': 'Car cleaner',
  'help.work.other': 'Other',

  // Add / edit a helper.
  'help.setup.title': 'Add someone',
  'help.setup.edit': 'Edit',
  'help.setup.name.label': 'Name',
  'help.setup.name.placeholder': 'Asha didi',
  'help.setup.work.label': 'Work',
  'help.setup.salary.label': 'Monthly salary',
  'help.setup.payday.label': 'Pay day',
  'help.setup.payday.hint': 'Day of month, 1–31. Salary for the previous month is due on the 1st.',
  'help.setup.leave.label': 'Paid leave per month',
  'help.setup.leave.hint': 'Days off up to this many are not deducted from the salary.',
  'help.setup.cutpay.label': 'Cut pay for extra days off',
  'help.setup.cutpay.hint': 'Off by default. Many families don\'t cut pay for extra days off.',
  'help.setup.upi.label': 'UPI ID or mobile number',
  'help.setup.upi.placeholder': 'asha@upi or 98765 43210',
  'help.setup.upi.hint': 'Saved once so you can pay from here.',
  'help.setup.cta': 'Save',
  'help.setup.done': 'Added',

  // Person page.
  'help.person.month': '{month}',
  'help.person.month.paid': '{month} · Paid',
  'help.person.salary': 'Salary: {amount}',
  'help.person.equation': '{equation}',
  'help.person.pay.cta': 'Pay {name}',
  'help.person.pay.cash': 'Mark paid in cash',
  'help.person.paid.on': 'Paid {date}',
  'help.person.entries.heading': 'This month',
  'help.person.entries.none': 'Nothing noted this month yet.',
  'help.person.year.heading': '{year}',
  'help.person.raise.cta': 'Raise from a month',
  'help.person.edit': 'Edit',
  'help.person.remove.cta': 'Remove',
  'help.person.remove.confirm': 'Remove {name}? All history is deleted.',
  'help.person.removed': '{name} removed',

  // Entry kinds.
  'help.entry.advance': 'Advance',
  'help.entry.dayOff': 'Day off',
  'help.entry.extra': 'Extra work',
  'help.entry.bonus': 'Bonus',
  'help.entry.add': 'Add',
  'help.entry.advance.cta': 'Advance',
  'help.entry.dayOff.cta': 'Day off',
  'help.entry.extra.cta': 'Extra',
  'help.entry.bonus.cta': 'Bonus',
  'help.entry.amount.label': 'Amount',
  'help.entry.date.label': 'Date',
  'help.entry.note.label': 'Note',
  'help.entry.note.placeholder': 'What for',
  'help.entry.save': 'Save',
  'help.entry.saved': 'Noted',
  'help.entry.removed': 'Entry removed',

  // Pay sheet.
  'help.pay.title': 'Pay {name}',
  'help.pay.month': '{month}',
  'help.pay.equation': '{equation}',
  'help.pay.flatmates': "Flatmates' shares",
  'help.pay.flatmate.row': '{name}: {amount}',
  'help.pay.upi.cta': 'Pay ₹{amount} by UPI',
  'help.pay.cash.cta': 'Mark paid in cash',
  'help.pay.add.expense': "Add to flat's expenses",
  'help.pay.expense.added': 'Added to the group',
  'help.pay.undo': 'Undo',
  'help.pay.done': 'Paid',

  // Today list.
  'help.today.title': "{name}'s {month} salary",
  'help.today.due': 'Due today',
  'help.today.late': '{days, plural, one {# day} other {# days}} overdue',
  'help.today.advance': 'Advance of {cut} cut from the salary.',
  'help.today.advance.carry': 'Advance: {cut} cut, {left} still open.',
  'help.today.advance.open': 'Advance of {left} open — not all cut yet.',
} satisfies Messages
