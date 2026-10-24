/** Marathi copy for Activity (the list of every split, search and filters). Keys: `activity.<part>.<element>`. */
import type { Messages } from '../types'

export const activity = {
  // The screen.
  'activity.title': 'व्यवहार',
  'activity.newSplit.cta': 'नवीन वाटणी',

  // Nothing split yet (first run).
  'activity.firstRun.title': 'तुमच्या वाटण्या इथे राहतील',
  'activity.firstRun.body': 'तुम्ही वाटलेला प्रत्येक खर्च इथे दिसेल, सर्वात नवीन आधी — कोणी पैसे परत दिले आणि कोणी नाही, तेही.',
  'activity.firstRun.split.cta': 'रक्कम वाटा',
  'activity.firstRun.scan.cta': 'बिल स्कॅन करा',

  // A filter with nothing in it.
  'activity.empty.all.title': 'अजून कोणताही खर्च नाही',
  'activity.empty.all.body': 'काहीतरी वाटा आणि ते इथे दिसेल.',
  'activity.empty.collect.title': 'गोळा करण्यासारखे काही नाही',
  'activity.empty.collect.body': 'सर्वांनी तुमचे पैसे परत केले आहेत. छान.',
  'activity.empty.pay.title': 'तुमचा हिशोब बरोबर आहे',
  'activity.empty.pay.body': 'सध्या तुम्ही कोणाचेही देणे लागत नाही.',
  'activity.empty.bills.title': 'अजून बिल नाही',
  // {brand} is the app's name (Settle).
  'activity.empty.bills.body': 'हॉटेलच्या बिलाचा फोटो घ्या, {brand} ते वस्तूनुसार वाटून देईल.',
  'activity.empty.groups.title': 'अजून ग्रुप खर्च नाही',
  'activity.empty.groups.body': 'ट्रिप, फ्लॅट, जोडपी — सामायिक खर्च एका ग्रुपमध्ये ठेवा.',
  'activity.empty.settled.title': 'अजून काही मिटलेले नाही',
  'activity.empty.settled.body': 'सगळ्यांचा हिशोब बरोबर झाल्यावर वाटण्या इथे येतील.',
  'activity.empty.scan.cta': 'बिल स्कॅन करा',
  'activity.empty.groups.cta': 'ग्रुपवर जा',

  // A search that finds nothing ({query} is what was typed).
  'activity.noMatches.title': '“{query}” साठी काही जुळले नाही',
  'activity.noMatches.body': 'नाव, ठिकाण किंवा रक्कम टाकून पहा.',
  'activity.noMatches.cta': 'सर्व व्यवहार दाखवा',

  // Groups that aren't square, listed above the splits under "To collect" / "To pay".
  'activity.groups.owed.title': 'ग्रुपमध्ये तुम्हाला येणे',
  'activity.groups.owe.title': 'ग्रुपमध्ये तुमचे देणे',
  'activity.groups.description': 'ग्रुपचे खर्च एकत्र मिटवले जातात.',
  'activity.groups.row.subtitle': 'हिशोब मिटवा',
  // Spoken name of a group's row: {group} its name, {amount} formatted money.
  'activity.groups.row.owed.aria': '{group}: तुम्हाला {amount} येणे आहे. हिशोब मिटवा',
  'activity.groups.row.owe.aria': '{group}: तुमचे {amount} देणे आहे. हिशोब मिटवा',

  // The filter chips.
  'activity.filters.aria': 'दाखवा',
  'activity.filter.all.chip': 'सर्व',
  'activity.filter.collect.chip': 'गोळा करायचे',
  'activity.filter.pay.chip': 'द्यायचे',
  'activity.filter.bills.chip': 'बिले',
  'activity.filter.groups.chip': 'ग्रुप',
  'activity.filter.settled.chip': 'मिटलेले',
  // Spoken name of a chip with a count bubble: "To collect, 3".
  'activity.filter.counted.aria': '{label}, {count}',

  // The search pill.
  'activity.search.label': 'व्यवहार शोधा',
  'activity.search.placeholder': 'नावे, ठिकाणे किंवा रक्कम शोधा',
  'activity.search.clear.aria': 'शोध पुसा',

  // The line under the chips, summing up what's listed (also read out as the list changes).
  'activity.results.noMatches': '“{query}” साठी काही जुळले नाही',
  'activity.results.matches': '{count, plural, one {“{query}” साठी # जुळणी} other {“{query}” साठी # जुळणी}}',
  'activity.results.nothing.all': 'अजून कोणताही खर्च नाही',
  'activity.results.nothing.collect': 'गोळा करण्यासारखे काही नाही',
  'activity.results.nothing.pay': 'देण्यासारखे काही नाही',
  'activity.results.nothing.bills': 'अजून बिल नाही',
  'activity.results.nothing.groups': 'अजून ग्रुप खर्च नाही',
  'activity.results.nothing.settled': 'अजून काही मिटलेले नाही',
  'activity.results.all': '{count, plural, one {# खर्च} other {# खर्च}}',
  // {sum}: formatted money, several currencies joined with " + ".
  'activity.results.collect': '{sum} गोळा करायचे, {count, plural, one {# वाटणीवर} other {# वाटण्यांवर}}',
  'activity.results.pay': '{count, plural, one {# वाटणीवर} other {# वाटण्यांवर}} तुमचे {sum} देणे आहे',
  'activity.results.bills': '{count, plural, one {# बिल} other {# बिले}}',
  'activity.results.groups': '{count, plural, one {# ग्रुप खर्च} other {# ग्रुप खर्च}}',
  'activity.results.settled': '{count, plural, one {# खर्च} other {# खर्च}} मिटवले',
  // Only groups listed (read by screen readers only).
  'activity.results.owedInGroups': '{count, plural, one {# ग्रुपमध्ये} other {# ग्रुपमध्ये}} तुम्हाला येणे',
  'activity.results.oweInGroups': '{count, plural, one {# ग्रुपमध्ये} other {# ग्रुपमध्ये}} तुमचे देणे',

  // Month sections.
  'activity.month.undated': 'तारखेशिवाय',
} as const satisfies Messages
