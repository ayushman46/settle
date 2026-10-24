/** Telugu words used all over the app. Keys: `common.<group>.<word>`. */
import type { Messages } from '../types'

export const common = {
  'common.action.save': 'సేవ్ చేయండి',
  'common.action.cancel': 'రద్దు చేయండి',
  'common.action.done': 'అయింది',
  'common.action.undo': 'వెనక్కి తీసుకోండి',
  'common.action.delete': 'తొలగించండి',
  'common.action.edit': 'మార్చండి',
  'common.action.close': 'మూసివేయండి',
  'common.action.back': 'వెనక్కి',
  'common.action.next': 'తర్వాత',
  'common.action.continue': 'కొనసాగించండి',
  'common.action.retry': 'మళ్ళీ ప్రయత్నించండి',
  'common.action.skip': 'దాటవేయండి',
  'common.action.share': 'షేర్ చేయండి',
  'common.action.copy': 'కాపీ చేయండి',
  'common.action.copied': 'కాపీ అయింది',
  'common.action.add': 'జోడించండి',
  'common.action.remove': 'తీసేయండి',
  'common.action.seeAll': 'అన్నీ చూడండి',
  'common.action.more': 'ఇంకా',
  'common.date.today': 'ఈరోజు',
  'common.date.yesterday': 'నిన్న',
  'common.people.you': 'మీరు',
  'common.people.someone': 'ఎవరో ఒకరు',
  'common.count.people': '{count, plural, one {# వ్యక్తి} other {# మంది}}',
  'common.count.items': '{count, plural, one {# అంశం} other {# అంశాలు}}',
  // The language pickers (onboarding, You → Language) and the switcher on public pages.
  'common.language.label': 'భాష',
  'common.language.title': 'మీ భాషను ఎంచుకోండి',
  'common.language.automatic': 'ఆటోమేటిక్',
  // Under "Automatic": which language the phone gives ({language} is its own name, e.g. हिन्दी).
  'common.language.automatic.hint': 'ఫోన్ భాష · {language}',
  // On a language that isn't translated yet ({language} = its English name).
  'common.language.soon': '{language} · త్వరలో వస్తుంది',
  'common.language.failed': 'ఆ భాష లోడ్ కాలేదు. ఇంటర్నెట్ చూసి మళ్ళీ ప్రయత్నించండి.',
} as const satisfies Messages
