import type { Messages } from '../types'

export const autosettle: Messages = {
  'autosettle.ticked.one': '{name} ने {amount} भेजे · {title} — टिक हो गया',
  'autosettle.ticked.many': '{count, plural, one {# व्यक्ति ने} other {# लोगों ने}} पैसे लौटाए — टिक हो गए',
  'autosettle.pending': '{count, plural, one {# पेमेंट देखना है} other {# पेमेंट देखने हैं}}',
  'autosettle.on.title': 'ऑटो-सेटल चालू है',
  'autosettle.on.text': 'जब Google Pay, PhonePe, Paytm या BHIM बताए कि पैसे आए, भेजने वाला टिक हो जाता है। फ़ेल पेमेंट और रिफ़ंड अटके पैसे में जाते हैं।',
  // Bank SMS is off. “बदलें” is autosettle.manage, the button beside it.
  'autosettle.on.text.noSms':
    'जब Google Pay, PhonePe, Paytm या BHIM बताए कि पैसे आए, भेजने वाला टिक हो जाता है। ज़्यादातर फ़ेल पेमेंट और वापस आते पैसे भी पकड़ने के लिए, “बदलें” में जाकर बैंक SMS चालू करें।',
  'autosettle.manage': 'बदलें',
  'autosettle.offer.title': 'लोगों को अपने-आप टिक करें',
  'autosettle.offer.text': 'जब आपका UPI ऐप बताए कि पैसे आए, Settle भेजने वाले को टिक कर देता है। पेमेंट फ़ेल हुआ पर पैसे कट गए, या कोई रिफ़ंड आने वाला है — वह अपने-आप अटके पैसे में चला जाता है।',
  'autosettle.offer.cta': 'ऑटो-सेटल चालू करें',
  'autosettle.error': 'Android की सेटिंग नहीं खुली। फिर कोशिश करें।',
  'autosettle.sheet.title': 'ऑटो-सेटल',
  'autosettle.sheet.description': 'Settle आपको मिले पेमेंट देखता है और भेजने वाले को टिक करता है। यह फ़ेल पेमेंट और रिफ़ंड भी देखता है, और अटके पैसे में उनका हिसाब रखता है।',
  'autosettle.sheet.reads': 'यह सिर्फ़ पेमेंट के अलर्ट पढ़ता है: Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik और CRED के, जब पैसे आएँ, कोई पेमेंट फ़ेल, पेंडिंग या पूरा हो, या पैसे वापस आएँ — और कुछ शॉपिंग, फ़ूड और ट्रैवल ऐप के रिफ़ंड अलर्ट।',
  'autosettle.sheet.does': 'जिस पेमेंट पर पक्का भरोसा हो, वह व्यक्ति टिक हो जाता है, पहले जैसा करने के विकल्प के साथ। जिस पर भरोसा न हो, वह आपके देखने के लिए रुकता है।',
  'autosettle.sheet.stop': 'Settle इन्हें Android के नोटिफ़िकेशन ऐक्सेस से पढ़ता है, जिसे आप Android की सेटिंग में कभी भी बंद कर सकते हैं।',
  'autosettle.sheet.sms.label': 'बैंक SMS भी',
  'autosettle.sheet.sms.description': 'ज़्यादातर फ़ेल पेमेंट और वापस आते पैसों के लिए ज़रूरी: कई बैंक सिर्फ़ SMS से बताते हैं। सिर्फ़ पैसे जमा होने, फ़ेल पेमेंट और रिफ़ंड वाले मैसेज पढ़े जाते हैं — और पैसे कटने वाले भी, यह जाँचने के लिए कि फ़ेल पेमेंट में सच में पैसे कटे या नहीं और कोई बैंक चार्ज सही है या नहीं; साथ ही बैंक की कम बैलेंस वाली चेतावनियाँ।',
  'autosettle.sheet.allow': 'Android सेटिंग में अनुमति दें',
  'autosettle.sheet.later': 'अभी नहीं',
  'autosettle.sheet.done': 'हो गया',
  'autosettle.sheet.off': 'Android सेटिंग में बंद करें',
}
