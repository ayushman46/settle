import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} ला केलेले {amount} चे पेमेंट फेल झाले, पण पैसे कापले गेले — “अडकलेले पैसे” मध्ये ट्रॅक होत आहे',
  'stuckalerts.failed.anon': '{amount} चे एक पेमेंट फेल झाले, पण पैसे कापले गेले — “अडकलेले पैसे” मध्ये ट्रॅक होत आहे',
  'stuckalerts.failed.late':
    '{name} ला केलेले {amount} चे पेमेंट फेल झाले, पण पैसे कापले गेले — {days, plural, one {# दिवस} other {# दिवस}} उशीर झाला: उशिराबद्दल तुमची बँक तुम्हाला आतापर्यंत {compensation} देणे लागते',
  'stuckalerts.failed.anon.late':
    '{amount} चे एक पेमेंट फेल झाले, पण पैसे कापले गेले — {days, plural, one {# दिवस} other {# दिवस}} उशीर झाला: उशिराबद्दल तुमची बँक तुम्हाला आतापर्यंत {compensation} देणे लागते',
  'stuckalerts.failed.atm': 'ATM मधून {amount} मिळाले नाहीत, पण खात्यातून कापले गेले — “अडकलेले पैसे” मध्ये ट्रॅक होत आहे',
  'stuckalerts.failed.atm.late':
    'ATM मधून {amount} मिळाले नाहीत, पण खात्यातून कापले गेले — {days, plural, one {# दिवस} other {# दिवस}} उशीर झाला: उशिराबद्दल तुमची बँक तुम्हाला आतापर्यंत {compensation} देणे लागते',
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
  'stuckalerts.back.part': 'तुमच्या {amount} पैकी {back} परत आले — अजून {rest} यायचे आहेत, आणि Settle ते ट्रॅक करत राहील',
  'stuckalerts.back.many': '{count, plural, one {# अडकलेले पेमेंट परत आले} other {# अडकलेले पेमेंट परत आले}}',
  'stuckalerts.cleared': '{name} ला केलेले {amount} चे पेमेंट शेवटी पूर्ण झाले — काहीही अडकलेले नाही',
  'stuckalerts.cleared.anon': '{amount} चे एक पेमेंट शेवटी पूर्ण झाले — काहीही अडकलेले नाही',
  'stuckalerts.cleared.many': '{count, plural, one {# पेमेंट} other {# पेमेंट}} शेवटी पूर्ण झाले — काहीही अडकलेले नाही',
}
