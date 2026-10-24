/** Marathi copy for the You tab: shortcuts, preferences, about. Keys: `you.<section>.<element>`. */
import type { Messages } from '../types'

export const you = {
  'you.shortcuts.label': 'शॉर्टकट',
  'you.shortcuts.people.title': 'लोक',
  'you.shortcuts.recurring.title': 'नियमित वाटणी',
  'you.shortcuts.insights.title': 'विश्लेषण',
  'you.shortcuts.insights.subtitle': 'पैसे कुठे जातात, वर्ग आणि महिन्यानुसार',
  'you.shortcuts.collections.title': 'वर्गणी',
  'you.shortcuts.collections.subtitle.open': '{count, plural, other {# चालू}}',
  'you.shortcuts.collections.subtitle.none': 'भेटवस्तू, कार्यक्रम, ट्रिप',
  'you.celebrate.title': 'Pro अनलॉक झाले',
  'you.pref.title': 'पसंती',
  // Under the language tiles in You → Language.
  'you.language.description': 'तुमची निवड तुमच्या डेटासोबत सेव्ह राहते आणि बॅकअपमध्येही जाते.',
  'you.pref.currency.title': 'डीफॉल्ट चलन',
  'you.pref.currency.description': 'नवीन वाटण्या या चलनात सुरू होतील. जुन्या त्यांच्याच चलनात राहतील.',
  // Toast after changing the default currency ({currency} = its name, e.g. Indian Rupee).
  'you.pref.currency.toast': 'नवीन वाटण्या {currency} मध्ये असतील',
  'you.pref.haptics.title': 'कंपन',
  'you.pref.haptics.description': 'टॅप करताना आणि काम पूर्ण होताना हलका कंपन, जिथे फोन सपोर्ट करतो.',
  'you.about.title': 'माहिती',
  'you.about.redeem.title': 'कोड वापरा',
  'you.about.redeem.subtitle': 'प्रोमो कोड, किंवा जुन्या फोनवरून Pro',
  'you.about.privacy.title': 'गोपनीयता',
  'you.about.privacy.subtitle': 'खाते नाही, ट्रॅकिंग नाही — तुमचा डेटा इथेच राहतो',
  'you.about.terms.title': 'अटी',
  'you.about.terms.subtitle': 'सोप्या भाषेतले नियम',
  'you.footer.small': 'काळजीने बनवलेले · जाहिराती नाहीत · ट्रॅकिंग नाही',
} as const satisfies Messages
