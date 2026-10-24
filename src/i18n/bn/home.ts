/** Bengali copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'দ্রুত কাজ',
  'home.quick.scan': 'বিল স্ক্যান',
  'home.quick.split': 'টাকা ভাগ করুন',
  'home.quick.lend': 'ধার দিন / নিন',
  'home.quick.collect': 'টাকা তুলুন',
  'home.quick.sms': 'SMS থেকে',
  'home.quick.food': 'ফুড অর্ডার',
  'home.quick.group': 'নতুন গ্রুপ',
  'home.quick.more': 'আরও',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'ভাড়া',
  'home.template.travel': 'ট্রিপ',
  'home.template.subscription': 'সাবস্ক্রিপশন',
  'home.template.utilities': 'বিদ্যুৎ ও জল',
  'home.template.transport': 'ক্যাব',
  // The sheet behind the More tile.
  'home.more.title': 'ভাগ করার আরও উপায়',
  'home.more.subtitle': 'এর যেকোনোটির জন্য শুধু টাকার পরিমাণ দিয়ে শুরু করুন।',
} as const satisfies Messages
