/** Telugu copy for share texts and cards (src/share). Keys: `share.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const share = {
  // Category names, in the app and on everything that leaves it (pay links, cards, summaries).
  'share.category.food': 'ఫుడ్ & డ్రింక్స్',
  'share.category.groceries': 'కిరాణా',
  'share.category.rent': 'అద్దె',
  'share.category.utilities': 'బిల్లులు & యుటిలిటీలు',
  'share.category.travel': 'ప్రయాణం & బస',
  'share.category.transport': 'రవాణా',
  'share.category.shopping': 'షాపింగ్',
  'share.category.entertainment': 'వినోదం',
  'share.category.subscription': 'సబ్‌స్క్రిప్షన్లు',
  'share.category.gift': 'బహుమతులు',
  'share.category.health': 'ఆరోగ్యం',
  'share.category.other': 'ఇతర',
  // Reminder ("nudge") tones.
  'share.nudge.tone.friendly': 'స్నేహపూర్వకంగా',
  'share.nudge.tone.funny': 'హాస్యంగా',
  'share.nudge.tone.firm': 'కఠినంగా',
  // Reminder wordings, sent to the friend in the sender's language. `{to}` is their first name,
  // `{amount}` the money, `{what}` what it was for. Keep the same number of wordings per tone.
  'share.nudge.friendly.0': 'హాయ్ {to}! 👋 చిన్న గుర్తు: {what} కు మీ వాటా {amount}. తొందర లేదు!',
  'share.nudge.friendly.1': 'హాయ్ {to} 🙂 {what} కు మీ వాటా {amount} అవుతుంది. మీకు వీలైనప్పుడు తీర్చండి!',
  'share.nudge.friendly.2': 'హాయ్ {to}, బాగున్నారా? ఒక చిన్న విషయం: {what} కు {amount}. చాలా ధన్యవాదాలు 🙏',
  'share.nudge.friendly.3': '{to}! {what} కోసం చిన్న గుర్తు: మీ వాటా {amount}. ధన్యవాదాలు 😊',
  'share.nudge.funny.0': 'టక్ టక్, {to} 🚪 ఎవరది? {amount}. {amount} ఎవరు? {what} కి {amount} 😄',
  'share.nudge.funny.1': 'బ్రేకింగ్ న్యూస్ 📰 {what} కి {amount} చివరిసారి మీ వైపు వస్తూ కనిపించింది, {to}. ఇంటికి దారి చూపించండి 🏠',
  'share.nudge.funny.2': '{to}, నా వాలెట్ మీ గురించి అడుగుతూనే ఉంది 👀 {what} కి {amount}, మీకు వీలైనప్పుడు!',
  'share.nudge.funny.3': 'ట్విస్ట్, {to}: {what} ఉచితం కాలేదు 🍿 మీ వాటా {amount} 😅',
  'share.nudge.firm.0': 'హాయ్ {to}, {what} కి {amount} ఇంకా పెండింగ్‌లో ఉందని గుర్తు చేస్తున్నాం. దయచేసి ఈరోజే తీర్చండి.',
  'share.nudge.firm.1': 'హాయ్ {to}, {what} కి మీ వాటా {amount} చెల్లించాల్సి ఉంది. దయచేసి వీలైనంత త్వరగా చెల్లించండి.',
  'share.nudge.firm.2': '{to}, {what} కి {amount} గురించి ఫాలో-అప్. ఈరోజే క్లియర్ చేయగలరా?',
  // The words before the pay link at the end of a reminder ("Tap to pay: https://…").
  'share.nudge.link.friendly': 'చెల్లించడానికి ట్యాప్ చేయండి',
  'share.nudge.link.funny': 'ఒక్క ట్యాప్‌తో మనం సమం',
  'share.nudge.link.firm': 'ఇక్కడ చెల్లించండి',
  // The UPI line of a reminder.
  'share.nudge.upi.mine': 'నా UPI: {upi}',
  'share.nudge.upi': '{name} గారికి UPI లో చెల్లించండి: {upi}',
  // Greeting when there's no name ("Hey there!"), and what it was for when there's no title.
  'share.nudge.there': 'మిత్రమా',
  'share.nudge.ourSplit': 'మన స్ప్లిట్',
  // A UPI payment request sent from the pay sheet (then "Pay Riya on UPI: …" and the link).
  'share.upiRequest.for': 'హాయ్ {name}, {merchant} కు మీ వాటా {amount}.',
  'share.upiRequest.bill': 'హాయ్ {name}, బిల్లులో మీ వాటా {amount}.',
  'share.upiRequest.tap': 'లేదా చెల్లించడానికి ట్యాప్ చేయండి: {link}',
  // The full text summary of a split ("Copy text").
  'share.summary.total': 'మొత్తం {amount}',
  'share.summary.totalSplit': 'మొత్తం {amount} · {count, plural, one {# పద్ధతిలో} other {# పద్ధతుల్లో}} పంచబడింది',
  // After the payer's amount: "Ayush   ₹691.50 · paid the bill".
  'share.summary.paidTheBill': 'బిల్లు చెల్లించారు',
  'share.summary.payUpi': '{name} గారికి UPI లో చెల్లించండి: {upi}',
  'share.summary.payTap': 'ఒక్క ట్యాప్‌లో చెల్లించండి: {link}',
  'share.summary.footer': '— {brand} తో పంచుకున్నది',
  // The short message that carries a pay link into the group chat. 🧾 starts the first line.
  'share.message.settled': '🧾 {title} · అన్నీ తేలాయి ✓',
  'share.message.total': '🧾 {title} · {amount}',
  'share.message.split': '🧾 {title} · {amount} ను {count} మందితో పంచారు',
  'share.message.see': 'స్ప్లిట్ చూడండి 👇',
  'share.message.payMe': 'ఏ UPI యాప్‌తోనైనా నాకు చెల్లించడానికి మీ పేరు ట్యాప్ చేయండి 👇',
  'share.message.pay': 'ఏ UPI యాప్‌తోనైనా {name} గారికి చెల్లించడానికి మీ పేరు ట్యాప్ చేయండి 👇',
  'share.message.seeShare': 'మీ వాటా చూడడానికి మీ పేరు ట్యాప్ చేయండి 👇',
  // The share card image of a split (drawn in the sender's language).
  'share.card.morePeople': '{count, plural, one {ఇంకా # వ్యక్తి} other {ఇంకా # మంది}}',
  'share.card.paidBy': '{name} చెల్లించారు',
  'share.card.splitWays': '{count, plural, one {# పద్ధతిలో} other {# పద్ధతుల్లో}} పంచబడింది',
  'share.card.status.payer': 'బిల్లు చెల్లించారు',
  'share.card.status.paid': 'తిరిగి చెల్లించారు',
  'share.card.status.owes': 'ఇంకా చెల్లించాలి',
  'share.card.status.zero': 'చెల్లించాల్సింది లేదు',
  'share.card.paidCount': '{count} లో {paid} చెల్లించారు',
  'share.card.allSettled': 'అంతా తేలింది',
  'share.card.collected': '{owed} లో {collected} వసూలైంది',
  'share.card.madeWith': '{brand} తో తయారు చేయబడింది',
  // Names when there's nothing better to show (the owner, a removed friend).
  'share.card.me': 'నేను',
  'share.card.friend': 'స్నేహితుడు',
  // The group summary card.
  'share.card.kind.trip': 'ట్రిప్',
  'share.card.kind.home': 'ఇల్లు',
  'share.card.kind.couple': 'జంట',
  'share.card.kind.event': 'ఈవెంట్',
  'share.card.kind.other': 'గ్రూప్',
  'share.card.someone': 'ఎవరో ఒకరు',
  'share.card.someone.object': 'ఎవరో ఒకరు',
  'share.card.pays': '{from} {to} గారికి చెల్లిస్తారు',
  'share.card.people': '{count, plural, one {# వ్యక్తి} other {# మంది}}',
  'share.card.expenses': '{count, plural, one {# ఖర్చు} other {# ఖర్చులు}}',
  'share.card.totalSpent': 'మొత్తం ఖర్చు',
  'share.card.settled': 'అందరి లెక్కా తేలింది',
  'share.card.settled.body': 'చెల్లింపులు అవసరం లేదు',
  'share.card.empty': 'ఇంకా తేల్చాల్సింది లేదు',
  'share.card.empty.body': 'ఇప్పటివరకు ఖర్చులు లేవు',
  'share.card.payments': '{count, plural, one {# చెల్లింపు} other {# చెల్లింపులు}}',
  'share.card.toSettle': 'లెక్క తేల్చాల్సింది',
  'share.card.morePayments': '{count, plural, one {ఇంకా # చెల్లింపు} other {ఇంకా # చెల్లింపులు}}',
  // Names used when a person never gave one (share/fallbacks.ts): the organiser or payee, a numbered person, anyone unnamed.
  'share.fallback.friend': 'మీ స్నేహితుడు',
  'share.fallback.person': 'వ్యక్తి {n}',
  'share.fallback.someone': 'ఎవరో ఒకరు',
  // The note on a UPI payment that has no title (it shows in the payer's UPI app).
  'share.upi.note': 'బిల్ స్ప్లిట్',
  // Why a share card image couldn't be made.
  'share.card.error.canvas': 'ఈ బ్రౌజర్ ఇమేజ్‌లు గీయలేదు',
  'share.card.error.render': 'ఇమేజ్ సృష్టించలేకపోయాం',
} as const satisfies Messages
