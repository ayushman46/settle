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
  'help.setup.name.label': 'Name',
  'help.setup.name.placeholder': 'Asha didi',
  'help.setup.salary.label': 'Monthly salary',
  'help.setup.upi.label': 'UPI ID or mobile number',
  'help.setup.upi.placeholder': 'asha@upi or 98765 43210',
  'help.setup.upi.hint': 'Saved once so you can pay from here.',
  'help.setup.cta': 'Save',

  // Person page.
  'help.person.month': '{month}',
  'help.person.entries.heading': 'This month',
  'help.person.remove.cta': 'Remove',
  'help.person.removed': '{name} removed',

  // Entry kinds.
  'help.entry.advance': 'Advance',
  'help.entry.dayOff': 'Day off',
  'help.entry.extra': 'Extra work',
  'help.entry.bonus': 'Bonus',
  'help.entry.advance.cta': 'Advance',
  'help.entry.dayOff.cta': 'Day off',
  'help.entry.extra.cta': 'Extra',
  'help.entry.bonus.cta': 'Bonus',
  'help.entry.amount.label': 'Amount',
  'help.entry.save': 'Save',
  'help.entry.saved': 'Noted',

  // Today list.
  'help.today.title': "{name}'s {month} salary",
  'help.today.due': 'Due today',
  'help.today.late': '{days, plural, one {# day} other {# days}} overdue',
  'help.today.advance': 'Advance of {cut} cut from the salary.',
  'help.today.advance.carry': 'Advance: {cut} cut, {left} still open.',
  'help.today.advance.open': 'Advance of {left} open — not all cut yet.',
  // Pay day.
  'help.payday.nth': 'the {day}',
  'help.payday.last': 'the last day',

  // The month as one sum.
  'help.eq.salary': '{amount} salary',
  'help.eq.leave': '− {amount} for {days, plural, one {# extra day off} other {# extra days off}}',
  'help.eq.advance': '− {amount} advance',
  'help.eq.extra': '+ {amount} extra work',
  'help.eq.bonus': '+ {amount} bonus',
  'help.eq.toPay': '= {amount} to pay',
  'help.eq.paid': '= {amount} paid',

  // Days off.
  'help.daysOff.within': '{days, plural, one {# day off} other {# days off}}, all within paid leave.',
  'help.daysOff.cut': '{days, plural, one {# day off} other {# days off}}: {paid} paid leave, {extra} extra. {amount} cut from the salary.',
  'help.daysOff.noCut': '{days, plural, one {# day off} other {# days off}}: {paid} paid leave, {extra} extra. No pay cut for them.',

  // Payslip.
  'help.slip.title': 'Payslip: {name}',
  'help.slip.subtitle': '{work} · {month}',
  'help.slip.salary': 'Salary',
  'help.slip.extra': 'Extra work',
  'help.slip.bonus': 'Bonus',
  'help.slip.daysOff': 'Days off',
  'help.slip.daysOff.value': '{days} ({paid} paid leave)',
  'help.slip.leaveCut': 'Cut for {days, plural, one {# extra day off} other {# extra days off}}',
  'help.slip.advance': 'Advance cut',
  'help.slip.toPay': 'To pay',
  'help.slip.paid': 'Paid',
  'help.slip.advanceLeft': 'Advance still open',
  'help.slip.paidLine': '{name} paid on {date}{method, select, upi { by UPI} cash { in cash} other {}}.',
  'help.slip.thanks': 'Thank you, {name}.',

  // Expenses between flatmates.
  'help.expense.salary': '{name}’s {month} salary',
  'help.expense.advance': 'Advance to {name}',
} satisfies Messages
