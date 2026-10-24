/** Telugu copy for the You tab. Keys: `you.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const you = {
  'you.shortcuts.label': 'షార్ట్‌కట్‌లు',
  'you.shortcuts.people.title': 'వ్యక్తులు',
  'you.shortcuts.recurring.title': 'రిపీట్ స్ప్లిట్‌లు',
  'you.shortcuts.insights.title': 'ఇన్‌సైట్‌లు',
  'you.shortcuts.insights.subtitle': 'మీ డబ్బు ఎక్కడికి పోతోంది, వర్గం, నెల వారీగా',
  'you.shortcuts.collections.title': 'వసూళ్లు',
  'you.shortcuts.collections.subtitle.open': '{count, plural, one {# తెరిచి ఉంది} other {# తెరిచి ఉన్నాయి}}',
  'you.shortcuts.collections.subtitle.none': 'బహుమతులు, పార్టీలు, ట్రిప్‌లు',
  'you.celebrate.title': 'Pro అన్‌లాక్ అయింది',
  'you.pref.title': 'ప్రాధాన్యతలు',
  // Under the language tiles in You → Language.
  'you.language.description': 'మీ ఎంపిక మీ డేటాతో పాటు సేవ్ అవుతుంది, బ్యాకప్‌లలోనూ ఉంటుంది.',
  'you.pref.currency.title': 'డిఫాల్ట్ కరెన్సీ',
  'you.pref.currency.description': 'కొత్త స్ప్లిట్‌లు ఈ కరెన్సీలో మొదలవుతాయి. ఇప్పటికే ఉన్నవి వాటి కరెన్సీలోనే ఉంటాయి.',
  // Toast after changing the default currency ({currency} = its name, e.g. Indian Rupee).
  'you.pref.currency.toast': 'కొత్త స్ప్లిట్‌ల కరెన్సీ: {currency}',
  'you.pref.haptics.title': 'వైబ్రేషన్',
  'you.pref.haptics.description': 'నొక్కినప్పుడు, పనులు పూర్తయినప్పుడు తేలికపాటి వైబ్రేషన్, అది ఉన్న ఫోన్లలో.',
  'you.about.title': 'గురించి',
  'you.about.redeem.title': 'కోడ్‌ను ఉపయోగించండి',
  'you.about.redeem.subtitle': 'ప్రోమో కోడ్, లేదా పాత ఫోన్ నుంచి Pro',
  'you.about.privacy.title': 'గోప్యత',
  'you.about.privacy.subtitle': 'ఖాతా లేదు, ట్రాకింగ్ లేదు — మీ డేటా ఇక్కడే ఉంటుంది',
  'you.about.terms.title': 'నిబంధనలు',
  'you.about.terms.subtitle': 'సులభమైన భాషలో నిబంధనలు',
  'you.footer.small': 'శ్రద్ధతో తయారు చేసింది · ప్రకటనలు లేవు · ట్రాకింగ్ లేదు',
} as const satisfies Messages
