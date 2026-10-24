/** Marathi copy for Home. Keys: `home.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const home = {
  // The grid of tiles under the header (four per row at 320 px: keep labels short).
  'home.quick.label': 'झटपट पर्याय',
  'home.quick.scan': 'बिल स्कॅन करा',
  'home.quick.split': 'रक्कम वाटा',
  'home.quick.lend': 'उधार द्या / घ्या',
  'home.quick.collect': 'पैसे गोळा करा',
  'home.quick.sms': 'SMS वरून',
  'home.quick.food': 'फूड ऑर्डर',
  'home.quick.group': 'नवीन ग्रुप',
  'home.quick.more': 'आणखी',
  // One-tap starts for everyday splits (a tile each, or in the More sheet).
  'home.template.rent': 'भाडे',
  'home.template.travel': 'ट्रिप',
  'home.template.subscription': 'सबस्क्रिप्शन',
  'home.template.utilities': 'वीज-पाणी',
  'home.template.transport': 'कॅब',
  // The sheet behind the More tile.
  'home.more.title': 'वाटणीचे आणखी मार्ग',
  'home.more.subtitle': 'यापैकी कशासाठीही, फक्त रकमेपासून सुरुवात करा.',
  // "Just say it" — what the AI reading of a sentence shows.
  'home.describe.looksRight': 'बरोबर आहे',
  'home.describe.changeWords': 'मी जे म्हणालो ते बदला',
  'home.describe.off.title': 'AI सहाय्यक सध्या बंद आहे',
  'home.describe.off.body': 'AI शिवायही हाताने काहीही वाटू शकता — फक्त थोडा वेळ लागेल.',
  'home.describe.off.cta': 'हाताने वाटा',
  'home.describe.retry': 'पुन्हा प्रयत्न करा',
  'home.describe.tryOne': 'एक वापरून पहा',
  'home.describe.unlimited': 'अमर्याद AI वाटण्या',
  'home.describe.reading': 'तुमची वाटणी वाचली जात आहे…',
  'home.describe.noAmount': 'पुढच्या स्क्रीनवर रक्कम टाका',
  'home.describe.paidBy': '{name} यांनी दिले · {mode}',
  // The first-run card and the split-now prompt.
  'home.first.title': 'तुमचा पहिला खर्च वाटा',
  'home.first.body': 'जेवण, भाडे, घरी जाणारी कॅब — Settle कोणाचे किती येणे-देणे आहे ते ठरवते आणि UPI ने पैसे परत मिळवून देते.',
  'home.first.split': 'एक खर्च वाटा',
  'home.first.sample': 'नमुना बिल वापरून पहा',
  'home.due.splitNow': 'आत्ता वाटा',
  // "Just say it" — the search pill on Home.
  'home.say.title': 'फक्त सांगा',
  'home.say.placeholder': 'फक्त सांगा…',
  'home.say.label': 'फक्त सांगा: AI ने वाटण्यासाठी एखाद्या खर्चाचे वर्णन करा',
  'home.trust': 'गोपनीयतेसाठी बनवलेले — तुमच्या वाटण्या याच फोनवर राहतात. खाते नाही, जाहिराती नाहीत.',
  'home.people.add': 'जोडा',
} as const satisfies Messages
