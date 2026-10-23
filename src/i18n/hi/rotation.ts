/** Hindi copy for S4 · next round's on you. Keys: `rotation.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included. Always followed by के लिए / में.
  'rotation.everyone': '{count, plural, =2 {आप दोनों} one {# व्यक्ति} other {आप सभी # लोगों}}',
  'rotation.everyone.you': '{count, plural, =2 {आप दोनों} one {# व्यक्ति} other {सभी # लोगों}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': 'अगली बारी {name} की',
  'rotation.card.title.you': 'अगली बारी आपकी',
  'rotation.card.body': '{name} पर {behind} बाकी हैं। अगर {name} {everyone} के लिए अगले {squares} का खर्च उठाएँ, तो {name} का हिसाब बराबर।',
  'rotation.card.body.you': 'आप पर {behind} बाकी हैं। {everyone} के लिए अगले {squares} का खर्च आप उठाएँ, तो हिसाब बराबर।',
  'rotation.card.usual': 'यहाँ आम तौर पर एक बारी {usual} की होती है — इससे ग्रुप के बाकी {out} में से {settles} चुक जाते हैं।',
  // When the usual round is bigger than helps.
  'rotation.card.fallback':
    '{name} पर {behind} बाकी हैं। {everyone} के लिए {squares} तक देने से {name} का हिसाब बराबर — इससे बड़ी बारी पर {name} को पैसे लेने होंगे।',
  'rotation.card.fallback.you':
    'आप पर {behind} बाकी हैं। {everyone} के लिए {squares} तक देने से आपका हिसाब बराबर — इससे बड़ी बारी पर आपको पैसे लेने होंगे।',
  // When only people who left the group are behind.
  'rotation.card.left.title': 'हिसाब बराबर कर लें',
  'rotation.card.left': '{name} ने {amount} बाकी रहते ग्रुप छोड़ दिया — बारी की जगह हिसाब बराबर करें।',
  'rotation.card.left.many': 'ग्रुप छोड़ चुके {count} लोगों का {amount} बाकी है — बारी की जगह हिसाब बराबर करें।',
  'rotation.card.log.cta': 'अगली बारी लिखें',
  'rotation.card.plan.cta': 'बारियाँ देखें',
  'rotation.card.settle.cta': 'हिसाब बराबर करें',
  // The banner on the new split the card opens.
  'rotation.banner.title': '{name} की बारी',
  'rotation.banner.title.you': 'आपकी बारी',
  'rotation.banner.body': '{amount} तक में {name} का हिसाब बराबर। इससे ज़्यादा पर {name} को पैसे लेने होंगे।',
  'rotation.banner.body.you': '{amount} तक में आपका हिसाब बराबर। इससे ज़्यादा पर आपको पैसे लेने होंगे।',
  // The rotation sheet.
  'rotation.sheet.title': 'बारी-बारी से पे करें',
  'rotation.sheet.description': 'एक-दूसरे को पैसे लौटाने की जगह, हर बार कोई एक सबके लिए पे करे। हर बारी {everyone} में बराबर बँटती है।',
  'rotation.sheet.amount.label': 'हर बारी, लगभग',
  'rotation.sheet.amount.error': 'रकम डालें',
  'rotation.sheet.reset.cta': 'रीसेट करें',
  'rotation.sheet.reset.aria': 'आम बारी पर वापस जाएँ',
  'rotation.sheet.rounds.label': 'बारियाँ',
  'rotation.sheet.round.title': 'बारी {n}: {name}',
  'rotation.sheet.round.title.you': 'बारी {n}: आप',
  'rotation.sheet.round.subtitle': 'बाकी {before} → {after}',
  'rotation.sheet.round.settles': '{amount} चुकता',
  'rotation.sheet.round.aria': 'बारी {n}, पे करने वाले {name}, ग्रुप का बाकी {before} से {after}, {amount} चुकता',
  'rotation.sheet.round.aria.you': 'बारी {n}, आप पे करेंगे, ग्रुप का बाकी {before} से {after}, {amount} चुकता',
  'rotation.sheet.square': 'बारी {n} के बाद सबका हिसाब बराबर 🎉',
  'rotation.sheet.leftover': 'फिर आखिरी {amount} का हिसाब करें:',
  'rotation.sheet.empty.title': '{amount} की बारी किसी के भी बाकी से बड़ी है',
  'rotation.sheet.empty.body': 'छोटी बारी आज़माएँ — या हिसाब बराबर करें।',
  'rotation.sheet.settle.cta': 'हिसाब बराबर करें',
  'rotation.sheet.log.cta': 'पहली बारी लिखें — {name} की',
  'rotation.sheet.log.cta.you': 'पहली बारी लिखें — आपकी',
  'rotation.sheet.live': 'प्लान अपडेट हुआ: {count, plural, one {# बारी} other {# बारियाँ}}',
  'rotation.sheet.live.none': 'प्लान अपडेट हुआ: किसी बारी से फ़ायदा नहीं',
} as const satisfies Messages
