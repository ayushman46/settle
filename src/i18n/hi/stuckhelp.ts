/** Hindi copy for raising a stuck payment (src/features/stuck/RaiseSheet.tsx): where to complain, the letter, and noting it was sent. */
import type { Messages } from '../types'

export const stuckhelp: Messages = {
  // The sheet's title, per rung ({amount} is pre-formatted: "₹300"; {name} a business: "Swiggy").
  'stuckhelp.title.bank': 'अपने बैंक से शिकायत करें',
  'stuckhelp.title.compensation': '{amount} का मुआवज़ा माँगें',
  'stuckhelp.title.compensationAny': 'मुआवज़ा माँगें',
  'stuckhelp.title.ombudsman': 'RBI लोकपाल के पास ले जाएँ',
  'stuckhelp.title.merchant': '{name} से रिफ़ंड माँगें',
  'stuckhelp.title.merchantAny': 'रिफ़ंड माँगें',
  'stuckhelp.title.nch': 'राष्ट्रीय उपभोक्ता हेल्पलाइन',
  'stuckhelp.title.airsewa': 'AirSewa पर शिकायत करें',
  'stuckhelp.title.commission': 'उपभोक्ता आयोग के पास ले जाएँ',

  // One line under the title: what this rung is.
  'stuckhelp.lead.bank': 'RBI के नियमों के हिसाब से आपके बैंक को पैसे लौटाने होंगे, और देरी के हर दिन के ₹100 देने होंगे।',
  'stuckhelp.lead.compensation': 'RBI के नियमों के हिसाब से पैसे जितने दिन देर से आए, हर दिन के ₹100 आपके बैंक को देने हैं। लिखकर माँगें।',
  'stuckhelp.lead.ombudsman': 'RBI की शिकायत सेवा, जब आपके बैंक ने मामला नहीं सुलझाया हो।',
  'stuckhelp.lead.merchant': 'शुरुआत कंपनी से ही करें — लिखकर, ऑर्डर नंबर के साथ।',
  'stuckhelp.lead.nch': 'सरकार की हेल्पलाइन आपकी शिकायत आपकी ओर से कंपनी तक पहुँचाती है।',
  'stuckhelp.lead.airsewa': 'एयरलाइन की शिकायतों के लिए नागरिक उड्डयन मंत्रालय का पोर्टल।',
  'stuckhelp.lead.commission': 'उपभोक्ता आयोग (कंज़्यूमर कोर्ट) मामले का फ़ैसला करता है। शिकायत ऑनलाइन दर्ज होती है।',

  // Your bank or UPI app, for a failed payment. App names and menu labels as each app shows them.
  'stuckhelp.bank.app.gpay':
    'Google Pay में, ट्रांज़ैक्शन हिस्ट्री से यह पेमेंट खोलें, “Having issues” पर टैप करें, फिर “Payment issue” (या “Stuck payment”), और टिकट बनाएँ।',
  'stuckhelp.bank.app.phonepe': 'PhonePe में, “History” में यह पेमेंट खोलें और “Contact PhonePe Support” पर टैप करें।',
  'stuckhelp.bank.app.paytm':
    'Paytm में, अपनी प्रोफ़ाइल पर टैप करें, फिर “Help & Support”। यह पेमेंट और सही समस्या चुनें (पैसे कटे, फ़ेल या पेंडिंग), फिर टिकट बनाएँ।',
  'stuckhelp.bank.app.other': '{app} में, अपनी हिस्ट्री में यह पेमेंट खोलें और वहीं से शिकायत करें। हर UPI ऐप को यह सुविधा देनी होती है।',
  'stuckhelp.bank.app.unknown': 'जिस UPI ऐप से पे किया, उसमें यह पेमेंट खोलें और वहीं से शिकायत करें। हर UPI ऐप को यह सुविधा देनी होती है।',
  'stuckhelp.bank.card': 'अपने बैंक के ऐप या नेट बैंकिंग में इस पेमेंट पर डिस्प्यूट दर्ज करें, या कार्ड के पीछे लिखे नंबर पर कॉल करें।',
  'stuckhelp.bank.atm': 'जिस बैंक का आपका कार्ड है, उसी से शिकायत करें, भले ATM किसी और बैंक का हो: उसके ऐप में, कस्टमर केयर पर या ब्रांच में।',
  'stuckhelp.bank.wallet': 'वॉलेट के ऐप में यह पेमेंट खोलें और उसके हेल्प सेक्शन से शिकायत करें।',
  'stuckhelp.bank.direct': 'अपने बैंक से शिकायत करें: कस्टमर केयर, नेट बैंकिंग में शिकायत का फ़ॉर्म, या ब्रांच।',
  'stuckhelp.bank.letter':
    'नीचे वाला पत्र भी अपने बैंक को भेजें — ईमेल से, नेट बैंकिंग में या ब्रांच में। पैसे लौटाना, और हर दिन के ₹100 देना, बैंक की ज़िम्मेदारी है।',
  'stuckhelp.bank.myupi':
    'ऐप से जवाब नहीं आया? पेमेंट के 45 दिन के अंदर, 12 अंकों के UPI रेफ़रेंस के साथ NPCI की MyUPI साइट (upihelp.npci.org.in) पर शिकायत करें।',
  'stuckhelp.bank.note': 'शिकायत नंबर मिला? उसे “शिकायत कर दी” से सेव करें। 30 दिन में न सुलझे, तो अगला कदम RBI लोकपाल है।',

  // The money came back late: the compensation claim.
  'stuckhelp.compensation.send': 'नीचे वाला पत्र अपने बैंक को भेजें: कस्टमर केयर को ईमेल से, नेट बैंकिंग के शिकायत फ़ॉर्म में, या ब्रांच में।',
  'stuckhelp.compensation.why': 'RBI के नियमों के हिसाब से बैंकों को यह बिना माँगे देना चाहिए। पत्र इसे लिखकर माँगता है, दिन गिनकर।',

  // The RBI Ombudsman ({phone}: 14448).
  'stuckhelp.ombudsman.when':
    'बैंक से शिकायत के 30 दिन बाद आप शिकायत दर्ज कर सकते हैं (बैंक ने जवाब दिया और आप संतुष्ट नहीं, तो पहले भी), और उसके बाद 90 दिन के अंदर।',
  'stuckhelp.ombudsman.file': 'cms.rbi.org.in पर अपने बैंक के ख़िलाफ़ शिकायत दर्ज करें। फ़ॉर्म के लिए जानकारी नीचे है।',
  'stuckhelp.ombudsman.paste':
    'शिकायत के तथ्यों में यह पत्र पेस्ट करें। बैंक से की गई शिकायत, उसका जवाब (अगर आया हो), और पैसे कटने वाला स्टेटमेंट साथ लगाएँ।',
  'stuckhelp.ombudsman.call': 'कोई सवाल? {phone} पर कॉल करें: सोमवार से शनिवार, सुबह 8 से रात 10 बजे तक लोग जवाब देते हैं। वे राह दिखाते हैं, पर शिकायत दर्ज नहीं करते।',
  'stuckhelp.ready.heading': 'ये तैयार रखें',
  'stuckhelp.ready.complaint': 'बैंक से की गई शिकायत, और उसका नंबर',
  'stuckhelp.ready.reply': 'बैंक का जवाब, अगर आया हो',
  'stuckhelp.ready.payment': 'पेमेंट की तारीख और रेफ़रेंस',
  'stuckhelp.ready.account': 'आपका खाता या कार्ड नंबर',
  'stuckhelp.ready.relief': 'आप क्या माँग रहे हैं, मुआवज़े के हिसाब के साथ (नीचे)',

  // The business ({name}: "Swiggy").
  'stuckhelp.merchant.page': '{name} का हेल्प पेज खोलें, यह ऑर्डर ढूँढें और वहीं से सपोर्ट से संपर्क करें।',
  'stuckhelp.merchant.app': '{name} के ऐप या वेबसाइट में यह ऑर्डर खोलें और वहीं से सपोर्ट से संपर्क करें।',
  'stuckhelp.merchant.unknown': 'कंपनी के सपोर्ट से संपर्क करें, हो सके तो ऑर्डर से ही।',
  'stuckhelp.merchant.paste': 'नीचे वाला मैसेज पेस्ट करें और टिकट नंबर माँगें।',
  'stuckhelp.merchant.nextNch': 'एक हफ़्ते में हल नहीं? अगला कदम राष्ट्रीय उपभोक्ता हेल्पलाइन है।',
  'stuckhelp.merchant.nextAirsewa': 'एक हफ़्ते में हल नहीं? अगला कदम AirSewa है।',
  'stuckhelp.rule.ecommerce':
    'ऑनलाइन कंपनियों को 48 घंटे में शिकायत मिलने की पुष्टि करनी होती है और एक महीने में उसे सुलझाना होता है (उपभोक्ता संरक्षण (ई-कॉमर्स) नियम, 2020)।',
  'stuckhelp.rule.dgca': 'DGCA के नियम: कार्ड से पेमेंट पर 7 दिन में रिफ़ंड, या एजेंट या पोर्टल से बुकिंग पर 14 कामकाजी दिन में।',

  // The National Consumer Helpline ({whatsapp}: "+91 88000 01915", {phone}: 1915, {tollFree}: 1800-11-4000).
  'stuckhelp.nch.send': 'नीचे वाला मैसेज WhatsApp पर {whatsapp} को भेजें, {phone} या {tollFree} पर कॉल करें (सुबह 8 से रात 8), या consumerhelpline.gov.in पर दर्ज करें।',
  'stuckhelp.nch.docket': 'हेल्पलाइन मामला {name} के सामने उठाती है। जो डॉकेट नंबर मिले, उसे नोट कर लें।',
  'stuckhelp.nch.docketAny': 'हेल्पलाइन मामला कंपनी के सामने उठाती है। जो डॉकेट नंबर मिले, उसे नोट कर लें।',
  'stuckhelp.nch.next': 'एक महीने में हल नहीं? अगला कदम उपभोक्ता आयोग है।',

  // AirSewa ({name}: "IndiGo").
  'stuckhelp.airsewa.file': 'airsewa.gov.in या AirSewa ऐप पर रजिस्टर करें, और {name} के ख़िलाफ़ शिकायत दर्ज करें।',
  'stuckhelp.airsewa.fileAny': 'airsewa.gov.in या AirSewa ऐप पर रजिस्टर करें, और एयरलाइन के ख़िलाफ़ शिकायत दर्ज करें।',
  'stuckhelp.airsewa.paste': 'PNR के साथ नीचे वाला मैसेज पेस्ट करें, और कैंसलेशन व रिफ़ंड का मैसेज साथ लगाएँ।',
  'stuckhelp.airsewa.note': 'AirSewa जो रेफ़रेंस नंबर भेजे, उसे नोट कर लें।',

  // A consumer commission.
  'stuckhelp.commission.where': 'उपभोक्ता शिकायतें e-Jagriti (e-jagriti.gov.in) पर ऑनलाइन दर्ज होती हैं। ₹50 लाख तक की रकम के लिए आपका ज़िला उपभोक्ता आयोग है।',
  'stuckhelp.commission.attach': 'नीचे वाले सारांश से शुरू करें। ऑर्डर, रिफ़ंड या फ़ेल होने का मैसेज, और नंबर समेत अपनी शिकायतें साथ लगाएँ।',
  'stuckhelp.commission.advice': 'Settle क़ानूनी सलाह नहीं देता। शिकायत दर्ज करने में मदद के लिए आयोग या किसी उपभोक्ता संगठन से पूछें।',

  // Buttons and links that take you there ({phone}: "1915"; {name}: a business).
  'stuckhelp.link.cms': 'cms.rbi.org.in खोलें',
  'stuckhelp.link.call': '{phone} पर कॉल करें',
  'stuckhelp.link.myupi': 'NPCI का MyUPI',
  'stuckhelp.link.phonepeGrievance': 'PhonePe शिकायत डेस्क',
  'stuckhelp.link.merchantHelp': '{name} हेल्प खोलें',
  'stuckhelp.link.merchantRefunds': '{name} की रिफ़ंड जानकारी',
  'stuckhelp.link.whatsapp': 'WhatsApp पर भेजें',
  'stuckhelp.link.nchSite': 'consumerhelpline.gov.in',
  'stuckhelp.link.airsewa': 'AirSewa खोलें',
  'stuckhelp.link.ejagriti': 'e-Jagriti खोलें',
  'stuckhelp.links.aria': 'उन तक पहुँचने के और तरीके',
  'stuckhelp.newTab': '{label} (नए टैब में खुलेगा)',

  // The sheet.
  'stuckhelp.eyebrow': '{amount} · {name}',
  'stuckhelp.party.failed': 'फ़ेल पेमेंट',
  'stuckhelp.party.refund': 'रिफ़ंड',
  'stuckhelp.how.heading': 'कहाँ और कैसे',
  'stuckhelp.fields.heading': 'फ़ॉर्म के लिए',
  'stuckhelp.fields.hint': 'cms.rbi.org.in के शिकायत फ़ॉर्म में ये भरें।',
  'stuckhelp.field.entity': 'बैंक',
  'stuckhelp.field.category': 'मामला किस बारे में है',
  'stuckhelp.field.date': 'पेमेंट की तारीख',
  'stuckhelp.field.amount': 'रकम',
  'stuckhelp.field.reference': 'ट्रांज़ैक्शन रेफ़रेंस',
  'stuckhelp.field.account': 'खाता या कार्ड',
  'stuckhelp.field.bankComplaint': 'बैंक से की गई आपकी शिकायत',
  'stuckhelp.field.relief': 'माँगी गई राहत',
  'stuckhelp.field.copy': '{field} कॉपी करें',
  'stuckhelp.field.copied': '{field} कॉपी हो गया',
  // The letter's box: {kind} is letter, message or summary.
  'stuckhelp.letter.heading': '{kind, select, message {मैसेज} summary {सारांश} other {पत्र}}',
  'stuckhelp.letter.subject': 'विषय',
  'stuckhelp.letter.fill': 'भेजने से पहले [ब्रैकेट] वाले हिस्से भरें।',
  'stuckhelp.letter.actions': 'पत्र भेजें',
  'stuckhelp.action.email': 'ईमेल',
  'stuckhelp.copied.status': 'कॉपी हो गया',
  'stuckhelp.copied.toast': 'कॉपी हो गया। जहाँ भेजना है, वहाँ पेस्ट करें।',
  'stuckhelp.copyFailed.toast': 'कॉपी नहीं हुआ। टेक्स्ट चुनकर कॉपी करें।',

  // "I've raised it": the day and the number they gave you.
  'stuckhelp.raised.cta': 'शिकायत कर दी',
  'stuckhelp.raised.title': 'शिकायत कब की?',
  'stuckhelp.raised.description': 'Settle अगले कदम का इंतज़ार इसी दिन से गिनता है।',
  'stuckhelp.raised.date': 'शिकायत की तारीख',
  'stuckhelp.raised.ref': '{kind, select, merchant {टिकट नंबर} nch {डॉकेट नंबर} airsewa {रेफ़रेंस नंबर} commission {केस नंबर} other {शिकायत नंबर}}',
  'stuckhelp.raised.refHint': 'ज़रूरी नहीं, अगर मिला हो तो',
  'stuckhelp.raised.save': 'सेव करें',
  // {date}: "2 Nov"; {name}: the business.
  'stuckhelp.raised.toast':
    '{kind, select, bank {नोट किया: {date} को अपने बैंक से शिकायत की} ombudsman {नोट किया: {date} को RBI लोकपाल के पास ले गए} merchant {नोट किया: {date} को {name} से शिकायत की} nch {नोट किया: {date} को राष्ट्रीय उपभोक्ता हेल्पलाइन पर शिकायत की} airsewa {नोट किया: {date} को AirSewa पर शिकायत की} other {नोट किया: {date} को उपभोक्ता आयोग में शिकायत दर्ज की}}',
}
