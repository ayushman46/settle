/** Marathi copy for the split editor (new split, edit, outcomes, origins, placeholders). Keys: `split.<part>.<element>`. */
import type { Messages } from '../types'

export const split = {
  // `/app/split/:id/edit` when the expense no longer exists.
  'split.gone.title': 'हा खर्च आता नाही',
  'split.gone.subtitle': 'कदाचित हटवला गेला असेल — या फोनवर किंवा दुसऱ्या टॅबमध्ये.',
  'split.gone.cta': 'व्यवहार पहा',

  // The screen's title, heading and tab title.
  'split.screen.new.title': 'नवीन वाटणी',
  'split.screen.edit.title': 'वाटणी बदला',
  'split.screen.edit.heading': '{title} बदला',
  // The browser tab while editing: "Edit Dinner at Toit · Settle".
  'split.screen.edit.docTitle': '{title} बदला · {brand}',
  'split.save.new.cta': 'वाटणी सेव्ह करा',
  'split.save.cta': 'बदल सेव्ह करा',
  'split.currency.toast': 'आता {code} मध्ये',
  'split.undo.cta': 'पूर्ववत करा',
  'split.saved.title': 'वाटणी सेव्ह झाली',

  // The amount and the details.
  'split.amount.label': 'रक्कम',
  'split.amount.itemized.label': 'एकूण दिलेले',
  'split.amount.itemized.hint': 'कर, टिप आणि सवलती पुन्हा वस्तूंमध्ये वाटल्या जातील.',
  'split.title.label': 'हे कशासाठी आहे?',
  // Under the details when the group keeps balances in another currency.
  'split.groupCurrency.note': '{currency} मध्ये असल्याने, हे व्यक्तीकडून व्यक्तीकडे मिटवले जाईल — {group} च्या {groupCurrency} शिलकीत नाही.',

  // The trip tip (travel without a group).
  'split.tip.trip.title': 'संपूर्ण ट्रिपचा खर्च वाटायचा आहे?',
  'split.tip.trip.body': 'एका ग्रुपमध्ये ठेवा: प्रत्येक खर्च जमा होईल, आणि {brand} शेवटी कमीत कमी पेमेंट काढून देईल.',
  'split.tip.trip.cta': 'ट्रिप ग्रुप सुरू करा',
  'split.tip.trip.dismiss': 'फक्त यावेळी',
  // The rent tip.
  'split.tip.rent.cta': 'टक्केवारीने वाटा',
  'split.tip.rent.body': 'खोल्यांचे आकार वेगळे आहेत? भाडे अनेकदा टक्केवारीने वाटले तर न्याय्य वाटते.',

  // Sections.
  'split.section.items.title': 'वस्तूनुसार वाटा',
  'split.section.people.title': 'यांच्यासोबत वाटा',
  'split.section.how.title': 'कसे वाटायचे',

  // An itemized bill being edited or copied.
  'split.bill.line': '{items, plural, one {# वस्तू} other {# वस्तू}} · {people, plural, one {# व्यक्ती} other {# जण}}',
  'split.bill.editing.body': 'कोणी काय घेतले ते जसे आहे तसेच राहील. बदलण्यासाठी बिल उघडा.',
  'split.bill.copy.body': 'मूळ बिलासारख्याच वस्तू आणि लोक — सेव्ह केल्यानंतर कोणी काय घेतले ते बदला.',
  'split.bill.change.cta': 'कोणी काय घेतले ते बदला',

  // Discard confirm.
  'split.discard.new.title': 'ही वाटणी टाकून द्यायची?',
  'split.discard.title': 'बदल टाकून द्यायचे?',
  'split.discard.new.description': 'तुम्ही जे टाकले ते सेव्ह होणार नाही.',
  'split.discard.description': '{title} मधील तुमचे बदल सेव्ह होणार नाहीत.',
  'split.discard.cta': 'टाकून द्या',
  'split.keep.cta': 'संपादन सुरू ठेवा',

  // Where a prefilled split came from.
  'split.origin.describe.title': 'तुम्ही लिहिलेल्यावरून भरले',
  'split.origin.scan.title': 'तुमच्या बिलावरून भरले',
  'split.origin.scan.body': 'रक्कम तपासा — AI अंधुक फोटो चुकीचा वाचू शकतो.',
  'split.origin.recurring.title': 'या महिन्याचे {title}',
  'split.origin.recurring.untitled': 'नियमित वाटणीवरून',
  'split.origin.recurring.body': 'तपासा, मग सेव्ह करा — पैसे गोळा करणे सुरू करण्यासाठी.',
  'split.origin.duplicate.title': '{title} ची एक प्रत',
  'split.origin.duplicate.untitled': 'एक प्रत',
  'split.origin.duplicate.body': 'आजच्या तारखेची, आणि अजून कोणीही दिले म्हणून चिन्हांकित नाही.',
  'split.origin.sms.title': 'तुमच्या SMS वरून भरले',
  'split.origin.sms.body': 'यात कोण आहे ते जोडा, तपासा, मग सेव्ह करा.',
  'split.origin.voice.title': 'तुम्ही सांगितलेल्यावरून भरले',
  'split.origin.rotation.title': 'पुढची पाळी',
  // Body for "what you typed", "what you said" and the next round.
  'split.origin.check.body': 'रक्कम आणि कोण आहेत ते तपासा, मग सेव्ह करा.',

  // The note field.
  'split.note.label': 'नोंद',
  'split.note.placeholder': 'लक्षात ठेवायचे काही — ऐच्छिक',
  'split.note.full': 'हीच मर्यादा आहे',
  'split.note.left': '{count} शिल्लक',

  // What saving means (Save's hint) and what it means once saved (the success moment).
  'split.outcome.nothingToCollect': 'गोळा करण्यासारखे काही नाही — सगळे तुमच्यावरच आहे.',
  'split.outcome.one.future': '{name} तुम्हाला {amount} देणार',
  'split.outcome.one.now': '{name} तुम्हाला {amount} देणे लागतात',
  // {names}: "Riya and Sam", "Riya, Sam and Ali".
  'split.outcome.each.future': '{names} प्रत्येकी तुम्हाला {amount} देतील',
  'split.outcome.each.now': '{names} प्रत्येकी तुम्हाला {amount} देणे लागतात',
  'split.outcome.inAll.future': '{names} कडून एकूण {amount} परत मिळतील',
  'split.outcome.inAll.now': '{names} कडून एकूण {amount} येणे आहे',
  'split.outcome.many.future': '{count} जणांकडून एकूण {amount} परत मिळतील',
  'split.outcome.many.now': '{count} जण तुम्हाला {amount} देणे लागतात',
  'split.outcome.owe.future': 'तुम्ही {name} यांना {amount} देणार',
  'split.outcome.owe.now': 'तुम्ही {name} यांना {amount} देणे लागता',
  'split.outcome.nothingToPay': 'परत देण्यासारखे काही नाही.',
  'split.outcome.getsBack.future': '{name} यांना {amount} परत मिळतील',
  'split.outcome.getsBack.now': '{name} यांना {amount} परत मिळत आहेत',

  // After saving an edit.
  'split.changes.toast': 'बदल सेव्ह झाले',
  'split.changes.meAgain.toast': 'बदल सेव्ह झाले. आता तुमचे देणे वाढले आहे, म्हणून तुम्ही अजून दिले नाही असे चिन्हांकित केले आहे.',
  'split.changes.othersAgain.toast':
    '{count, plural, one {बदल सेव्ह झाले. {names} आता जास्त देणे लागतात, म्हणून ते अजून दिले नाही असे चिन्हांकित केले आहेत.} other {बदल सेव्ह झाले. {names} आता जास्त देणे लागतात, म्हणून ते अजून दिले नाही असे चिन्हांकित केले आहेत.}}',

  // Quick starts: the title field's examples per category (and the title a rent split starts with).
  'split.placeholder.food': 'Toit मध्ये जेवण, Swiggy ऑर्डर…',
  'split.placeholder.groceries': 'Blinkit, DMart, आठवड्याची भाजी…',
  'split.placeholder.rent': 'भाडे, देखभाल, डिपॉझिट…',
  'split.placeholder.utilities': 'वीज बिल, Wi-Fi, गॅस सिलिंडर…',
  'split.placeholder.travel': 'फ्लाइट, हॉटेल, गोवा ट्रिप…',
  'split.placeholder.transport': 'विमानतळावर Uber, इंधन…',
  'split.placeholder.shopping': 'Amazon ऑर्डर, नवीन पडदे…',
  'split.placeholder.entertainment': 'सिनेमाची तिकिटे, कॉन्सर्ट…',
  'split.placeholder.subscription': 'Netflix, Spotify, YouTube Premium…',
  'split.placeholder.gift': 'नेहाला वाढदिवसाची भेट…',
  'split.placeholder.health': 'मेडिकल, डॉक्टरांची भेट…',
  'split.placeholder.other': 'जेवण, भाडे, कॅब, Netflix…',
  'split.template.rent.title': 'भाडे',
} as const satisfies Messages
