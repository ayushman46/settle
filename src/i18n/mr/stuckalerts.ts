import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} ला केलेले {amount} चे पेमेंट फेल झाले, पण पैसे कापले गेले — “अडकलेले पैसे” मध्ये ट्रॅक होत आहे',
  'stuckalerts.failed.anon': '{amount} चे एक पेमेंट फेल झाले, पण पैसे कापले गेले — “अडकलेले पैसे” मध्ये ट्रॅक होत आहे',
  'stuckalerts.check': '{name} ला केलेले {amount} चे पेमेंट अडकले असेल — पैसे तुमच्या खात्यातून गेले का?',
  'stuckalerts.check.anon': '{amount} चे एक पेमेंट अडकले असेल — पैसे तुमच्या खात्यातून गेले का?',
  'stuckalerts.refund': '{name} कडून येणारा {amount} चा रिफंड जमा होईपर्यंत ट्रॅक होत आहे',
  'stuckalerts.refund.anon': '{amount} चा रिफंड जमा होईपर्यंत ट्रॅक होत आहे',
  'stuckalerts.added.many': '{count, plural, one {# पेमेंट} other {# पेमेंट}} “अडकलेले पैसे” मध्ये जोडले',
  'stuckalerts.back.failed': '{name} ला केलेले पेमेंट फेल झाले होते, त्याचे {amount} परत आले',
  'stuckalerts.back.failed.anon': 'फेल झालेल्या पेमेंटचे {amount} परत आले',
  'stuckalerts.back.failed.late':
    '{name} ला केलेले पेमेंट फेल झाले होते, त्याचे {amount} परत आले — {days, plural, one {# दिवस} other {# दिवस}} उशिरा: उशिराबद्दल तुमची बँक तुम्हाला {compensation} देणे लागते',
  'stuckalerts.back.failed.anon.late':
    'फेल झालेल्या पेमेंटचे {amount} परत आले — {days, plural, one {# दिवस} other {# दिवस}} उशिरा: उशिराबद्दल तुमची बँक तुम्हाला {compensation} देणे लागते',
  'stuckalerts.back.refund': '{name} कडून {amount} चा रिफंड जमा झाला',
  'stuckalerts.back.refund.anon': '{amount} चा रिफंड जमा झाला',
  'stuckalerts.back.many': '{count, plural, one {# अडकलेले पेमेंट परत आले} other {# अडकलेले पेमेंट परत आले}}',
}
