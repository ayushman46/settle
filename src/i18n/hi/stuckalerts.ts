/** Hindi copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} को {amount} का पेमेंट फ़ेल हुआ, पर पैसे कट गए — अटके पैसे में ट्रैक हो रहा है',
  'stuckalerts.failed.anon': '{amount} का एक पेमेंट फ़ेल हुआ, पर पैसे कट गए — अटके पैसे में ट्रैक हो रहा है',
  'stuckalerts.check': '{name} को {amount} का पेमेंट शायद अटक गया — क्या पैसे आपके खाते से कटे?',
  'stuckalerts.check.anon': '{amount} का एक पेमेंट शायद अटक गया — क्या पैसे आपके खाते से कटे?',
  'stuckalerts.refund': '{name} से {amount} का रिफ़ंड — आने तक ट्रैक कर रहे हैं',
  'stuckalerts.refund.anon': '{amount} का रिफ़ंड — आने तक ट्रैक कर रहे हैं',
  'stuckalerts.added.many': '{count, plural, one {# पेमेंट अटके पैसे में जोड़ा} other {# पेमेंट अटके पैसे में जोड़े}}',
  'stuckalerts.back.failed': '{name} वाले फ़ेल पेमेंट के {amount} वापस आ गए',
  'stuckalerts.back.failed.anon': 'एक फ़ेल पेमेंट के {amount} वापस आ गए',
  'stuckalerts.back.failed.late':
    '{name} वाले फ़ेल पेमेंट के {amount} वापस आ गए — {days, plural, one {# दिन की देरी से} other {# दिन की देरी से}}: देरी के बदले बैंक को आपको {compensation} देने हैं',
  'stuckalerts.back.failed.anon.late':
    'एक फ़ेल पेमेंट के {amount} वापस आ गए — {days, plural, one {# दिन की देरी से} other {# दिन की देरी से}}: देरी के बदले बैंक को आपको {compensation} देने हैं',
  'stuckalerts.back.refund': '{name} से {amount} का रिफ़ंड आ गया',
  'stuckalerts.back.refund.anon': '{amount} का रिफ़ंड आ गया',
  'stuckalerts.back.many': '{count, plural, one {# अटका पेमेंट वापस आया} other {# अटके पेमेंट वापस आए}}',
}
