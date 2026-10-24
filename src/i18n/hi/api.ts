/** Hindi copy for client API errors (src/api). Keys: `api.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const api = {
  'api.scan.error.bad_request': 'इस फ़ोटो में कुछ गड़बड़ है। कोई दूसरी फ़ोटो आज़माएँ।',
  'api.scan.error.unsupported_image': 'कृपया JPG या PNG फ़ोटो इस्तेमाल करें।',
  'api.scan.error.image_too_large': 'यह फ़ोटो बहुत बड़ी है। छोटी फ़ोटो आज़माएँ — या इसका स्क्रीनशॉट लें।',
  'api.scan.error.not_a_bill': 'यह बिल नहीं लगता। पूरी रसीद की साफ़ फ़ोटो लें।',
  'api.scan.error.unreadable': 'हम कोई आइटम नहीं पढ़ पाए। अच्छी रोशनी में साफ़ फ़ोटो लें — या आइटम ख़ुद डालें।',
  'api.scan.error.not_configured': 'फ़ोटो स्कैन अभी उपलब्ध नहीं है — आप आइटम ख़ुद लिख सकते हैं।',
  'api.scan.error.upstream_auth': 'फ़ोटो स्कैन अभी काम नहीं कर रहा — आप आइटम ख़ुद लिख सकते हैं।',
  'api.scan.error.rate_limited': 'अभी बहुत ज़्यादा स्कैन हो गए। कुछ मिनट बाद फिर कोशिश करें — या आइटम ख़ुद लिखें।',
  'api.scan.error.timeout': 'बिल पढ़ने में बहुत देर लगी। पास से ली गई, साफ़ फ़ोटो से फिर कोशिश करें।',
  'api.scan.error.upstream_error': 'AI सर्विस तक नहीं पहुँच पाए। कृपया फिर कोशिश करें।',
  'api.scan.error.network': 'लगता है आप ऑफ़लाइन हैं। इंटरनेट चेक करके फिर कोशिश करें।',
  'api.scan.error.aborted': 'स्कैन रद्द हो गया।',
  'api.scan.busy': 'अभी बहुत सारे बिल पढ़े जा रहे हैं — थोड़ी देर में फिर कोशिश करें।',
  'api.scan.proLimit': 'आज की AI सीमा पूरी हो गई। यह {wait} में फिर शुरू होगी — तब तक आप आइटम ख़ुद लिख सकते हैं।',
  'api.scan.limit': 'बहुत ज़्यादा स्कैन। {wait} बाद फिर कोशिश करें — या आइटम ख़ुद लिखें।',
  'api.scan.offline': 'आप ऑफ़लाइन हैं — फिर भी आइटम ख़ुद लिख सकते हैं।',
  'api.image.error.not_image': 'यह फ़ाइल फ़ोटो नहीं है। कृपया JPG या PNG इमेज चुनें।',
  'api.image.error.decode_failed': 'हम यह इमेज खोल नहीं पाए। JPG या PNG आज़माएँ — या इसका स्क्रीनशॉट लें।',
  'api.image.error.too_large': 'यह फ़ोटो बहुत बड़ी है (25 MB से ज़्यादा)। छोटी फ़ोटो आज़माएँ — या इसका स्क्रीनशॉट लें।',
  'api.wait.minute': 'लगभग एक मिनट',
  'api.wait.minutes': 'लगभग {count} मिनट',
  'api.wait.hours': 'लगभग {count} घंटे',
} as const satisfies Messages
