/** Marathi copy for what leaves the app: category names, reminder texts, pay requests, summaries, share messages and cards. Keys: `share.<area>.<element>`. */
import type { Messages } from '../types'

export const share = {
  // Category names, in the app and on everything that leaves it (pay links, cards, summaries).
  'share.category.food': 'जेवण आणि पेय',
  'share.category.groceries': 'किराणा',
  'share.category.rent': 'भाडे',
  'share.category.utilities': 'बिले आणि युटिलिटी',
  'share.category.travel': 'प्रवास आणि राहणे',
  'share.category.transport': 'वाहतूक',
  'share.category.shopping': 'खरेदी',
  'share.category.entertainment': 'मनोरंजन',
  'share.category.subscription': 'सबस्क्रिप्शन',
  'share.category.gift': 'भेटवस्तू',
  'share.category.health': 'आरोग्य',
  'share.category.other': 'इतर',

  // Reminder ("nudge") tones.
  'share.nudge.tone.friendly': 'मैत्रीपूर्ण',
  'share.nudge.tone.funny': 'गमतीशीर',
  'share.nudge.tone.firm': 'ठाम',
  // Reminder wordings, sent to the friend in the sender's language. `{to}` is their first name,
  // `{amount}` the money, `{what}` what it was for. Keep the same number of wordings per tone.
  'share.nudge.friendly.0': 'अहो {to}! 👋 एक छोटीशी आठवण: {what} साठी तुमचा हिस्सा {amount} आहे. घाई नाही!',
  'share.nudge.friendly.1': 'नमस्कार {to} 🙂 {what} साठी तुमचा हिस्सा {amount} होतो. सवड मिळेल तेव्हा मिटवा!',
  'share.nudge.friendly.2': 'अहो {to}, बरे आहात ना? एक छोटी गोष्ट: {what} साठी {amount}. खूप धन्यवाद 🙏',
  'share.nudge.friendly.3': '{to}! {what} साठी एक छोटीशी आठवण: तुमचा वाटा {amount}. धन्यवाद 😊',
  'share.nudge.funny.0': 'टक टक, {to} 🚪 कोण आहे? {amount}. {amount} कोण? {what} साठी {amount} 😄',
  'share.nudge.funny.1': 'ब्रेकिंग न्यूज 📰 {what} चे {amount} शेवटचे तुमच्याच दिशेने जाताना दिसले, {to}. त्याला घरी परत जायला मदत करा 🏠',
  'share.nudge.funny.2': '{to}, माझं पाकीट तुमची चौकशी करत आहे 👀 {what} साठी {amount}, तुम्ही तयार असाल तेव्हा!',
  'share.nudge.funny.3': 'ट्विस्ट, {to}: {what} मोफत नव्हते 🍿 तुमचा हिस्सा {amount} आहे 😅',
  'share.nudge.firm.0': 'नमस्कार {to}, {what} साठीचे {amount} अजून प्रलंबित आहे याची आठवण. कृपया आज मिटवा.',
  'share.nudge.firm.1': 'नमस्कार {to}, {what} साठी तुमच्या हिश्याचे {amount} देय आहे. कृपया लवकरात लवकर पैसे द्या.',
  'share.nudge.firm.2': '{to}, {what} साठीच्या {amount} बद्दल पाठपुरावा करत आहे. कृपया आज ते फेडू शकाल का?',
  // The words before the pay link at the end of a reminder ("Tap to pay: https://…").
  'share.nudge.link.friendly': 'पैसे देण्यासाठी टॅप करा',
  'share.nudge.link.funny': 'एका टॅपमध्ये हिशोब बरोबर',
  'share.nudge.link.firm': 'येथे पैसे द्या',
  // The UPI line of a reminder.
  'share.nudge.upi.mine': 'माझा UPI: {upi}',
  'share.nudge.upi': 'UPI वर {name} यांना पैसे द्या: {upi}',
  // Greeting when there's no name ("Hey there!"), and what it was for when there's no title.
  'share.nudge.there': 'मित्रा',
  'share.nudge.ourSplit': 'आपली वाटणी',

  // A UPI payment request sent from the pay sheet (then "Pay Riya on UPI: …" and the link).
  'share.upiRequest.for': 'नमस्कार {name}, {merchant} साठी तुमचा हिस्सा {amount} आहे.',
  'share.upiRequest.bill': 'नमस्कार {name}, बिलातील तुमचा हिस्सा {amount} आहे.',
  'share.upiRequest.tap': 'किंवा पैसे देण्यासाठी टॅप करा: {link}',

  // The full text summary of a split ("Copy text").
  'share.summary.total': 'एकूण {amount}',
  'share.summary.totalSplit': 'एकूण {amount} · {count, plural, one {# जणांत वाटले} other {# जणांत वाटले}}',
  // After the payer's amount: "Ayush   ₹691.50 · paid the bill".
  'share.summary.paidTheBill': 'बिल दिले',
  'share.summary.payUpi': 'UPI वर {name} यांना पैसे द्या: {upi}',
  'share.summary.payTap': 'एका टॅपमध्ये पैसे द्या: {link}',
  'share.summary.footer': '— {brand} सह वाटलेले',

  // The short message that carries a pay link into the group chat. 🧾 starts the first line.
  'share.message.settled': '🧾 {title} · सर्व मिटले ✓',
  'share.message.total': '🧾 {title} · {amount}',
  'share.message.split': '🧾 {title} · {amount} {count} जणांत वाटले',
  'share.message.see': 'वाटणी पहा 👇',
  'share.message.payMe': 'कोणत्याही UPI ॲपने मला पैसे देण्यासाठी तुमच्या नावावर टॅप करा 👇',
  'share.message.pay': 'कोणत्याही UPI ॲपने {name} यांना पैसे देण्यासाठी तुमच्या नावावर टॅप करा 👇',
  'share.message.seeShare': 'तुमचा हिस्सा पाहण्यासाठी तुमच्या नावावर टॅप करा 👇',

  // The share card image of a split (drawn in the sender's language).
  'share.card.morePeople': '{count, plural, one {आणखी # व्यक्ती} other {आणखी # जण}}',
  'share.card.paidBy': '{name} यांनी दिले',
  'share.card.splitWays': '{count, plural, one {# जणांत वाटले} other {# जणांत वाटले}}',
  'share.card.status.payer': 'बिल दिले',
  'share.card.status.paid': 'परत दिले',
  'share.card.status.owes': 'अजून द्यायचे',
  'share.card.status.zero': 'देण्यासारखे काही नाही',
  'share.card.paidCount': '{count} पैकी {paid} जणांनी दिले',
  'share.card.allSettled': 'सर्व मिटले',
  'share.card.collected': '{owed} पैकी {collected} जमा',
  'share.card.madeWith': '{brand} द्वारे बनवलेले',
  // Names when there's nothing better to show (the owner, a removed friend).
  'share.card.me': 'मी',
  'share.card.friend': 'मित्र',
  // The group summary card.
  'share.card.kind.trip': 'ट्रिप',
  'share.card.kind.home': 'घर',
  'share.card.kind.couple': 'जोडपे',
  'share.card.kind.event': 'कार्यक्रम',
  'share.card.kind.other': 'ग्रुप',
  'share.card.someone': 'कोणीतरी',
  'share.card.someone.object': 'कोणालातरी',
  'share.card.pays': '{from} देतात {to} यांना',
  'share.card.people': '{count, plural, one {# व्यक्ती} other {# जण}}',
  'share.card.expenses': '{count, plural, one {# खर्च} other {# खर्च}}',
  'share.card.totalSpent': 'एकूण खर्च',
  'share.card.settled': 'सर्वांचा हिशोब बरोबर आहे',
  'share.card.settled.body': 'कोणत्याही पेमेंटची गरज नाही',
  'share.card.empty': 'मिटवण्यासारखे काही नाही',
  'share.card.empty.body': 'अजून कोणताही खर्च नाही',
  'share.card.payments': '{count, plural, one {# पेमेंट} other {# पेमेंट}}',
  'share.card.toSettle': 'हिशोब मिटवायचा',
  'share.card.morePayments': '{count, plural, one {आणखी # पेमेंट} other {आणखी # पेमेंट}}',

  // Names used when a person never gave one (share/fallbacks.ts): the organiser or payee, a numbered person, anyone unnamed.
  'share.fallback.friend': 'तुमचा मित्र',
  'share.fallback.person': 'व्यक्ती {n}',
  'share.fallback.someone': 'कोणीतरी',
  // The note on a UPI payment that has no title (it shows in the payer's UPI app).
  'share.upi.note': 'बिलाची वाटणी',
  // Why a share card image couldn't be made.
  'share.card.error.canvas': 'हा ब्राउझर प्रतिमा काढू शकत नाही',
  'share.card.error.render': 'प्रतिमा तयार करता आली नाही',
} as const satisfies Messages
