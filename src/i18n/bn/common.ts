/** Bengali copy for words used all over the app. Keys: `common.<group>.<word>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const common = {
  'common.action.save': 'সেভ করুন',
  'common.action.cancel': 'বাতিল',
  'common.action.done': 'হয়ে গেছে',
  'common.action.undo': 'ফিরিয়ে নিন',
  'common.action.delete': 'মুছুন',
  'common.action.edit': 'এডিট করুন',
  'common.action.close': 'বন্ধ করুন',
  'common.action.back': 'ফিরে যান',
  'common.action.next': 'পরের ধাপ',
  'common.action.continue': 'চালিয়ে যান',
  'common.action.retry': 'আবার চেষ্টা করুন',
  'common.action.skip': 'এড়িয়ে যান',
  'common.action.share': 'শেয়ার করুন',
  'common.action.copy': 'কপি করুন',
  'common.action.copied': 'কপি হয়েছে',
  'common.action.add': 'যোগ করুন',
  'common.action.remove': 'সরান',
  'common.action.seeAll': 'সব দেখুন',
  'common.action.more': 'আরও',
  'common.date.today': 'আজ',
  'common.date.yesterday': 'গতকাল',
  'common.people.you': 'আপনি',
  'common.people.someone': 'কেউ একজন',
  'common.count.people': '{count, plural, one {# জন} other {# জন}}',
  'common.count.items': '{count, plural, one {# টি আইটেম} other {# টি আইটেম}}',
  // The language pickers (onboarding, You → Language) and the switcher on public pages.
  'common.language.label': 'ভাষা',
  'common.language.title': 'আপনার ভাষা বেছে নিন',
  'common.language.automatic': 'স্বয়ংক্রিয়',
  // Under "Automatic": which language the phone gives ({language} is its own name, e.g. हिन्दी).
  'common.language.automatic.hint': 'ফোনের ভাষা · {language}',
  // On a language that isn't translated yet ({language} = its English name).
  'common.language.soon': '{language} · শীঘ্রই আসছে',
  'common.language.failed': 'ভাষাটি লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
} as const satisfies Messages
