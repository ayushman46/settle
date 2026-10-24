/** Hindi copy for payment screenshots (src/features/proof). Keys: `proof.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'पैसे आए? स्क्रीनशॉट डालें',
  'proof.screen.subtitle': 'GPay, PhonePe, Paytm या बैंक ऐप के पेमेंट का स्क्रीनशॉट डालें। Settle उसे जाँचकर बताएगा कि किसने पैसे दिए।',
  'proof.drop.choose': 'स्क्रीनशॉट चुनें',
  'proof.drop.aria': 'पेमेंट का स्क्रीनशॉट चुनें',
  'proof.drop.hint': 'JPG, PNG या WebP। एक बार पढ़ा जाता है, कुछ सेव नहीं होता।',
  'proof.reading.title': 'स्क्रीनशॉट पढ़ा जा रहा है…',
  'proof.reading.cancel': 'रद्द करें',
  'proof.again': 'एक और स्क्रीनशॉट डालें',
  // What goes wrong reading the screenshot.
  'proof.error.generic': 'स्क्रीनशॉट नहीं पढ़ पाए। फिर से कोशिश करें, या खुद चुनें कि पैसे किसने दिए।',
  'proof.error.network': 'आप ऑफ़लाइन हैं। नेट चालू करके फिर कोशिश करें।',
  'proof.error.not_a_payment': 'यह UPI पेमेंट जैसा नहीं लगता। अपने पेमेंट ऐप की सफल वाली स्क्रीन डालें।',
  'proof.error.unsupported_image': 'कृपया JPG, PNG या WebP स्क्रीनशॉट डालें।',
  'proof.error.image_too_large': 'यह स्क्रीनशॉट बहुत बड़ा है। कोई छोटा स्क्रीनशॉट डालें।',
  'proof.error.rate_limited': 'अभी बहुत सारे स्क्रीनशॉट आ रहे हैं। कुछ मिनट बाद फिर कोशिश करें।',
  'proof.error.timeout': 'स्क्रीनशॉट पढ़ने में बहुत देर लगी। फिर से कोशिश करें।',
  'proof.error.unreadable': 'यह स्क्रीनशॉट नहीं पढ़ पाए। अच्छी रोशनी में पूरी सफल वाली स्क्रीन डालें।',
  'proof.error.not_configured': 'स्क्रीनशॉट पढ़ने की सुविधा अभी उपलब्ध नहीं है।',
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'यह पेमेंट अभी पेंडिंग है। इसे पेड नहीं मार्क कर रहे।',
  'proof.verdict.pending.body': 'जब स्क्रीन पर Paid लिखा आए, तब फिर से स्क्रीनशॉट डालें।',
  'proof.verdict.failed.title': 'यह पेमेंट फ़ेल हो गया। इसे पेड नहीं मार्क कर रहे।',
  'proof.verdict.failed.body': 'कोई पैसा नहीं गया। उनसे फिर से भेजने को कहें।',
  'proof.verdict.unreadable.title': 'पता नहीं चल पाया कि पेमेंट पहुँचा या नहीं।',
  'proof.verdict.unreadable.body': 'सफल वाली स्क्रीन का स्क्रीनशॉट डालें।',
  'proof.verdict.wrongPayee.title': 'यह पैसा आपको नहीं गया। इसे पेड नहीं मार्क कर रहे।',
  'proof.verdict.wrongPayee.body': 'यह {payee} को गया।',
  'proof.verdict.payeeUnknown.title': 'पता नहीं चल रहा कि पैसा किसे मिला। इसे पेड नहीं मार्क कर रहे।',
  'proof.verdict.payeeUnknown.body': 'ऐसा स्क्रीनशॉट डालें जिसमें पाने वाले का नाम या UPI ID दिखे।',
  'proof.verdict.duplicate.title': 'यह पेमेंट पहले ही दर्ज है।',
  'proof.verdict.duplicate.body': 'UPI रेफ़ {utr} पहले ही {name} के नाम दर्ज है।',
  'proof.verdict.duplicate.someone': 'आपकी लिस्ट के एक व्यक्ति',
  // A match: one person owes exactly this.
  'proof.match.title': 'क्या {name} के {amount} को पेड मार्क करें?',
  'proof.match.ref': 'UPI रेफ़ {utr}',
  'proof.match.noRef': 'इस स्क्रीन पर UPI रेफ़ नहीं दिख रहा। जाँच लें कि यही पेमेंट है।',
  'proof.match.confirm': 'पेड मार्क करें',
  'proof.match.notThis': 'यह नहीं है',
  'proof.match.done': '{name} के {amount} को पेड मार्क किया।',
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': 'इसे किसी से मिला नहीं पाए।',
  'proof.nomatch.amount': 'स्क्रीन पर {amount} दिख रहा है। अगर इनमें से किसी ने दिया है तो उसे चुनें।',
  'proof.nomatch.noAmount': 'स्क्रीन पर रकम नहीं दिख रही। अगर इनमें से किसी ने दिया है तो उसे चुनें।',
  'proof.nomatch.none': 'किसी के भी ऊपर ठीक {amount} बकाया नहीं है। Friends में रकम जाँच लें।',
  'proof.nomatch.pick': '{name} ({amount}) चुनें',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'दूसरे ऐप से शेयर किया गया',
  'proof.more.title': 'पैसे आए? स्क्रीनशॉट डालें',
  'proof.more.subtitle': 'UPI पेमेंट का स्क्रीनशॉट डालकर उसे पेड मार्क करें',
} as const satisfies Messages
