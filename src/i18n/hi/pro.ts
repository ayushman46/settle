/** Hindi copy for Pro (src/features/pro). Keys: `pro.<screen>.<element>` (see i18n-plan §3). "Pro" stays "Pro". */
import type { Messages } from '../types'

export const pro = {
  // What Pro adds (the perk list).
  'pro.perk.ai.title': 'अनलिमिटेड AI',
  'pro.perk.ai.body': 'बिल स्कैन करें और “बस बोल दीजिए” जितनी बार चाहें — फ़ेयर यूज़ के तहत, दिन में {count} तक।',
  'pro.perk.recurring.title': 'रिकरिंग स्प्लिट',
  'pro.perk.recurring.body': 'किराया, वाई-फ़ाई, Netflix: हर महीने याद दिलाना और एक टैप में स्प्लिट।',
  'pro.perk.insights.title': 'इनसाइट्स',
  'pro.perk.insights.body': 'पैसा कहाँ जा रहा है — श्रेणी, महीने और दोस्त के हिसाब से।',
  'pro.perk.export.title': 'CSV एक्सपोर्ट',
  'pro.perk.export.body': 'हर खर्च, Excel या Google Sheets के लिए तैयार।',
  'pro.perk.themes.title': 'एक्सेंट रंग',
  'pro.perk.themes.body': 'मिंट, स्काई, वायलेट या कोरल में इसे अपना बनाएँ।',
  'pro.perk.cleanCards.title': 'साफ़ शेयर कार्ड',
  'pro.perk.cleanCards.body': 'ग्रुप चैट के लिए स्प्लिट कार्ड, “{brand} से बना” वाली लाइन के बिना।',
  'pro.perk.early.title': 'पहले से एक्सेस',
  'pro.perk.early.body': 'नए फ़ीचर सबके पास आने से पहले आज़माएँ।',
  'pro.perks.aria': 'Pro में क्या मिलता है',

  // What the paywall (and a locked screen) leads with, per feature.
  'pro.pitch.general.title': '{brand} Pro',
  'pro.pitch.general.body': 'अनलिमिटेड AI, रिकरिंग स्प्लिट और इनसाइट्स। एक बार पैसे दें — कुछ अपने-आप रिन्यू नहीं होता।',
  'pro.pitch.general.cta': 'Pro देखें',
  'pro.pitch.ai.title': 'Pro के साथ अनलिमिटेड AI',
  // {free}: the free AI allowance a day; {count}: Pro's fair-use cap.
  'pro.pitch.ai.body':
    'फ़्री में रोज़ {free} AI स्कैन या “बस बोल दीजिए” स्प्लिट मिलते हैं, और ये आधी रात को रीसेट होते हैं। Pro में सीमा हट जाती है — फ़ेयर यूज़ के तहत, दिन में {count} तक।',
  'pro.pitch.ai.cta': 'अनलिमिटेड AI लें',
  'pro.pitch.recurring.title': 'रिकरिंग स्प्लिट Pro में हैं',
  'pro.pitch.recurring.body': 'किराया, वाई-फ़ाई या Netflix एक बार सेट करें। हर महीने याद दिलाया जाएगा और एक टैप में स्प्लिट हो जाएगा।',
  'pro.pitch.recurring.cta': 'रिकरिंग स्प्लिट खोलें',
  'pro.pitch.insights.title': 'देखें पैसा कहाँ जा रहा है',
  'pro.pitch.insights.body':
    'श्रेणी, महीने और दोस्त के हिसाब से आपका खर्च — आपके फ़ोन पर ही निकाला जाता है, कभी अपलोड नहीं होता।',
  'pro.pitch.insights.cta': 'इनसाइट्स खोलें',
  'pro.pitch.export.title': 'स्प्रेडशीट में एक्सपोर्ट करें',
  'pro.pitch.export.body': 'हर खर्च CSV में डाउनलोड करें, Excel या Google Sheets के लिए। बैकअप सबके लिए मुफ़्त रहते हैं।',
  'pro.pitch.export.cta': 'CSV एक्सपोर्ट खोलें',
  'pro.pitch.themes.title': 'इसे अपना बनाएँ',
  'pro.pitch.themes.body': 'मिंट, स्काई, वायलेट या कोरल को अपना एक्सेंट रंग चुनें। लाइम मुफ़्त रहता है।',
  'pro.pitch.themes.cta': 'एक्सेंट रंग खोलें',
  'pro.pitch.cleanCards.title': 'ज़्यादा साफ़ शेयर कार्ड',
  'pro.pitch.cleanCards.body': 'ग्रुप चैट में स्प्लिट कार्ड बिना “{brand} से बना” लाइन के शेयर करें।',
  'pro.pitch.cleanCards.cta': 'साफ़ कार्ड खोलें',
  'pro.freeForever': 'हमेशा मुफ़्त: बिना सीमा के हाथ से स्प्लिट, ग्रुप, पे लिंक, UPI QR कोड, रिमाइंडर और बैकअप।',

  // The passes.
  'pro.plan.monthly': 'मंथली',
  'pro.plan.yearly': 'सालाना',
  'pro.plan.lifetime': 'लाइफ़टाइम',
  // The server's highlights on a pass.
  'pro.plan.badge.bestValue': 'सबसे अच्छा सौदा',
  'pro.plan.badge.payOnce': 'एक बार पेमेंट',
  'pro.plan.term.forever': 'हमेशा के लिए आपका',
  'pro.plan.term.years': '{count, plural, one {# साल} other {# साल}}',
  'pro.plan.term.days': '{count, plural, one {# दिन} other {# दिन}}',
  'pro.plan.perMonth': 'हर महीने लगभग {amount}',
  // For screen readers: "Yearly, ₹399 for 1 year, about ₹33 a month, save 32%, Best value".
  'pro.plan.spoken.price': '{price}, {term} के लिए',
  'pro.plan.spoken.save': '{percent}% बचाएँ',
  'pro.plan.save': '{percent}% बचाएँ',
  'pro.plan.legend': 'अपना पास चुनें',
  'pro.plan.loading': 'दाम लोड हो रहे हैं…',
  'pro.checkout.cta': 'Pro लें — {price}',
  'pro.checkout.cta.noPlan': 'Pro लें',
  'pro.checkout.note.lifetime': 'एक बार का पेमेंट · Pro हमेशा के लिए',
  'pro.checkout.note': 'एक बार का पेमेंट · {term} · कुछ अपने-आप रिन्यू नहीं होता',
  'pro.checkout.cancelled.toast': 'पेमेंट बंद हो गया। कोई पेमेंट नहीं हुआ।',
  'pro.checkout.off.title': 'पेमेंट अभी चालू नहीं हुआ है',
  'pro.checkout.off.body': 'यहाँ पेमेंट अभी चालू नहीं हुआ है, इसलिए अभी पास नहीं खरीदे जा सकते। Pro कोड है? उसे रिडीम कर सकते हैं।',
  'pro.checkout.error.offline': 'आप ऑफ़लाइन हैं। Pro लेने के लिए इंटरनेट से जुड़ें।',
  'pro.checkout.error.network': 'Settle तक नहीं पहुँच पाए। कनेक्शन देखें और फिर से कोशिश करें।',
  'pro.checkout.error.busy': 'बार-बार कोशिश हो रही है। एक मिनट रुकें, फिर से कोशिश करें।',
  'pro.checkout.error.planMissing': 'यह पास अभी उपलब्ध नहीं है।',
  'pro.checkout.error.orderFailed': 'पेमेंट शुरू नहीं हो पाया। थोड़ी देर में फिर कोशिश करें।',
  'pro.checkout.error.script': 'पेमेंट विंडो नहीं खुल पाई। कनेक्शन देखें और फिर से कोशिश करें।',
  'pro.checkout.error.paymentFailed': 'पेमेंट नहीं हुआ। फिर से कोशिश करें, या पेमेंट का कोई और तरीका चुनें।',
  'pro.checkout.pending': 'पेमेंट मिल गया! Pro अभी चालू हो रहा है — ऑनलाइन आते ही अपने-आप पूरा हो जाएगा।',
  // {paymentId}: Razorpay's payment ID, so the person can quote it.
  'pro.checkout.unconfirmed':
    'हम यह पेमेंट कन्फ़र्म नहीं कर पाए। अगर पैसे कटे हैं, तो पेमेंट ID {paymentId} के साथ हमें लिखें, हम ठीक कर देंगे।',
  'pro.trust.aria': 'पेमेंट कैसे होता है',
  'pro.trust.once': 'एक बार का पेमेंट',
  'pro.trust.noAccount': 'अकाउंट की ज़रूरत नहीं',
  'pro.trust.methods': 'Razorpay से UPI या कार्ड',

  // The pass on this phone.
  'pro.pass.forever': '{name} पास · हमेशा के लिए आपका',
  'pro.pass.until': '{name} पास · {date} तक',
  'pro.pass.ended': 'ख़त्म',
  'pro.pass.endsToday': 'आज ख़त्म',
  'pro.pass.endsTomorrow': 'कल ख़त्म',
  'pro.pass.endsIn': '{count, plural, one {# दिन में ख़त्म} other {# दिन में ख़त्म}}',
  'pro.pass.endedOn': '{date} को ख़त्म',
  'pro.pass.lifetime': 'लाइफ़टाइम',
  'pro.pass.active': 'चालू',

  // A locked Pro feature.
  'pro.lock.ended': 'आपका Pro पास {date} को ख़त्म हो गया।',
  'pro.lock.renew.cta': 'Pro रिन्यू करें',
  'pro.lock.from': 'Pro {price} से · एक बार का पेमेंट, कुछ रिन्यू नहीं होता',

  // Redeem a code. {prefix} is how every code starts.
  'pro.redeem.cta': 'कोड रिडीम करें',
  'pro.redeem.title': 'कोड रिडीम करें',
  'pro.redeem.description': 'जो Pro कोड मिला है या पुराने फ़ोन से कॉपी किया है, उसे यहाँ पेस्ट करें। कोड {prefix} से शुरू होते हैं।',
  'pro.redeem.submit.cta': 'रिडीम करें',
  'pro.redeem.label': 'Pro कोड',
  'pro.redeem.paste.aria': 'क्लिपबोर्ड से पेस्ट करें',
  'pro.redeem.paste.error': 'क्लिपबोर्ड नहीं पढ़ पाए। पेस्ट करने के लिए खाने को दबाकर रखें।',
  'pro.redeem.error.notACode': 'यह {brand} Pro कोड जैसा नहीं दिख रहा। कोड {prefix} से शुरू होते हैं।',
  'pro.redeem.error.invalid': 'यह कोड सही नहीं है। पूरा कोड कॉपी हुआ है या नहीं, देखें और फिर से कोशिश करें।',
  'pro.redeem.error.expired': 'यह कोड ख़त्म हो चुका है।',
  'pro.redeem.error.offline': 'आप ऑफ़लाइन हैं। कोड जाँचने के लिए इंटरनेट से जुड़ें।',
  'pro.redeem.error.network': 'अभी कोड नहीं जाँच पाए। थोड़ी देर में फिर कोशिश करें।',
  'pro.redeem.kept.title': 'आपके पास पहले से लंबा पास है',
  'pro.redeem.kept.lifetime': 'आपका लाइफ़टाइम पास पहले से चालू है, इसलिए यहाँ कुछ नहीं बदला।',
  'pro.redeem.kept.until': 'आपका पास {date} तक चलता है — इस कोड से लंबा — इसलिए कुछ नहीं बदला।',
  'pro.redeem.kept.elsewhere': 'यह कोड दूसरे फ़ोन पर अब भी चलेगा।',
  'pro.redeem.same.title': 'यह कोड इस फ़ोन पर पहले से है',
  'pro.redeem.same.body': 'Pro चालू है — और कुछ करने की ज़रूरत नहीं।',
  'pro.redeem.note': 'आपका पास इसी फ़ोन पर रहता है — अकाउंट की ज़रूरत नहीं। कोड किसी को न बताएँ: जिसके पास यह कोड होगा, उसे आपका Pro मिल जाएगा।',

  // The paywall sheet.
  'pro.paywall.on.title': 'Pro चालू है',
  'pro.paywall.continue.cta': 'आगे बढ़ें',
  'pro.paywall.all.cta': 'Pro में सब देखें',
  'pro.paywall.on.body': 'Pro की सारी सुविधाएँ इस फ़ोन पर खुली हैं।',
  'pro.paywall.also.aria': 'Pro में और भी',
  'pro.unlocked.title': 'Pro खुल गया',

  // The upgrade screen (`/app/pro`).
  'pro.upgrade.unlocked.title': 'आपके लिए खुला है',
  'pro.upgrade.perks.title': 'Pro में सब कुछ',
  'pro.upgrade.have.title': 'Pro पहले से है?',
  'pro.upgrade.have.body':
    'आपका पास उसी फ़ोन पर रहता है जिस पर खरीदा गया था — कोई अकाउंट नहीं है। फ़ोन बदल रहे हैं? पुराने फ़ोन पर अपना Pro कोड कॉपी करें और यहाँ रिडीम करें। प्रोमो कोड भी इसी तरह चलते हैं।',
  // <terms> and <privacy> become links.
  'pro.upgrade.legal':
    'पेमेंट Razorpay सुरक्षित तरीके से करता है। पास खरीदकर आप <terms>शर्तों</terms> से सहमत होते हैं; आपके डेटा का इस्तेमाल कैसे होता है, यह <privacy>प्राइवेसी नीति</privacy> में देखें।',
  'pro.upgrade.expired.body':
    'आपका Pro पास ख़त्म हो गया है। Pro फिर से चालू करने के लिए कोई पास चुनें — आपके रिकरिंग स्प्लिट और सेटिंग्स अब भी यहीं हैं।',
  'pro.upgrade.lede': 'अनलिमिटेड AI, रिकरिंग स्प्लिट और इनसाइट्स। एक बार पेमेंट करें — कुछ रिन्यू नहीं होता।',
  'pro.upgrade.plans.title': 'अपना पास चुनें',
  'pro.upgrade.plans.description': 'एक बार के पेमेंट — कुछ अपने-आप रिन्यू नहीं होता।',
  'pro.lifetime.title': 'इसे लाइफ़टाइम करें',
  'pro.lifetime.body':
    '{price} एक बार दें, फिर कभी रिन्यू न करें। यह आज से आपके मौजूदा पास की जगह लेगा — पास जुड़ते नहीं, इसलिए इसके बचे दिन आगे नहीं जाएँगे।',
  'pro.lifetime.cta': 'लाइफ़टाइम लें — {price}',
  'pro.move.title': 'नया फ़ोन ले रहे हैं?',
  'pro.move.body':
    'आपका पास इसी फ़ोन पर रहता है — कोई अकाउंट नहीं है, और बैकअप में यह शामिल नहीं होता। अपना Pro कोड कॉपी करें और नए फ़ोन पर रिडीम करें। इसे निजी रखें: जिसके पास कोड होगा, उसे आपका Pro मिल जाएगा।',
  'pro.move.copy.cta': 'अपना Pro कोड कॉपी करें',
  'pro.move.redeem.cta': 'दूसरा कोड रिडीम करें',
  'pro.move.copied.toast': 'Pro कोड कॉपी हो गया। नए फ़ोन पर {brand} में रिडीम करें।',
  'pro.move.copy.error': 'Pro कोड कॉपी नहीं हो पाया। फिर से कोशिश करें।',
} as const satisfies Messages
