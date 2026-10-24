/** Telugu copy for client API errors (src/api). Keys: `api.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const api = {
  // What we tell people when a bill scan fails, by error code. Never the server's own words.
  'api.scan.error.bad_request': 'ఆ ఫోటోతో ఏదో సమస్య వచ్చింది. మరొకటి ప్రయత్నించండి.',
  'api.scan.error.unsupported_image': 'దయచేసి JPG లేదా PNG ఫోటో వాడండి.',
  'api.scan.error.image_too_large': 'ఆ ఫోటో చాలా పెద్దది. చిన్నదాన్ని ప్రయత్నించండి — లేదా దాని స్క్రీన్‌షాట్ తీయండి.',
  'api.scan.error.not_a_bill': 'ఇది బిల్లులా కనిపించడం లేదు. మొత్తం రసీదు స్పష్టమైన ఫోటోను ప్రయత్నించండి.',
  'api.scan.error.unreadable': 'ఏ ఐటమ్‌లనూ చదవలేకపోయాం. ఇంకా స్పష్టమైన, వెలుతురులో తీసిన ఫోటోను ప్రయత్నించండి — లేదా చేతితో నమోదు చేయండి.',
  'api.scan.error.not_configured': 'ఫోటో స్కాన్ ఇప్పుడు అందుబాటులో లేదు — ఐటమ్‌లను టైప్ చేయవచ్చు.',
  'api.scan.error.upstream_auth': 'ఫోటో స్కాన్ ఇప్పుడు పనిచేయడం లేదు — ఐటమ్‌లను టైప్ చేయవచ్చు.',
  'api.scan.error.rate_limited': 'ఇప్పుడు చాలా స్కాన్లు జరుగుతున్నాయి. కొన్ని నిమిషాల్లో మళ్ళీ ప్రయత్నించండి — లేదా ఐటమ్‌లను టైప్ చేయండి.',
  'api.scan.error.timeout': 'బిల్లు చదవడానికి చాలా సమయం పట్టింది. ఇంకా స్పష్టమైన, దగ్గరగా తీసిన ఫోటోతో మళ్ళీ ప్రయత్నించండి.',
  'api.scan.error.upstream_error': 'AI సేవను చేరుకోలేకపోయాం. దయచేసి మళ్ళీ ప్రయత్నించండి.',
  'api.scan.error.network': 'మీరు ఆఫ్‌లైన్‌లో ఉన్నట్లు ఉంది. కనెక్షన్ చూసి మళ్ళీ ప్రయత్నించండి.',
  'api.scan.error.aborted': 'స్కాన్ రద్దు చేయబడింది.',
  // A short wait: the server is busy, nobody did anything wrong.
  'api.scan.busy': 'ఇప్పుడు చాలా బిల్లులు చదవబడుతున్నాయి — కాసేపటికి మళ్ళీ ప్రయత్నించండి.',
  // A long wait; `{wait}` is "about 10 minutes" (api.wait.*).
  'api.scan.proLimit': 'ఈ రోజు ఫెయిర్-యూజ్ AI పరిమితి అయిపోయింది. {wait} తర్వాత మళ్ళీ అందుబాటులోకి వస్తుంది — అప్పటి వరకు ఐటమ్‌లను టైప్ చేయవచ్చు.',
  'api.scan.limit': 'చాలా స్కాన్లు అయ్యాయి. {wait} తర్వాత మళ్ళీ ప్రయత్నించండి — లేదా ఐటమ్‌లను టైప్ చేయండి.',
  'api.scan.offline': 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు — ఐటమ్‌లను ఇంకా టైప్ చేయవచ్చు.',
  // A picked photo we can't use.
  'api.image.error.not_image': 'అది ఫోటో కాదు. దయచేసి JPG లేదా PNG ఇమేజ్‌ను ఎంచుకోండి.',
  'api.image.error.decode_failed': 'ఆ ఇమేజ్‌ను తెరవలేకపోయాం. JPG లేదా PNG ప్రయత్నించండి — లేదా దాని స్క్రీన్‌షాట్ తీయండి.',
  'api.image.error.too_large': 'ఆ ఫోటో చాలా పెద్దది (25 MB కంటే ఎక్కువ). చిన్నదాన్ని ప్రయత్నించండి — లేదా దాని స్క్రీన్‌షాట్ తీయండి.',
  // How long a wait is, rounded up.
  'api.wait.minute': 'సుమారు ఒక నిమిషం',
  'api.wait.minutes': 'సుమారు {count} నిమిషాలు',
  'api.wait.hours': 'సుమారు {count} గంటలు',
} as const satisfies Messages
