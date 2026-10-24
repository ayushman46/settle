/** Marathi copy for the app shell: tabs, page titles, storage and crash screens. Keys: `app.<area>.<element>`. */
import type { Messages } from '../types'

export const app = {
  // The bottom tabs.
  'app.tab.home': 'होम',
  'app.tab.groups': 'ग्रुप',
  'app.tab.activity': 'व्यवहार',
  'app.tab.you': 'तुम्ही',

  // The browser tab's title: "{page} · Settle".
  'app.title.format': '{page} · {brand}',
  // Page names for the browser tab (one per screen).
  'app.title.home': 'होम',
  'app.title.welcome': 'स्वागत',
  'app.title.groups': 'ग्रुप',
  'app.title.group': 'ग्रुप',
  'app.title.settleUp': 'हिशोब मिटवा',
  'app.title.activity': 'व्यवहार',
  'app.title.you': 'तुम्ही',
  'app.title.newSplit': 'नवीन वाटणी',
  'app.title.editSplit': 'वाटणी बदला',
  'app.title.fromSms': 'SMS वरून',
  'app.title.lend': 'उधार द्या किंवा घ्या',
  'app.title.editLend': 'उधारी बदला',
  'app.title.expense': 'खर्च',
  'app.title.claims': 'दावे',
  'app.title.people': 'लोक',
  'app.title.person': 'व्यक्ती',
  'app.title.insights': 'विश्लेषण',
  'app.title.recurring': 'नियमित वाटणी',
  'app.title.newRecurring': 'नवीन नियमित वाटणी',
  'app.title.recurringOne': 'नियमित वाटणी',
  'app.title.collections': 'वर्गणी',
  'app.title.newCollection': 'नवीन वर्गणी',
  'app.title.collection': 'वर्गणी',
  'app.title.editCollection': 'वर्गणी बदला',
  'app.title.pro': 'Pro',

  // When the phone won't save (storage full or blocked).
  'app.storage.title': 'हा फोन तुमचे बदल सेव्ह करत नाहीये',
  'app.storage.body': 'स्टोरेज भरले असेल किंवा बंद असेल. थोडी जागा मोकळी करा — {brand} उघडे असताना सर्व काही इथेच राहील.',

  // While a screen's code loads.
  'app.loading.aria': 'लोड होत आहे',

  // A screen that crashed or couldn't load.
  'app.crash.title': 'काहीतरी चुकले',
  'app.crash.body': 'क्षमस्व. पुन्हा प्रयत्न करा, किंवा होमला परत जा — तुमच्या वाटण्या सुरक्षित आहेत.',
  'app.crash.retry.cta': 'पुन्हा प्रयत्न करा',
  'app.crash.home.cta': 'होमला जा',
  'app.crash.offline.title': 'तुम्ही ऑफलाइन आहात',
  'app.crash.offline.body': 'हे पान पहिल्यांदा उघडण्यासाठी इंटरनेट लागते. कनेक्शन परत आणून पुन्हा प्रयत्न करा.',
  'app.crash.updated.title': '{brand} अपडेट झाले आहे',
  'app.crash.updated.body': 'नवीनतम आवृत्ती मिळवण्यासाठी पुन्हा लोड करा — तुमच्या वाटण्या या फोनवर सुरक्षित आहेत.',
  'app.crash.reload.cta': 'पुन्हा लोड करा',
} as const satisfies Messages
