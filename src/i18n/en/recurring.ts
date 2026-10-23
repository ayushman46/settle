/** English copy for recurring splits (src/features/recurring). Keys: `recurring.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const recurring = {
  // A day of the month as people say it: "1st", "2nd", "3rd", "11th" (picked by code; {n} is the day).
  'recurring.ordinal.st': '{n}st',
  'recurring.ordinal.nd': '{n}nd',
  'recurring.ordinal.rd': '{n}rd',
  'recurring.ordinal.th': '{n}th',
  // The day picker's chip; {day} is an ordinal above ("1st").
  'recurring.repeats': 'Every month on the {day}',
  // When it's due ({date} = "1 Oct").
  'recurring.due.overdue': 'Overdue since {date}',
  'recurring.due.today': 'Due today',
  'recurring.due.tomorrow': 'Due tomorrow',
  'recurring.due.inDays': '{count, plural, one {Due in # day} other {Due in # days}}',
  // Short badge on a list row.
  'recurring.due.badge.overdue': 'Overdue',
  'recurring.next': 'Next: {date}',
  // What it means for me each month.
  'recurring.standing.owed.future': "You'll be owed {amount}",
  'recurring.standing.owed.now': "You're owed {amount}",
  'recurring.standing.owe.future': "You'll owe {name} {amount}",
  'recurring.standing.owe.now': 'You owe {name} {amount}',
  // "For November" — which month a split is for.
  'recurring.forMonth': 'For {month}',

  // Quick-start presets (also the title they start with).
  'recurring.preset.rent': 'Rent',
  'recurring.preset.wifi': 'Wi-Fi',
  'recurring.preset.electricity': 'Electricity',
  'recurring.preset.netflix': 'Netflix',
  'recurring.preset.help': 'House help',

  // "Split now" (list, editor).
  'recurring.splitNow.cta': 'Split now',
  'recurring.splitNow.error.toast': "Couldn't split {title}. {reason}",
  'recurring.splitNow.edit.cta': 'Edit',
  // The success moment's title: "Rent split".
  'recurring.splitNow.done.title': '{title} split',

  // Pro banners (list and editor).
  'recurring.pro.ended.title': 'Your Pro pass has ended',
  'recurring.pro.locked.title': 'Recurring splits are part of Pro',
  'recurring.pro.renew.cta': 'Renew Pro',
  'recurring.pro.see.cta': 'See Pro',

  // The list (`/app/recurring`).
  'recurring.list.title': 'Recurring splits',
  'recurring.list.subtitle': 'Rent, Wi-Fi, subscriptions — set them once, split them each month.',
  'recurring.list.paused.body': "They're paused for now — all still here, nothing deleted. Edit them any time; splitting them needs Pro.",
  'recurring.list.due.title': 'Due now',
  'recurring.list.all.title': 'All recurring splits',
  'recurring.list.yours.title': 'Your recurring splits',
  'recurring.list.paused.title': 'Paused',
  'recurring.list.paused.description': 'No reminders until you switch them back on.',
  'recurring.list.new.cta': 'New recurring split',
  'recurring.list.due.split.aria': 'Split {title} for {month} now',
  'recurring.list.edit.aria': 'Edit {title}',
  'recurring.list.edit.cta': 'Edit',
  'recurring.list.paused.badge': 'Paused',
  // A row's subtitle: "₹32,000 · on the 1st · 3 people".
  'recurring.list.row.subtitle': '{amount} · on the {day} · {count, plural, one {# person} other {# people}}',
  'recurring.list.empty.title': 'Set it once, split it every month',
  'recurring.list.empty.body': 'Settle reminds you when each one is due, and splits it in one tap.',
  'recurring.list.presets.aria': 'Quick start',

  // The editor (`/app/recurring/new`, `/app/recurring/:id`).
  'recurring.editor.new.title': 'New recurring split',
  'recurring.editor.title': 'Recurring split',
  'recurring.editor.edit.title': 'Edit {title}',
  'recurring.editor.gone.title': 'This recurring split is gone',
  'recurring.editor.gone.subtitle': 'It may have been deleted — on this phone or in another tab.',
  'recurring.editor.gone.cta': 'See recurring splits',
  'recurring.editor.saved.toast': 'Recurring split saved',
  'recurring.editor.changesSaved.toast': 'Changes saved',
  'recurring.editor.deleted.toast': '{title} deleted',
  'recurring.editor.undo.cta': 'Undo',
  'recurring.editor.delete.aria': 'Delete {title}',
  'recurring.editor.save.new.cta': 'Save recurring split',
  'recurring.editor.save.cta': 'Save changes',
  'recurring.editor.paused.body': 'This one is paused. You can still edit or delete it; splitting it needs Pro.',
  'recurring.editor.nextSplit': 'Next split: {date}',
  'recurring.editor.saveFirst.hint': 'Save first to split with your changes.',
  'recurring.editor.amount.label': 'Amount each month',
  'recurring.editor.what.label': "What's it for?",
  'recurring.editor.what.placeholder': 'Rent, Wi-Fi, Netflix…',
  'recurring.editor.repeats.title': 'Repeats',
  'recurring.editor.firstReminder': 'First reminder {date}, then every month.',
  'recurring.editor.nextDue': 'Next due {date}.',
  'recurring.editor.people.title': 'Split with',
  'recurring.editor.how.title': 'How to split',
  'recurring.editor.remind.label': 'Remind me each month',
  'recurring.editor.remind.description': "Shows on Home when it's due. Turn off to pause it — nothing is deleted.",
  'recurring.editor.discard.title': 'Discard changes?',
  'recurring.editor.discard.new.description': "This recurring split won't be saved.",
  'recurring.editor.discard.description': "Your changes to this recurring split won't be saved.",
  'recurring.editor.discard.cta': 'Discard',
  'recurring.editor.keep.cta': 'Keep editing',

  // The day-of-month picker.
  'recurring.day.sheet.title': 'Which day each month?',
  'recurring.day.sheet.description': 'Months have at least 28 days, so the 28th is the latest.',
  'recurring.day.grid.aria': 'Day of the month',
  // One day's button: "The 1st".
  'recurring.day.option.aria': 'The {day}',
} as const satisfies Messages
