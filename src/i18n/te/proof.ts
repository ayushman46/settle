/** Telugu copy for payment screenshots (src/features/proof). Keys: `proof.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'చెల్లించారా? స్క్రీన్‌షాట్ వేయండి',
  'proof.screen.subtitle': 'GPay, PhonePe, Paytm లేదా మీ బ్యాంక్ యాప్ నుంచి చెల్లింపు స్క్రీన్‌షాట్ వేయండి. Settle దాన్ని తనిఖీ చేసి, ఎవరు మీకు చెల్లించారో గుర్తిస్తుంది.',
  'proof.drop.choose': 'స్క్రీన్‌షాట్ ఎంచుకోండి',
  'proof.drop.aria': 'చెల్లింపు స్క్రీన్‌షాట్ ఎంచుకోండి',
  'proof.drop.hint': 'JPG, PNG లేదా WebP. ఒకసారి మాత్రమే చదువుతుంది; ఏదీ నిల్వ చేయదు.',
  'proof.reading.title': 'స్క్రీన్‌షాట్ చదువుతోంది…',
  'proof.reading.cancel': 'రద్దు చేయండి',
  'proof.again': 'మరో స్క్రీన్‌షాట్ వేయండి',
  // What goes wrong reading the screenshot.
  'proof.error.generic': 'స్క్రీన్‌షాట్ చదవలేకపోయాం. మళ్ళీ ప్రయత్నించండి, లేదా వ్యక్తిని మీరే ఎంచుకోండి.',
  'proof.error.network': 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. కనెక్ట్ చేసి మళ్ళీ ప్రయత్నించండి.',
  'proof.error.not_a_payment': 'ఇది UPI చెల్లింపులా కనిపించడం లేదు. మీ చెల్లింపు యాప్‌లోని సక్సెస్ స్క్రీన్‌ను ప్రయత్నించండి.',
  'proof.error.unsupported_image': 'దయచేసి JPG, PNG లేదా WebP స్క్రీన్‌షాట్ వాడండి.',
  'proof.error.image_too_large': 'ఆ స్క్రీన్‌షాట్ చాలా పెద్దది. చిన్నదాన్ని ప్రయత్నించండి.',
  'proof.error.rate_limited': 'ఇప్పుడు చాలా స్క్రీన్‌షాట్లు వచ్చాయి. కొన్ని నిమిషాల్లో మళ్ళీ ప్రయత్నించండి.',
  'proof.error.timeout': 'స్క్రీన్‌షాట్ చదవడానికి చాలా సమయం పట్టింది. మళ్ళీ ప్రయత్నించండి.',
  'proof.error.unreadable': 'ఆ స్క్రీన్‌షాట్ చదవలేకపోయాం. మంచి వెలుతురులో, పూర్తి సక్సెస్ స్క్రీన్‌ను ప్రయత్నించండి.',
  'proof.error.not_configured': 'స్క్రీన్‌షాట్ చదివే సదుపాయం ఇప్పుడు అందుబాటులో లేదు.',
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'ఈ చెల్లింపు ఇంకా పెండింగ్‌లో ఉంది. చెల్లించినట్లుగా గుర్తించడం లేదు.',
  'proof.verdict.pending.body': 'అది Paid అని చూపించినప్పుడు మళ్ళీ స్క్రీన్‌షాట్ వేయండి.',
  'proof.verdict.failed.title': 'ఈ చెల్లింపు విఫలమైంది. చెల్లించినట్లుగా గుర్తించడం లేదు.',
  'proof.verdict.failed.body': 'ఏమీ చెల్లించలేదు. మళ్ళీ ప్రయత్నించమని వారిని అడగండి.',
  'proof.verdict.unreadable.title': 'ఈ చెల్లింపు జరిగిందో లేదో మేం చెప్పలేకపోతున్నాం.',
  'proof.verdict.unreadable.body': 'సక్సెస్ స్క్రీన్ స్క్రీన్‌షాట్ వేయండి.',
  'proof.verdict.wrongPayee.title': 'ఈ డబ్బు మీకు వెళ్లలేదు. చెల్లించినట్లుగా గుర్తించడం లేదు.',
  'proof.verdict.wrongPayee.body': 'ఇది {payee} కు వెళ్లింది.',
  'proof.verdict.payeeUnknown.title': 'ఈ చెల్లింపు ఎవరికి అందిందో మేం చూడలేకపోతున్నాం. చెల్లించినట్లుగా గుర్తించడం లేదు.',
  'proof.verdict.payeeUnknown.body': 'స్వీకర్త పేరు లేదా UPI ID కనిపించే స్క్రీన్‌షాట్ వేయండి.',
  'proof.verdict.duplicate.title': 'ఈ చెల్లింపు ఇప్పటికే నమోదై ఉంది.',
  'proof.verdict.duplicate.body': 'UPI ref {utr} ఇప్పటికే {name} పేరుతో గుర్తించబడి ఉంది.',
  'proof.verdict.duplicate.someone': 'మీ జాబితాలో ఒకరు',
  // A match: one person owes exactly this.
  'proof.match.title': '{name} ఇవ్వాల్సిన {amount} చెల్లించినట్లు గుర్తించాలా?',
  'proof.match.ref': 'UPI ref {utr}',
  'proof.match.noRef': 'ఈ స్క్రీన్‌లో UPI ref లేదు. ఇది సరైన చెల్లింపేనా అని చూడండి.',
  'proof.match.confirm': 'చెల్లించినట్లు గుర్తించు',
  'proof.match.notThis': 'ఇది కాదు',
  'proof.match.done': '{name} ఇవ్వాల్సిన {amount} చెల్లించినట్లు గుర్తించబడింది.',
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': 'దీన్ని ఎవరితోనూ సరిపోల్చలేకపోయాం.',
  'proof.nomatch.amount': 'స్క్రీన్ {amount} చూపిస్తోంది. మీకు చెల్లించింది వీరిలో ఒకరైతే ఎంచుకోండి.',
  'proof.nomatch.noAmount': 'స్క్రీన్‌లో మొత్తం కనిపించడం లేదు. మీకు చెల్లించింది ఎవరో ఎంచుకోండి.',
  'proof.nomatch.none': 'సరిగ్గా {amount} ఇవ్వాల్సినవారు ఎవరూ లేరు. స్నేహితుల విభాగంలో మొత్తాన్ని తనిఖీ చేయండి.',
  'proof.nomatch.pick': '{name} ({amount}) ను ఎంచుకోండి',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'మరో యాప్ నుంచి షేర్ చేయబడింది',
  'proof.more.title': 'చెల్లించారా? స్క్రీన్‌షాట్ వేయండి',
  'proof.more.subtitle': 'UPI చెల్లింపును స్క్రీన్‌షాట్ నుంచి చెల్లించినట్లు గుర్తించండి',
} as const satisfies Messages
