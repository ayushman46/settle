/** Words used all over the app. Keys: `common.<group>.<word>`. */
import type { Messages } from '../types'

export const common = {
  'common.action.save': 'Save',
  'common.action.cancel': 'Cancel',
  'common.action.done': 'Done',
  'common.action.undo': 'Undo',
  'common.action.delete': 'Delete',
  'common.action.edit': 'Edit',
  'common.action.close': 'Close',
  'common.action.back': 'Back',
  'common.action.next': 'Next',
  'common.action.continue': 'Continue',
  'common.action.retry': 'Try again',
  'common.action.skip': 'Skip',
  'common.action.share': 'Share',
  'common.action.copy': 'Copy',
  'common.action.copied': 'Copied',
  'common.action.add': 'Add',
  'common.action.remove': 'Remove',
  'common.action.seeAll': 'See all',
  'common.action.more': 'More',
  'common.date.today': 'Today',
  'common.date.yesterday': 'Yesterday',
  'common.people.you': 'You',
  'common.people.someone': 'Someone',
  'common.count.people': '{count, plural, one {# person} other {# people}}',
  'common.count.items': '{count, plural, one {# item} other {# items}}',
  // The language pickers (onboarding, You → Language) and the switcher on public pages.
  'common.language.label': 'Language',
  'common.language.title': 'Choose your language',
  'common.language.automatic': 'Automatic',
  // Under "Automatic": which language the phone gives ({language} is its own name, e.g. हिन्दी).
  'common.language.automatic.hint': 'Phone language · {language}',
  // On a language that isn't translated yet ({language} = its English name).
  'common.language.soon': '{language} · coming soon',
  'common.language.failed': 'Couldn’t load that language. Check your connection and try again.',
} as const satisfies Messages
