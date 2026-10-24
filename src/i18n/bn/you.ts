/** Bengali copy for the You tab: shortcuts, preferences, about. Keys: `you.<section>.<element>`. */
import type { Messages } from '../types'

export const you = {
  'you.shortcuts.label': 'শর্টকাট',
  'you.shortcuts.people.title': 'লোকজন',
  'you.shortcuts.recurring.title': 'নিয়মিত ভাগ',
  'you.shortcuts.insights.title': 'বিশ্লেষণ',
  'you.shortcuts.insights.subtitle': 'টাকা কোথায় যাচ্ছে, বিভাগ ও মাস অনুযায়ী',
  'you.shortcuts.collections.title': 'চাঁদা',
  'you.shortcuts.collections.subtitle.open': '{count, plural, other {# টি চলছে}}',
  'you.shortcuts.collections.subtitle.none': 'উপহার, অনুষ্ঠান, ট্রিপ',
  'you.celebrate.title': 'Pro চালু হয়েছে',
  'you.pref.title': 'পছন্দসমূহ',
  // Under the language tiles in You → Language.
  'you.language.description': 'আপনার পছন্দ আপনার ডেটার সঙ্গে সেভ থাকে এবং ব্যাকআপেও যায়।',
  'you.pref.currency.title': 'ডিফল্ট মুদ্রা',
  'you.pref.currency.description': 'নতুন ভাগ এই মুদ্রায় শুরু হবে। আগেরগুলো তাদের নিজেদের মুদ্রাতেই থাকবে।',
  // Toast after changing the default currency ({currency} = its name, e.g. Indian Rupee).
  'you.pref.currency.toast': 'নতুন ভাগ হবে {currency}-তে',
  'you.pref.haptics.title': 'কম্পন',
  'you.pref.haptics.description': 'ট্যাপ করলে ও কাজ শেষ হলে হালকা কম্পন, যে ফোনে সাপোর্ট আছে।',
  'you.about.title': 'সম্পর্কে',
  'you.about.redeem.title': 'কোড ব্যবহার করুন',
  'you.about.redeem.subtitle': 'একটি প্রোমো কোড, অথবা পুরোনো ফোন থেকে Pro',
  'you.about.privacy.title': 'গোপনীয়তা',
  'you.about.privacy.subtitle': 'অ্যাকাউন্ট নেই, ট্র্যাকিং নেই — আপনার ডেটা এখানেই থাকে',
  'you.about.terms.title': 'শর্তাবলি',
  'you.about.terms.subtitle': 'সহজ ভাষায় নিয়মকানুন',
  'you.footer.small': 'যত্ন করে বানানো · কোনো বিজ্ঞাপন নেই · কোনো ট্র্যাকিং নেই',
} as const satisfies Messages
