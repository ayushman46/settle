/** English copy for the You tab: shortcuts, preferences (language, currency, haptics), about and footer. */
import type { Messages } from '../types'

export const you = {
  'you.shortcuts.label': 'Shortcuts',
  'you.shortcuts.people.title': 'People',
  'you.shortcuts.recurring.title': 'Recurring splits',
  'you.shortcuts.insights.title': 'Insights',
  'you.shortcuts.insights.subtitle': 'Where your money goes, by category and month',
  'you.shortcuts.collections.title': 'Collections',
  'you.shortcuts.collections.subtitle.open': '{count, plural, other {# open}}',
  'you.shortcuts.collections.subtitle.none': 'Gifts, parties, trips',
  'you.celebrate.title': 'Pro unlocked',
  'you.pref.title': 'Preferences',
  // Under the language tiles in You → Language.
  'you.language.description': 'Your choice is saved with your data and goes into backups.',
  'you.pref.currency.title': 'Default currency',
  'you.pref.currency.description': 'New splits start in this currency. Existing ones keep theirs.',
  // Toast after changing the default currency ({currency} = its name, e.g. Indian Rupee).
  'you.pref.currency.toast': 'New splits will be in {currency}',
  'you.pref.haptics.title': 'Haptics',
  'you.pref.haptics.description': 'A light buzz as you tap and finish things, on phones that support it.',
  'you.about.title': 'About',
  'you.about.redeem.title': 'Redeem a code',
  'you.about.redeem.subtitle': 'A promo code, or Pro from your old phone',
  'you.about.privacy.title': 'Privacy',
  'you.about.privacy.subtitle': 'No account, no tracking — your data stays here',
  'you.about.terms.title': 'Terms',
  'you.about.terms.subtitle': 'The plain-English rules',
  'you.footer.small': 'Made with care · no ads · no tracking',
} as const satisfies Messages
