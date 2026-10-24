/** Marathi copy for "Pay it forward" rounds (take turns paying for everyone). Keys: `rotation.<part>.<element>`. */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included.
  'rotation.everyone': '{count, plural, =2 {तुम्ही दोघे} other {तुम्ही सर्व, एकूण #}}',
  'rotation.everyone.you': '{count, plural, =2 {तुम्ही दोघे} other {सर्व, एकूण #}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': 'पुढची पाळी {name} यांची',
  'rotation.card.title.you': 'पुढची पाळी तुमची',
  'rotation.card.body': '{name} यांचे {behind} बाकी. {name} यांनी {everyone} साठी पुढचे {squares} दिले, तर {name} यांचा हिशोब मिटेल.',
  'rotation.card.body.you': 'तुमचे {behind} बाकी आहे. {everyone} साठी पुढचे {squares} दिले, तर तुमचा हिशोब मिटेल.',
  'rotation.card.usual': 'इथे नेहमीची पाळी {usual} असते — त्याने गटाच्या {out} पैकी {settles} मिटतात.',
  // When the usual round is bigger than helps.
  'rotation.card.fallback': '{name} यांचे {behind} बाकी. {everyone} साठी जास्तीत जास्त {squares} दिले तर {name} यांचा हिशोब बरोबर होतो — मोठी पाळी केली तर {name} पुढे जातील.',
  'rotation.card.fallback.you': 'तुमचे {behind} बाकी आहे. {everyone} साठी जास्तीत जास्त {squares} दिले तर तुमचा हिशोब बरोबर होतो — मोठी पाळी केली तर तुम्ही पुढे जाल.',
  // When only people who left the group are behind.
  'rotation.card.left.title': 'त्याऐवजी हिशोब मिटवा',
  'rotation.card.left': '{name} ग्रुप सोडून गेले, त्यांचे {amount} मिटवायचे आहेत — त्याऐवजी हिशोब मिटवा.',
  'rotation.card.left.many': 'ग्रुप सोडून गेलेल्या {count} जणांचे {amount} मिटवायचे आहेत — त्याऐवजी हिशोब मिटवा.',
  'rotation.card.log.cta': 'पुढची पाळी नोंदवा',
  'rotation.card.plan.cta': 'पाळीचे नियोजन पहा',
  'rotation.card.settle.cta': 'हिशोब मिटवा',
  // The banner on the new split the card opens.
  'rotation.banner.title': '{name} यांची पाळी',
  'rotation.banner.title.you': 'तुमची पाळी',
  'rotation.banner.body': 'जास्तीत जास्त {amount} दिले तर {name} यांचा हिशोब बरोबर होतो. त्याहून जास्त झाले तर {name} पुढे जातील.',
  'rotation.banner.body.you': 'जास्तीत जास्त {amount} दिले तर तुमचा हिशोब बरोबर होतो. त्याहून जास्त झाले तर तुम्ही पुढे जाल.',
  // The rotation sheet.
  'rotation.sheet.title': 'आज तुम्ही, उद्या मी',
  'rotation.sheet.description': 'एकमेकांना परत न देता, पाळी घेऊन सर्वांसाठी पैसे द्या. प्रत्येक पाळी {everyone} मध्ये समान वाटली जाईल.',
  'rotation.sheet.amount.label': 'प्रत्येक पाळीत सुमारे',
  'rotation.sheet.amount.error': 'रक्कम टाका',
  'rotation.sheet.reset.cta': 'रीसेट',
  'rotation.sheet.reset.aria': 'नेहमीच्या पाळीवर परत जा',
  'rotation.sheet.rounds.label': 'पाळ्या',
  'rotation.sheet.round.title': '{n} · {name} देणार',
  'rotation.sheet.round.title.you': '{n} · तुम्ही देणार',
  'rotation.sheet.round.subtitle': 'गट बाकी {before} → {after}',
  'rotation.sheet.round.settles': '{amount} मिटतात',
  'rotation.sheet.round.aria': 'पाळी {n}, {name} देणार, गट बाकी {before} वरून {after}, {amount} मिटतात',
  'rotation.sheet.round.aria.you': 'पाळी {n}, तुम्ही देणार, गट बाकी {before} वरून {after}, {amount} मिटतात',
  'rotation.sheet.square': 'पाळी {n} नंतर सर्वांचा हिशोब बरोबर 🎉',
  'rotation.sheet.leftover': 'मग शेवटची {amount} मिटवा:',
  'rotation.sheet.empty.title': 'एक {amount} ची पाळी कोणाच्याही बाकीपेक्षा मोठी आहे',
  'rotation.sheet.empty.body': 'लहान पाळी करून पहा — किंवा हिशोब मिटवा.',
  'rotation.sheet.settle.cta': 'हिशोब मिटवा',
  'rotation.sheet.log.cta': 'पाळी 1 नोंदवा, {name} देणार',
  'rotation.sheet.log.cta.you': 'पाळी 1 नोंदवा, तुम्ही देणार',
  'rotation.sheet.live': 'नियोजन अद्ययावत: {count, plural, one {# पाळी} other {# पाळ्या}}',
  'rotation.sheet.live.none': 'नियोजन अद्ययावत: कोणतीही पाळी उपयोगी नाही',
} as const satisfies Messages
