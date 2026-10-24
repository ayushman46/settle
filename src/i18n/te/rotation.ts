/** Telugu copy for S4 · next round's on you. Keys: `rotation.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const rotation = {
  // "Everyone" in a round: the current members, you included.
  'rotation.everyone': '{count, plural, =2 {మీ ఇద్దరూ} other {మీలో అందరు # మంది}}',
  'rotation.everyone.you': '{count, plural, =2 {మీ ఇద్దరూ} other {అందరూ #}}',
  // The card on a group, between where you stand and the tabs.
  'rotation.card.title': 'తర్వాతి వంతు {name} దే',
  'rotation.card.title.you': 'తర్వాతి వంతు మీదే',
  'rotation.card.body': '{name} {behind} వెనుకబడి ఉన్నారు. {everyone} కోసం తర్వాతి {squares} {name} చెల్లిస్తే, {name} సమానం అవుతారు.',
  'rotation.card.body.you': 'మీరు {behind} వెనుకబడి ఉన్నారు. {everyone} కోసం తర్వాతి {squares} చెల్లిస్తే మీరు సమానం అవుతారు.',
  'rotation.card.usual': 'ఇక్కడ సాధారణ వంతు {usual}. అది గ్రూప్ {out} బాకీలో {settles} తీరుస్తుంది.',
  // When the usual round is bigger than helps.
  'rotation.card.fallback': '{name} {behind} వెనుకబడి ఉన్నారు. {everyone} కోసం {squares} వరకు చెల్లిస్తే {name} సమానం అవుతారు — పెద్ద వంతు {name} ను ముందుకు తీసుకెళ్తుంది.',
  'rotation.card.fallback.you': 'మీరు {behind} వెనుకబడి ఉన్నారు. {everyone} కోసం {squares} వరకు చెల్లిస్తే మీరు సమానం అవుతారు — పెద్ద వంతు మిమ్మల్ని ముందుకు తీసుకెళ్తుంది.',
  // When only people who left the group are behind.
  'rotation.card.left.title': 'బదులుగా లెక్క తేల్చండి',
  'rotation.card.left': 'గ్రూప్ వదిలి వెళ్లిన {name} {amount} తేల్చాల్సి ఉంది — బదులుగా లెక్క తేల్చండి.',
  'rotation.card.left.many': 'గ్రూప్ వదిలి వెళ్లిన {count} మంది {amount} తేల్చాల్సి ఉంది — బదులుగా లెక్క తేల్చండి.',
  'rotation.card.log.cta': 'తర్వాతి వంతును నమోదు చేయండి',
  'rotation.card.plan.cta': 'వంతుల ప్లాన్ చూడండి',
  'rotation.card.settle.cta': 'లెక్క తేల్చండి',
  // The banner on the new split the card opens.
  'rotation.banner.title': '{name} వంతు',
  'rotation.banner.title.you': 'మీ వంతు',
  'rotation.banner.body': '{amount} వరకు {name} సమానం అవుతారు. అంతకంటే ఎక్కువైతే {name} ముందుంటారు.',
  'rotation.banner.body.you': '{amount} వరకు మీరు సమానం అవుతారు. అంతకంటే ఎక్కువైతే మీరు ముందుంటారు.',
  // The rotation sheet.
  'rotation.sheet.title': 'ముందుగా చెల్లించండి',
  'rotation.sheet.description': 'ఒకరికొకరు తిరిగి ఇవ్వడానికి బదులు, అందరి కోసం వంతులవారీగా చెల్లించండి. ప్రతి వంతును {everyone} మధ్య సమానంగా పంచుతారు.',
  'rotation.sheet.amount.label': 'ప్రతి వంతుకు, సుమారు',
  'rotation.sheet.amount.error': 'మొత్తం నమోదు చేయండి',
  'rotation.sheet.reset.cta': 'రీసెట్',
  'rotation.sheet.reset.aria': 'సాధారణ వంతుకు రీసెట్ చేయండి',
  'rotation.sheet.rounds.label': 'వంతులు',
  'rotation.sheet.round.title': '{n} · {name} చెల్లిస్తారు',
  'rotation.sheet.round.title.you': '{n} · మీరు చెల్లిస్తారు',
  'rotation.sheet.round.subtitle': 'గ్రూప్ బాకీ {before} → {after}',
  'rotation.sheet.round.settles': '{amount} తీరుతుంది',
  'rotation.sheet.round.aria': 'వంతు {n}, {name} చెల్లిస్తారు, గ్రూప్ బాకీ {before} నుంచి {after} కి, {amount} తీరుతుంది',
  'rotation.sheet.round.aria.you': 'వంతు {n}, మీరు చెల్లిస్తారు, గ్రూప్ బాకీ {before} నుంచి {after} కి, {amount} తీరుతుంది',
  'rotation.sheet.square': 'వంతు {n} తర్వాత అందరూ సమానం 🎉',
  'rotation.sheet.leftover': 'తర్వాత చివరి {amount} తేల్చండి:',
  'rotation.sheet.empty.title': '{amount} వంతు ఎవరి బాకీ కంటే అయినా పెద్దది',
  'rotation.sheet.empty.body': 'చిన్న వంతును ప్రయత్నించండి — లేదా లెక్క తేల్చండి.',
  'rotation.sheet.settle.cta': 'లెక్క తేల్చండి',
  'rotation.sheet.log.cta': '{name} చెల్లించేలా వంతు 1 నమోదు చేయండి',
  'rotation.sheet.log.cta.you': 'మీరు చెల్లించేలా వంతు 1 నమోదు చేయండి',
  'rotation.sheet.live': 'ప్లాన్ అప్‌డేట్ అయింది: {count, plural, one {# వంతు} other {# వంతులు}}',
  'rotation.sheet.live.none': 'ప్లాన్ అప్‌డేట్ అయింది: ఏ వంతూ సహాయపడదు',
} as const satisfies Messages
