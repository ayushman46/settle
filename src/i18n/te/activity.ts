/** Telugu copy for Activity (src/features/activity). Keys: `activity.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const activity = {
  // The screen.
  'activity.title': 'చరిత్ర',
  'activity.newSplit.cta': 'కొత్త స్ప్లిట్',
  // Nothing split yet (first run).
  'activity.firstRun.title': 'మీ స్ప్లిట్‌లు ఇక్కడ ఉంటాయి',
  'activity.firstRun.body': 'మీరు పంచే ప్రతి ఖర్చు కొత్తది ముందు వచ్చేలా ఇక్కడ కనిపిస్తుంది — ఎవరు మీకు తిరిగి ఇచ్చారో, ఎవరు ఇవ్వలేదో కలిపి.',
  'activity.firstRun.split.cta': 'మొత్తం పంచండి',
  'activity.firstRun.scan.cta': 'బిల్లు స్కాన్ చేయండి',
  // A filter with nothing in it.
  'activity.empty.all.title': 'ఇంకా ఖర్చులు లేవు',
  'activity.empty.all.body': 'ఏదైనా పంచండి, అది ఇక్కడ కనిపిస్తుంది.',
  'activity.empty.collect.title': 'వసూలు చేయాల్సింది ఏమీ లేదు',
  'activity.empty.collect.body': 'అందరూ మీకు తిరిగి ఇచ్చేశారు. బాగుంది.',
  'activity.empty.pay.title': 'లెక్క సరిగ్గా ఉంది',
  'activity.empty.pay.body': 'ప్రస్తుతం మీరు ఎవరికీ బాకీ లేరు.',
  'activity.empty.bills.title': 'ఇంకా బిల్లులు లేవు',
  // {brand} is the app's name (Settle).
  'activity.empty.bills.body': 'రెస్టారెంట్ బిల్లును ఫోటో తీయండి, {brand} దాన్ని ఐటమ్ ఐటమ్‌గా పంచుతుంది.',
  'activity.empty.groups.title': 'ఇంకా గ్రూప్ ఖర్చులు లేవు',
  'activity.empty.groups.body': 'ట్రిప్‌లు, ఫ్లాట్‌లు, జంటలు — షేర్ ఖర్చులను ఒక గ్రూప్‌లో ఉంచండి.',
  'activity.empty.settled.title': 'ఇంకా ఏదీ తేలలేదు',
  'activity.empty.settled.body': 'అందరూ లెక్క తేల్చాక స్ప్లిట్‌లు ఇక్కడ కనిపిస్తాయి.',
  'activity.empty.scan.cta': 'బిల్లు స్కాన్ చేయండి',
  'activity.empty.groups.cta': 'గ్రూప్‌లకు వెళ్లండి',
  // A search that finds nothing ({query} is what was typed).
  'activity.noMatches.title': '“{query}” కు ఫలితాలు లేవు',
  'activity.noMatches.body': 'ఒక పేరు, ప్రదేశం లేదా మొత్తాన్ని ప్రయత్నించండి.',
  'activity.noMatches.cta': 'అన్ని చరిత్రను చూపించు',
  // Groups that aren't square, listed above the splits under "To collect" / "To pay".
  'activity.groups.owed.title': 'గ్రూప్‌లలో మీకు రావాల్సింది',
  'activity.groups.owe.title': 'గ్రూప్‌లలో మీరు ఇవ్వాల్సింది',
  'activity.groups.description': 'గ్రూప్ ఖర్చులను అందరూ కలిసి తేల్చుకుంటారు.',
  'activity.groups.row.subtitle': 'లెక్క తేల్చండి',
  // Spoken name of a group's row: {group} its name, {amount} formatted money.
  'activity.groups.row.owed.aria': '{group}: మీకు {amount} రావాలి. లెక్క తేల్చండి',
  'activity.groups.row.owe.aria': '{group}: మీరు {amount} ఇవ్వాలి. లెక్క తేల్చండి',
  // The filter chips.
  'activity.filters.aria': 'చూపించు',
  'activity.filter.all.chip': 'అన్నీ',
  'activity.filter.collect.chip': 'వసూలు చేయాలి',
  'activity.filter.pay.chip': 'చెల్లించాలి',
  'activity.filter.bills.chip': 'బిల్లులు',
  'activity.filter.groups.chip': 'గ్రూప్‌లు',
  'activity.filter.settled.chip': 'తేలినవి',
  // Spoken name of a chip with a count bubble: "To collect, 3".
  'activity.filter.counted.aria': '{label}, {count}',
  // The search pill.
  'activity.search.label': 'చరిత్రలో వెతకండి',
  'activity.search.placeholder': 'పేర్లు, ప్రదేశాలు లేదా మొత్తాలు వెతకండి',
  'activity.search.clear.aria': 'వెతుకులాట తీసేయండి',
  // The line under the chips, summing up what's listed (also read out as the list changes).
  'activity.results.noMatches': '“{query}” కు ఫలితాలు లేవు',
  'activity.results.matches': '“{query}” కు {count, plural, one {# ఫలితం} other {# ఫలితాలు}}',
  'activity.results.nothing.all': 'ఇంకా ఖర్చులు లేవు',
  'activity.results.nothing.collect': 'వసూలు చేయాల్సింది ఏమీ లేదు',
  'activity.results.nothing.pay': 'చెల్లించాల్సింది ఏమీ లేదు',
  'activity.results.nothing.bills': 'ఇంకా బిల్లులు లేవు',
  'activity.results.nothing.groups': 'ఇంకా గ్రూప్ ఖర్చులు లేవు',
  'activity.results.nothing.settled': 'ఇంకా ఏదీ తేలలేదు',
  'activity.results.all': '{count, plural, one {# ఖర్చు} other {# ఖర్చులు}}',
  // {sum}: formatted money, several currencies joined with " + ".
  'activity.results.collect': '{count, plural, one {# స్ప్లిట్‌పై} other {# స్ప్లిట్‌లపై}} {sum} వసూలు చేయాలి',
  'activity.results.pay': '{count, plural, one {# స్ప్లిట్‌పై} other {# స్ప్లిట్‌లపై}} మీరు {sum} ఇవ్వాలి',
  'activity.results.bills': '{count, plural, one {# బిల్లు} other {# బిల్లులు}}',
  'activity.results.groups': '{count, plural, one {# గ్రూప్ ఖర్చు} other {# గ్రూప్ ఖర్చులు}}',
  'activity.results.settled': '{count, plural, one {# ఖర్చు తేలింది} other {# ఖర్చులు తేలాయి}}',
  // Only groups listed (read by screen readers only).
  'activity.results.owedInGroups': '{count, plural, one {# గ్రూప్‌లో} other {# గ్రూప్‌లలో}} మీకు రావాల్సింది',
  'activity.results.oweInGroups': '{count, plural, one {# గ్రూప్‌లో} other {# గ్రూప్‌లలో}} మీరు ఇవ్వాల్సింది',
  // Month sections.
  'activity.month.undated': 'తేదీ లేనివి',
} as const satisfies Messages
