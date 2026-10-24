/** Telugu copy for S3 · speak to split. Keys: `voice.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const voice = {
  // The round mic next to Home's "Just say it" pill, and the one inside the sheet's field.
  'voice.mic.home.aria': 'స్ప్లిట్ చేయడానికి మాట్లాడండి',
  'voice.mic.sheet.aria': 'బదులుగా మాట్లాడండి',
  'voice.mic.offline': 'వాయిస్‌కు ఇంటర్నెట్ కావాలి',
  // The listening panel inside "Just say it".
  'voice.listen.title': 'వింటోంది…',
  // Announced to screen readers when listening starts: "Listening in Hindi".
  'voice.listen.aria': '{language} లో వింటోంది',
  'voice.listen.language.aria': '{native}, {language} లో మాట్లాడండి. భాష మార్చండి',
  'voice.listen.stop.cta': 'ఆపు',
  'voice.listen.tip': 'అది ఏమిటి, ఎంత, ఎవరు ఉన్నారు అని చెప్పండి — ఉదాహరణకు',
  'voice.listen.heard.aria': 'విన్నది: {text}',
  // Chips under the field for each number phrase turned into digits.
  'voice.heard.chip': '“{phrase}” విన్నది → {amount}',
  'voice.heard.label': 'మేము విన్న సంఖ్యలు',
  // When the transcript is longer than the AI can read.
  'voice.long.title': 'ఇది చాలా పొడవుగా ఉంది — క్లుప్తంగా చెప్పండి',
  'voice.long.body': 'మొదటి {max} అక్షరాలు మాత్రమే సరిపోతాయి. కత్తిరించండి, లేదా ఒకే వాక్యంలో మళ్ళీ చెప్పండి.',
  // The split screen's banner after "Looks right".
  'voice.banner.title': 'మీరు చెప్పిన దాని నుంచి నింపబడింది',
  'voice.banner.body': 'మొత్తం, ఎవరు ఉన్నారో చెక్ చేసి, సేవ్ చేయండి.',
  // The language sheet.
  'voice.lang.title': 'ఈ భాషలో మాట్లాడండి',
  'voice.lang.note': 'మీ బ్రౌజర్ మీ వాయిస్‌ను టెక్స్ట్‌గా మారుస్తుంది — దీనికి Chrome, Google స్పీచ్ సేవను ఉపయోగిస్తుంది. Settle ఎప్పుడూ ఆడియోను రికార్డ్ చేయదు, ఉంచదు.',
  'voice.lang.en.english': 'ఇంగ్లీష్ (భారత్)',
  'voice.lang.hi.english': 'హిందీ · Hinglish కోసం కూడా',
  'voice.lang.bn.english': 'బెంగాలీ',
  'voice.lang.mr.english': 'మరాఠీ',
  'voice.lang.ta.english': 'తమిళం',
  'voice.lang.te.english': 'తెలుగు',
  'voice.lang.kn.english': 'కన్నడ',
  'voice.lang.gu.english': 'గుజరాతీ',
  // Errors (a banner in the sheet; then back to typing).
  'voice.error.blocked.title': 'మైక్ బ్లాక్ చేయబడింది',
  'voice.error.blocked.body': 'మీ బ్రౌజర్ సైట్ సెట్టింగ్స్‌లో Settle కు మైక్రోఫోన్‌ను అనుమతించండి — లేదా టైప్ చేయండి.',
  'voice.error.noSpeech.title': 'వినిపించలేదు',
  'voice.error.noSpeech.body': 'మైక్ నొక్కి మళ్ళీ ప్రయత్నించండి — బీప్ తర్వాత మాట్లాడండి.',
  'voice.error.noMic.title': 'మైక్రోఫోన్ దొరకలేదు',
  'voice.error.noMic.body': 'ఒకదాన్ని కనెక్ట్ చేయండి, లేదా బదులుగా టైప్ చేయండి.',
  'voice.error.network.title': 'వాయిస్‌కు ఇంటర్నెట్ కావాలి',
  'voice.error.network.body': 'మీ బ్రౌజర్ మాటను ఆన్‌లైన్‌లో టెక్స్ట్‌గా మారుస్తుంది. ఆఫ్‌లైన్‌లో ఉంటే బదులుగా టైప్ చేయండి.',
  'voice.error.language.title': '{language} ఈ బ్రౌజర్‌లో అందుబాటులో లేదు',
  'voice.error.language.body': 'ఇంగ్లీష్ లేదా हिन्दी ప్రయత్నించండి, లేదా టైప్ చేయండి.',
  'voice.error.other.title': 'ఈసారి వాయిస్ పనిచేయలేదు',
  'voice.error.other.body': 'మళ్ళీ ప్రయత్నించండి, లేదా టైప్ చేయండి.',
} as const satisfies Messages
