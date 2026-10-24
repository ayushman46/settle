/** Telugu copy for the split screen (src/features/split). Keys: `split.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const split = {
  // `/app/split/:id/edit` when the expense no longer exists.
  'split.gone.title': 'ఈ ఖర్చు లేదు',
  'split.gone.subtitle': 'ఇది తొలగించబడి ఉండవచ్చు — ఈ ఫోన్‌లో లేదా మరో ట్యాబ్‌లో.',
  'split.gone.cta': 'చరిత్ర చూడండి',
  // The screen's title, heading and tab title.
  'split.screen.new.title': 'కొత్త స్ప్లిట్',
  'split.screen.edit.title': 'స్ప్లిట్ మార్చండి',
  'split.screen.edit.heading': '{title} మార్చండి',
  // The browser tab while editing: "Edit Dinner at Toit · Settle".
  'split.screen.edit.docTitle': '{title} మార్చండి · {brand}',
  'split.save.new.cta': 'స్ప్లిట్ సేవ్ చేయండి',
  'split.save.cta': 'మార్పులు సేవ్ చేయండి',
  'split.currency.toast': 'ఇప్పుడు {code} లో',
  'split.undo.cta': 'వెనక్కి తీసుకోండి',
  'split.saved.title': 'స్ప్లిట్ సేవ్ అయింది',
  // The amount and the details.
  'split.amount.label': 'మొత్తం',
  'split.amount.itemized.label': 'మొత్తం చెల్లించింది',
  'split.amount.itemized.hint': 'పన్ను, టిప్‌లు, డిస్కౌంట్‌లు మళ్ళీ ఐటమ్‌లపై పంచబడతాయి.',
  'split.title.label': 'దేనికోసం?',
  // Under the details when the group keeps balances in another currency.
  'split.groupCurrency.note': '{currency} లో ఉంది కాబట్టి, ఇది వ్యక్తి నుంచి వ్యక్తికి తేలుతుంది — {group} యొక్క {groupCurrency} బ్యాలెన్స్‌లలో కాదు.',
  // The trip tip (travel without a group).
  'split.tip.trip.title': 'మొత్తం ట్రిప్‌ను పంచుతున్నారా?',
  'split.tip.trip.body': 'గ్రూప్‌లో పెట్టండి: ప్రతి ఖర్చూ కలుస్తుంది, చివర్లో {brand} తక్కువ చెల్లింపులతో లెక్క తేలుస్తుంది.',
  'split.tip.trip.cta': 'ట్రిప్ గ్రూప్ మొదలుపెట్టండి',
  'split.tip.trip.dismiss': 'ఈసారికి మాత్రమే',
  // The rent tip.
  'split.tip.rent.cta': 'శాతం ప్రకారం పంచండి',
  'split.tip.rent.body': 'గదులు వేర్వేరు పరిమాణాల్లో ఉన్నాయా? అద్దెను శాతం ప్రకారం పంచడం సాధారణంగా న్యాయంగా ఉంటుంది.',
  // Sections.
  'split.section.items.title': 'ఐటమ్ ఐటమ్‌గా పంచండి',
  'split.section.people.title': 'ఎవరితో పంచాలి',
  'split.section.how.title': 'ఎలా పంచాలి',
  // An itemized bill being edited or copied.
  'split.bill.line': '{items, plural, one {# ఐటమ్} other {# ఐటమ్‌లు}} · {people, plural, one {# వ్యక్తి} other {# మంది}}',
  'split.bill.editing.body': 'ఎవరు ఏది తీసుకున్నారో అలాగే ఉంటుంది. మార్చాలంటే, బిల్లు తెరవండి.',
  'split.bill.copy.body': 'అసలు బిల్లులోని అవే ఐటమ్‌లు, వ్యక్తులు — సేవ్ చేసిన తర్వాత ఎవరు ఏది తీసుకున్నారో మార్చండి.',
  'split.bill.change.cta': 'ఎవరు తీసుకున్నారో మార్చండి',
  // Discard confirm.
  'split.discard.new.title': 'ఈ స్ప్లిట్‌ను తీసేయాలా?',
  'split.discard.title': 'మార్పులను తీసేయాలా?',
  'split.discard.new.description': 'మీరు నమోదు చేసినవి సేవ్ కావు.',
  'split.discard.description': '{title} లో మీ మార్పులు సేవ్ కావు.',
  'split.discard.cta': 'తీసేయండి',
  'split.keep.cta': 'మార్చడం కొనసాగించండి',
  // Where a prefilled split came from.
  'split.origin.describe.title': 'మీరు టైప్ చేసిన దాని నుంచి నింపబడింది',
  'split.origin.scan.title': 'మీ బిల్లు నుంచి నింపబడింది',
  'split.origin.scan.body': 'మొత్తాన్ని చెక్ చేయండి — మసకగా ఉన్న ఫోటోను AI తప్పుగా చదవవచ్చు.',
  'split.origin.recurring.title': 'ఈ నెల {title}',
  'split.origin.recurring.untitled': 'రిపీట్ స్ప్లిట్ నుంచి',
  'split.origin.recurring.body': 'చెక్ చేసి, వసూలు మొదలుపెట్టడానికి సేవ్ చేయండి.',
  'split.origin.duplicate.title': '{title} కాపీ',
  'split.origin.duplicate.untitled': 'ఒక కాపీ',
  'split.origin.duplicate.body': 'ఈ రోజు తేదీతో, ఇంకా ఎవరినీ చెల్లించినట్లు గుర్తించలేదు.',
  'split.origin.sms.title': 'మీ SMS నుంచి నింపబడింది',
  'split.origin.sms.body': 'ఎవరు ఉన్నారో జోడించి, చెక్ చేసి, సేవ్ చేయండి.',
  'split.origin.voice.title': 'మీరు చెప్పిన దాని నుంచి నింపబడింది',
  'split.origin.rotation.title': 'తదుపరి వంతు',
  // Body for "what you typed", "what you said" and the next round.
  'split.origin.check.body': 'మొత్తం, ఎవరు ఉన్నారో చెక్ చేసి, సేవ్ చేయండి.',
  // The note field.
  'split.note.label': 'నోట్',
  'split.note.placeholder': 'గుర్తుంచుకోవాల్సినవి — ఐచ్ఛికం',
  'split.note.full': 'ఇదే పరిమితి',
  'split.note.left': '{count} మిగిలాయి',
  // What saving means (Save's hint) and what it means once saved (the success moment).
  'split.outcome.nothingToCollect': 'వసూలు చేయాల్సింది ఏమీ లేదు — అంతా మీ బాధ్యతే.',
  'split.outcome.one.future': '{name} మీకు {amount} ఇవ్వాల్సి ఉంటుంది',
  'split.outcome.one.now': '{name} మీకు {amount} ఇవ్వాలి',
  // {names}: "Riya and Sam", "Riya, Sam and Ali".
  'split.outcome.each.future': '{names} ఒక్కొక్కరు మీకు {amount} ఇవ్వాల్సి ఉంటుంది',
  'split.outcome.each.now': '{names} ఒక్కొక్కరు మీకు {amount} ఇవ్వాలి',
  'split.outcome.inAll.future': '{names} నుంచి మొత్తం {amount} తిరిగి వస్తుంది',
  'split.outcome.inAll.now': '{names} మీకు మొత్తం {amount} ఇవ్వాలి',
  'split.outcome.many.future': '{count} మంది నుంచి మొత్తం {amount} తిరిగి వస్తుంది',
  'split.outcome.many.now': '{count} మంది మీకు {amount} ఇవ్వాలి',
  'split.outcome.owe.future': 'మీరు {name} గారికి {amount} ఇవ్వాల్సి ఉంటుంది',
  'split.outcome.owe.now': 'మీరు {name} గారికి {amount} ఇవ్వాలి',
  'split.outcome.nothingToPay': 'తిరిగి ఇవ్వాల్సింది ఏమీ లేదు.',
  'split.outcome.getsBack.future': '{name} గారికి {amount} తిరిగి వస్తుంది',
  'split.outcome.getsBack.now': '{name} గారికి {amount} తిరిగి వస్తోంది',
  // After saving an edit.
  'split.changes.toast': 'మార్పులు సేవ్ అయ్యాయి',
  'split.changes.meAgain.toast': 'మార్పులు సేవ్ అయ్యాయి. ఇప్పుడు మీరు ఎక్కువ ఇవ్వాలి, కాబట్టి మీరు ఇంకా చెల్లించలేదని గుర్తించబడ్డారు.',
  'split.changes.othersAgain.toast':
    '{count, plural, one {మార్పులు సేవ్ అయ్యాయి. {names} ఇప్పుడు ఎక్కువ ఇవ్వాలి, కాబట్టి వారు ఇంకా చెల్లించలేదని గుర్తించబడ్డారు.} other {మార్పులు సేవ్ అయ్యాయి. {names} ఇప్పుడు ఎక్కువ ఇవ్వాలి, కాబట్టి వారు ఇంకా చెల్లించలేదని గుర్తించబడ్డారు.}}',
  // Quick starts: the title field's examples per category (and the title a rent split starts with).
  'split.placeholder.food': 'Toit లో డిన్నర్, Swiggy ఆర్డర్…',
  'split.placeholder.groceries': 'Blinkit, DMart, వారపు కూరగాయలు…',
  'split.placeholder.rent': 'అద్దె, మెయింటెనెన్స్, డిపాజిట్…',
  'split.placeholder.utilities': 'కరెంట్, Wi-Fi, గ్యాస్ సిలిండర్…',
  'split.placeholder.travel': 'ఫ్లైట్, హోటల్, గోవా ట్రిప్…',
  'split.placeholder.transport': 'ఎయిర్‌పోర్ట్‌కి Uber, పెట్రోల్…',
  'split.placeholder.shopping': 'Amazon ఆర్డర్, కొత్త కర్టెన్లు…',
  'split.placeholder.entertainment': 'సినిమా టికెట్లు, కాన్సర్ట్…',
  'split.placeholder.subscription': 'Netflix, Spotify, YouTube Premium…',
  'split.placeholder.gift': 'Neha కు బర్త్‌డే గిఫ్ట్…',
  'split.placeholder.health': 'ఫార్మసీ, డాక్టర్ విజిట్…',
  'split.placeholder.other': 'డిన్నర్, అద్దె, క్యాబ్, Netflix…',
  'split.template.rent.title': 'అద్దె',
} as const satisfies Messages
