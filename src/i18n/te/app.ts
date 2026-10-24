/** Telugu copy for the app shell (src/app). Keys: `app.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const app = {
  // The bottom tabs.
  'app.tab.home': 'హోమ్',
  'app.tab.groups': 'గ్రూప్‌లు',
  'app.tab.activity': 'చరిత్ర',
  'app.tab.you': 'మీరు',
  // The browser tab's title: "{page} · Settle".
  'app.title.format': '{page} · {brand}',
  // Page names for the browser tab (one per screen).
  'app.title.home': 'హోమ్',
  'app.title.welcome': 'స్వాగతం',
  'app.title.groups': 'గ్రూప్‌లు',
  'app.title.group': 'గ్రూప్',
  'app.title.settleUp': 'లెక్క తేల్చండి',
  'app.title.activity': 'చరిత్ర',
  'app.title.you': 'మీరు',
  'app.title.newSplit': 'కొత్త స్ప్లిట్',
  'app.title.editSplit': 'స్ప్లిట్ మార్చండి',
  'app.title.fromSms': 'SMS నుంచి',
  'app.title.lend': 'అప్పు ఇవ్వండి లేదా తీసుకోండి',
  'app.title.editLend': 'అప్పు మార్చండి',
  'app.title.expense': 'ఖర్చు',
  'app.title.claims': 'క్లెయిమ్‌లు',
  'app.title.people': 'వ్యక్తులు',
  'app.title.person': 'వ్యక్తి',
  'app.title.insights': 'ఇన్‌సైట్‌లు',
  'app.title.recurring': 'రిపీట్ స్ప్లిట్‌లు',
  'app.title.newRecurring': 'కొత్త రిపీట్ స్ప్లిట్',
  'app.title.recurringOne': 'రిపీట్ స్ప్లిట్',
  'app.title.collections': 'వసూళ్లు',
  'app.title.newCollection': 'కొత్త వసూలు',
  'app.title.collection': 'వసూలు',
  'app.title.editCollection': 'వసూలు మార్చండి',
  'app.title.pro': 'Pro',
  // When the phone won't save (storage full or blocked).
  'app.storage.title': 'ఈ ఫోన్ మీ మార్పులను సేవ్ చేయడం లేదు',
  'app.storage.body': 'స్టోరేజ్ నిండిపోయి ఉండవచ్చు లేదా బ్లాక్ అయి ఉండవచ్చు. కొంత స్థలం ఖాళీ చేయండి — {brand} తెరిచి ఉన్నంతవరకు అన్నీ ఇక్కడే ఉంటాయి.',
  // While a screen's code loads.
  'app.loading.aria': 'లోడ్ అవుతోంది',
  // A screen that crashed or couldn't load.
  'app.crash.title': 'ఏదో తప్పు జరిగింది',
  'app.crash.body': 'క్షమించండి. మళ్ళీ ప్రయత్నించండి, లేదా హోమ్‌కు వెళ్లండి — మీ స్ప్లిట్‌లు సురక్షితంగా ఉన్నాయి.',
  'app.crash.retry.cta': 'మళ్ళీ ప్రయత్నించండి',
  'app.crash.home.cta': 'హోమ్‌కు వెళ్లండి',
  'app.crash.offline.title': 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు',
  'app.crash.offline.body': 'ఈ స్క్రీన్ మొదటిసారి తెరిచేటప్పుడు కనెక్షన్ కావాలి. మళ్ళీ కనెక్ట్ చేసి ప్రయత్నించండి.',
  'app.crash.updated.title': '{brand} అప్‌డేట్ అయింది',
  'app.crash.updated.body': 'తాజా వెర్షన్ కోసం రీలోడ్ చేయండి — మీ స్ప్లిట్‌లు ఈ ఫోన్‌లో సురక్షితంగా ఉన్నాయి.',
  'app.crash.reload.cta': 'రీలోడ్ చేయండి',
} as const satisfies Messages
