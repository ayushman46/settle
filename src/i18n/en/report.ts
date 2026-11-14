/** English copy for Expense report (src/features/report): a claim sheet for the office. Names arrive as people typed them; amounts pre-formatted. */
import type { Messages } from '../types'

export const report = {
  'report.you.subtitle': 'A work trip’s expenses as a sheet for the office',
  'report.title': 'Expense claim',
  'report.subtitle': 'Your expenses, laid out for the office. Nothing to type into Excel.',
  'report.docTitle': 'Expense claim',

  'report.from.label': 'Claim for',
  'report.from.group': 'A group',
  'report.from.dates': 'Dates',
  'report.group.label': 'Group',
  'report.dates.from': 'From',
  'report.dates.to': 'To',
  'report.dates.period': '{from} to {to}',

  'report.basis.label': 'What to claim',
  'report.basis.paid': 'What I paid',
  'report.basis.share': 'My share',
  'report.basis.paid.hint': 'Every bill you paid for, the full amount.',
  'report.basis.share.hint': 'Your part of each bill, whoever paid.',

  'report.details.title': 'On the claim',
  'report.details.name': 'Your name',
  'report.details.employee': 'Employee ID or department',
  'report.details.employee.hint': 'Optional',
  'report.details.purpose': 'Purpose',
  'report.details.purpose.hint': 'Optional, like “Client visit, Pune”',
  'report.details.remembered': 'Remembered for next time.',

  'report.list.title': 'Expenses',
  'report.list.count': '{ticked} of {count} ticked',
  'report.list.all': 'Tick all',
  'report.list.none': 'Untick all',
  'report.list.bills': 'Only ones with a bill',
  'report.list.aria': 'Expenses to claim. Untick anything the office won’t pay for.',
  'report.row.meta': '{date} · {category} · paid by {name}',
  'report.row.fx': 'Paid {amount} at {rate}',
  'report.row.tick.aria': 'Claim {title}, {amount}',

  'report.total': '{amount} · {count, plural, one {# expense} other {# expenses}}',
  'report.total.aria': 'Total to claim',
  'report.total.none': 'Nothing ticked yet',
  'report.total.words': '{words}',

  'report.print': 'Print or save as PDF',
  'report.csv': 'Download CSV',
  'report.csv.busy': 'Getting it ready…',
  'report.csv.saved': 'Saved the claim as a spreadsheet',
  'report.csv.shared': 'Claim shared as a spreadsheet',
  'report.csv.failed': 'Couldn’t save the file. Try again.',
  'report.preview': 'How it prints',
  'report.preview.hint': 'One A4 sheet with a place to sign. In the print window, pick “Save as PDF” to email it.',

  'report.empty.title': 'Nothing to claim here',
  'report.empty.paid': 'You didn’t pay for anything here. Try “My share”, or pick another group or dates.',
  'report.empty.share': 'You weren’t part of anything here. Pick another group or dates.',
  'report.none.title': 'No expenses yet',
  'report.none.text': 'Add what you spend on a work trip as you go. At the end, your claim is one tap away.',
  'report.none.cta': 'Back home',
} satisfies Messages
