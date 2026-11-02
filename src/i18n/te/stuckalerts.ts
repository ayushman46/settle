/** Telugu copy for Stuck money's alerts in the Android app (src/features/autosettle/useAutoSettle.ts): failed payments and refunds noticed, and money come back. */
import type { Messages } from '../types'

export const stuckalerts: Messages = {
  'stuckalerts.failed': '{name} కి {amount} చెల్లింపు ఫెయిల్ అయింది, కానీ డబ్బు కట్ అయింది — ఇరుక్కున్న డబ్బులో ట్రాక్ చేస్తున్నాం',
  'stuckalerts.failed.anon': '{amount} చెల్లింపు ఫెయిల్ అయింది, కానీ డబ్బు కట్ అయింది — ఇరుక్కున్న డబ్బులో ట్రాక్ చేస్తున్నాం',
  'stuckalerts.failed.late':
    '{name} కి {amount} చెల్లింపు ఫెయిల్ అయింది, కానీ డబ్బు కట్ అయింది — {days, plural, one {# రోజు} other {# రోజులు}} ఆలస్యం: ఆలస్యానికి ఇప్పటివరకు మీ బ్యాంక్ మీకు {compensation} ఇవ్వాలి',
  'stuckalerts.failed.anon.late':
    '{amount} చెల్లింపు ఫెయిల్ అయింది, కానీ డబ్బు కట్ అయింది — {days, plural, one {# రోజు} other {# రోజులు}} ఆలస్యం: ఆలస్యానికి ఇప్పటివరకు మీ బ్యాంక్ మీకు {compensation} ఇవ్వాలి',
  'stuckalerts.failed.atm': 'ATM మీకు {amount} ఇవ్వలేదు, కానీ మీ ఖాతా నుంచి కట్ అయింది — ఇరుక్కున్న డబ్బులో ట్రాక్ చేస్తున్నాం',
  'stuckalerts.failed.atm.late':
    'ATM మీకు {amount} ఇవ్వలేదు, కానీ మీ ఖాతా నుంచి కట్ అయింది — {days, plural, one {# రోజు} other {# రోజులు}} ఆలస్యం: ఆలస్యానికి ఇప్పటివరకు మీ బ్యాంక్ మీకు {compensation} ఇవ్వాలి',
  'stuckalerts.check': '{name} కి {amount} చెల్లింపు ఇరుక్కుపోయి ఉండవచ్చు — మీ ఖాతా నుంచి కట్ అయిందా?',
  'stuckalerts.check.anon': '{amount} చెల్లింపు ఇరుక్కుపోయి ఉండవచ్చు — మీ ఖాతా నుంచి కట్ అయిందా?',
  'stuckalerts.refund': '{name} నుంచి {amount} రీఫండ్ వచ్చే వరకు ట్రాక్ చేస్తున్నాం',
  'stuckalerts.refund.anon': '{amount} రీఫండ్ వచ్చే వరకు ట్రాక్ చేస్తున్నాం',
  'stuckalerts.added.many': 'ఇరుక్కున్న డబ్బులో {count, plural, one {# చెల్లింపు} other {# చెల్లింపులు}} జోడించాం',
  'stuckalerts.back.failed': 'ఫెయిల్ అయిన {name} చెల్లింపు {amount} తిరిగి వచ్చింది',
  'stuckalerts.back.failed.anon': 'ఫెయిల్ అయిన చెల్లింపు {amount} తిరిగి వచ్చింది',
  'stuckalerts.back.failed.late':
    'ఫెయిల్ అయిన {name} చెల్లింపు {amount} తిరిగి వచ్చింది — {days, plural, one {# రోజు} other {# రోజులు}} ఆలస్యమైంది, కాబట్టి మీ బ్యాంక్ మీకు {compensation} ఇవ్వాలి',
  'stuckalerts.back.failed.anon.late':
    'ఫెయిల్ అయిన చెల్లింపు {amount} తిరిగి వచ్చింది — {days, plural, one {# రోజు} other {# రోజులు}} ఆలస్యమైంది, కాబట్టి మీ బ్యాంక్ మీకు {compensation} ఇవ్వాలి',
  'stuckalerts.back.refund': '{name} నుంచి {amount} రీఫండ్ వచ్చింది',
  'stuckalerts.back.refund.anon': '{amount} రీఫండ్ వచ్చింది',
  'stuckalerts.back.part': 'మీ {amount} లో {back} తిరిగి వచ్చింది — ఇంకా {rest} రావాలి, Settle ట్రాక్ చేస్తూనే ఉంటుంది',
  'stuckalerts.back.many': '{count, plural, one {ఇరుక్కుపోయిన # చెల్లింపు తిరిగి వచ్చింది} other {ఇరుక్కుపోయిన # చెల్లింపులు తిరిగి వచ్చాయి}}',
  'stuckalerts.cleared': '{name} కి {amount} చెల్లింపు చివరికి పూర్తయింది — ఏదీ ఇరుక్కుపోలేదు',
  'stuckalerts.cleared.anon': '{amount} చెల్లింపు చివరికి పూర్తయింది — ఏదీ ఇరుక్కుపోలేదు',
  'stuckalerts.cleared.many': '{count, plural, one {# చెల్లింపు చివరికి పూర్తయింది} other {# చెల్లింపులు చివరికి పూర్తయ్యాయి}} — ఏదీ ఇరుక్కుపోలేదు',
}
