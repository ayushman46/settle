/** Marathi copy for words used all over the app. Keys: `common.<group>.<word>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const common = {
  'common.action.save': 'सेव्ह करा',
  'common.action.cancel': 'रद्द करा',
  'common.action.done': 'झाले',
  'common.action.undo': 'पूर्ववत करा',
  'common.action.delete': 'हटवा',
  'common.action.edit': 'बदला',
  'common.action.close': 'बंद करा',
  'common.action.back': 'मागे',
  'common.action.next': 'पुढे',
  'common.action.continue': 'पुढे चला',
  'common.action.retry': 'पुन्हा प्रयत्न करा',
  'common.action.skip': 'वगळा',
  'common.action.share': 'शेअर करा',
  'common.action.copy': 'कॉपी करा',
  'common.action.copied': 'कॉपी झाले',
  'common.action.add': 'जोडा',
  'common.action.remove': 'काढा',
  'common.action.seeAll': 'सर्व पहा',
  'common.action.more': 'आणखी',
  'common.date.today': 'आज',
  'common.date.yesterday': 'काल',
  'common.people.you': 'तुम्ही',
  'common.people.someone': 'कोणीतरी',
  'common.count.people': '{count, plural, one {# व्यक्ती} other {# जण}}',
  'common.count.items': '{count, plural, one {# आयटम} other {# आयटम}}',
  // The language pickers (onboarding, You → Language) and the switcher on public pages.
  'common.language.label': 'भाषा',
  'common.language.title': 'तुमची भाषा निवडा',
  'common.language.automatic': 'आपोआप',
  // Under "Automatic": which language the phone gives ({language} is its own name, e.g. हिन्दी).
  'common.language.automatic.hint': 'फोनची भाषा · {language}',
  // On a language that isn't translated yet ({language} = its English name).
  'common.language.soon': '{language} · लवकरच',
  'common.language.failed': 'ती भाषा लोड होऊ शकली नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.',
} as const satisfies Messages
