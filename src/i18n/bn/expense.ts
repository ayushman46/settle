/** Bengali copy for one expense (its page, toasts, the bill as printed, the ⋮ menu). Keys: `expense.<part>.<element>`. */
import type { Messages } from '../types'

export const expense = {
  // `/app/expense/:id` when the expense no longer exists.
  'expense.gone.title': 'এই খরচটি আর নেই',
  'expense.gone.subtitle': 'হয়তো মুছে ফেলা হয়েছে — এই ফোনে বা অন্য ট্যাবে।',
  'expense.gone.cta': 'লেনদেন দেখুন',

  // The standing pill under the big amount (owner's side).
  'expense.standing.notIn': 'আপনি এতে নেই',
  'expense.standing.lent': 'আপনি {amount} দিয়েছেন',
  'expense.standing.borrowed': 'আপনি {amount} ধার নিয়েছেন',
  'expense.standing.owed': 'আপনার {amount} পাওনা',
  'expense.standing.settled': 'মিটে গেছে',
  'expense.standing.owe': 'আপনি {name}-কে {amount} দেবেন',
  'expense.standing.paidBack': 'আপনি {name}-কে ফেরত দিয়েছেন',

  // The hero (receipt header).
  'expense.hero.group.aria': 'গ্রুপ {name}-এ',
  'expense.hero.paidBy': '{who, select, me {আপনি দিয়েছেন} other {{name} দিয়েছেন}}',

  // Toasts when someone is ticked off (or back on).
  'expense.toast.allBack': 'সবাই দিয়েছেন — পুরো {amount} ফেরত এসেছে',
  'expense.toast.allSettled': '{name}-এর সঙ্গে সব মিটে গেছে',
  'expense.toast.markedPaid': '{who, select, me {আপনি দিয়েছেন বলে চিহ্নিত} other {{name} দিয়েছেন বলে চিহ্নিত}}',
  'expense.toast.markedUnpaid': '{who, select, me {আপনি এখনও দেননি বলে চিহ্নিত} other {{name} এখনও দেননি বলে চিহ্নিত}}',
  'expense.toast.deleted': '{title} মুছে ফেলা হয়েছে',
  'expense.toast.undo': 'ফিরিয়ে নিন',

  // The main button.
  'expense.primary.group.cta': '{group}-এ হিসাব মেটান',
  'expense.primary.pay.cta': '{name}-কে {amount} দিন',
  'expense.primary.markPaid.cta': 'আমি {name}-কে ফেরত দিয়েছি',
  'expense.primary.payLink.cta': 'পে লিংক শেয়ার করুন',
  'expense.primary.share.cta': 'শেয়ার করুন',
  'expense.share.aria': 'শেয়ার করুন',
  'expense.edit.aria': '{title} এডিট করুন',
  'expense.more.aria': 'আরও বিকল্প',

  // Sections.
  'expense.shares.title': 'সবার ভাগ',
  'expense.shares.markAll.cta': 'সবাইকে দেওয়া হয়েছে বলে চিহ্নিত করুন',
  'expense.note.title': 'নোট',

  // The small print: "Added 18 Oct, 9:41 pm · from a scanned bill · last changed 19 Oct, 8:02 am".
  'expense.added': '{date} তারিখে যোগ হয়েছে',
  'expense.added.changed': 'শেষ বদল {date}',
  'expense.added.source.scan': 'স্ক্যান করা বিল থেকে',
  'expense.added.source.describe': '“Just say it” দিয়ে',
  'expense.added.source.sample': 'নমুনা বিল থেকে',
  'expense.added.source.recurring': 'নিয়মিত ভাগ থেকে',
  'expense.added.source.sms': 'ব্যাংকের SMS থেকে',
  'expense.added.source.voice': 'কণ্ঠস্বরে',

  // The bill as printed.
  'expense.bill.title': 'বিলটি',
  'expense.bill.description': '{count, plural, one {# টি আইটেম · কে কী নিয়েছিল} other {# টি আইটেম · কে কী নিয়েছিল}}',
  'expense.bill.items.aria': 'আইটেম',
  'expense.bill.everyone': 'সবাই মিলে ভাগ',
  'expense.bill.showAll.cta': 'সব {count}টি আইটেম দেখান',
  'expense.bill.items': 'আইটেম',
  'expense.bill.totalPaid': 'মোট দেওয়া',
  'expense.bill.fees.equal.aria': 'ফি, সমানভাবে ভাগ',
  'expense.bill.fees.proportional.aria': 'ফি, যে যা নিয়েছে সেই অনুপাতে',
  // One person's part of the delivery fees: "Fees · Riya".
  'expense.bill.fees.person': 'ফি · {name}',
  'expense.bill.tax': 'ট্যাক্স',
  'expense.bill.service': 'সার্ভিস চার্জ',
  'expense.bill.tip': 'টিপস',
  'expense.bill.discount': 'ছাড়',
  'expense.bill.roundOff': 'রাউন্ড-অফ',
  'expense.bill.otherCharges': 'অন্যান্য চার্জ',
  'expense.bill.otherDiscounts': 'অন্যান্য ছাড়',

  // The ⋮ menu.
  'expense.actions.eyebrow': 'খরচ',
  'expense.actions.editBill': 'বিল এডিট করুন',
  'expense.actions.editBill.detail': 'আইটেম, কে কী নিয়েছে, কে দিয়েছে',
  'expense.actions.edit': 'এডিট করুন',
  'expense.actions.edit.detail': 'পরিমাণ, মানুষজন, কীভাবে ভাগ হয়েছে',
  'expense.actions.duplicate': 'নকল করুন',
  'expense.actions.duplicate.detail': 'আজকের তারিখে একটি কপি, বদলে সেভ করার জন্য',
  'expense.actions.markAll': 'সবাইকে দেওয়া হয়েছে বলে চিহ্নিত করুন',
  'expense.actions.markAll.detail': 'সব টাকা ফিরে এলে',
  'expense.actions.delete': 'মুছুন',
  'expense.actions.delete.detail': 'এর পরপরই আপনি ফিরিয়ে নিতে পারবেন',
} as const satisfies Messages
