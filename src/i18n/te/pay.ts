/** Telugu copy for the /pay page (src/features/pay). Keys: `pay.<screen>.<element>` (see i18n-plan §3). */
import type { Messages } from '../types'

export const pay = {
  // The frame of every public page a friend opens from a link (/pay, /claim, /pool).
  'pay.shell.home.aria': '{brand} హోమ్',
  'pay.shell.what': '{brand} అంటే ఏమిటి?',
  'pay.shell.pitch.title': 'తర్వాతిసారి బిల్లు పంచుతారా?',
  'pay.shell.pitch.body': 'బిల్లును ఫోటో తీయండి, ఇలాంటి ఒక లింక్ షేర్ చేయండి, UPI ద్వారా తిరిగి పొందండి. సైన్-అప్ లేదు, ప్రకటనలు లేవు.',
  'pay.shell.pitch.cta': '{brand} తో మీ సొంత బిల్లులు పంచండి — ఉచితం',
  'pay.shell.privacy': 'గోప్యత',
  'pay.shell.terms': 'నిబంధనలు',
  // The request card, the page's h1. <by> is the small line, <what> the big title (user content).
  'pay.request.title': '<by>{name} ఇందుకోసం డబ్బు అడిగారు</by> <what>{title}</what>',
  // In the line under the title: "21 Oct · Food · Total ₹2,766".
  'pay.request.total': 'మొత్తం {amount}',
  'pay.request.collected': '{owed} లో {collected} వసూలైంది',
  'pay.request.paidCount': '{count} లో {paid} చెల్లించారు',
  // "Which one are you?" — the list of everyone on the link.
  'pay.who.title': 'మీరు ఎవరు?',
  'pay.who.empty': 'ఈ లింక్‌లో ఎవరికీ ఏమీ బాకీ లేదు.',
  'pay.who.hint': 'మీ వాటా చూడటానికి, చెల్లించడానికి మీ పేరు ట్యాప్ చేయండి.',
  // Badge next to someone the payee has marked as paid.
  'pay.who.paid': 'చెల్లించారు',
  // One person's share.
  'pay.panel.notYou.cta': '{name} కాదా? మీ పేరు ఎంచుకోండి',
  'pay.panel.share.title': '{name} వాటా',
  'pay.panel.partPaid': '{share}లో {paid} ఇప్పటికే చెల్లించారు — ఇది మిగతాది',
  'pay.panel.paid.title': 'లెక్క సమానంగా ఉంది',
  'pay.panel.paid.body': 'మీ వాటాను {name} చెల్లించినట్టు గుర్తించారు.',
  'pay.panel.reveal.cta': 'ఏమైనా చెల్లింపు వివరాలు చూపించు',
  'pay.panel.nothing.title': 'చెల్లించాల్సింది ఏమీ లేదు',
  'pay.panel.nothing.body': 'దీనిలో మీ వాటా {amount}.',
  'pay.panel.noUpi.title': '{name} UPI ID జోడించలేదు',
  'pay.panel.noUpi.body': 'ఎప్పటిలాగా వారికి చెల్లించండి — లేదా వారి UPI ID అడిగి, ఏ UPI యాప్‌తోనైనా చెల్లించండి.',
  'pay.panel.notInr.title': 'ఎప్పటిలాగా చెల్లించండి',
  'pay.panel.notInr.body': 'UPI రూపాయల్లో మాత్రమే పనిచేస్తుంది, కాబట్టి ఎప్పటిలాగా {name} కు చెల్లించండి.',
  'pay.panel.breakdown.title': 'మీ వాటాలో ఏముంది',
  'pay.panel.breakdown.share': 'మీ వాటా',
  // Under an item someone shared: "Shared 3 ways", or "2 of 3 shares" for unequal shares.
  'pay.breakdown.sharedWays': '{count} పద్ధతుల్లో పంచారు',
  'pay.breakdown.shares': '{total} వాటాల్లో {shares}',
  'pay.breakdown.extras.added': 'పన్ను, ఫీజులు & రౌండ్-ఆఫ్',
  'pay.breakdown.extras.taken': 'డిస్కౌంట్లు మరియు రౌండ్-ఆఫ్',
  // "Paid? Tell them" — a ready message the payer sends to the payee's chat.
  'pay.tell.title': 'చెల్లించారా?',
  'pay.tell.cta': '{name} గారికి చెప్పండి',
  'pay.tell.copied.status': 'మెసేజ్ కాపీ అయింది — మీ చాట్‌లో అతికించండి.',
  'pay.tell.shared.status': 'పంపబడింది. లెక్క తేల్చినందుకు ధన్యవాదాలు!',
  'pay.tell.failed.status': 'మెసేజ్ షేర్ చేయలేకపోయాం. మళ్ళీ ప్రయత్నించండి.',
  // The message itself ({title} is what the bill was for).
  'pay.tell.message': 'హాయ్ {name}! {title} కు {amount} ఇప్పుడే చెల్లించాను ✓',
  'pay.tell.message.noName': 'హాయ్! {title} కు {amount} ఇప్పుడే చెల్లించాను ✓',
  'pay.tell.message.cash': 'నమస్తే {name}! {title} కోసం {amount} నగదుగా ఇచ్చాను ✓',
  'pay.tell.message.cash.noName': 'నమస్తే! {title} కోసం {amount} నగదుగా ఇచ్చాను ✓',
  'pay.tell.message.ref': 'UPI రెఫ్: {ref}',
  'pay.tell.message.link': 'నన్ను చెల్లించినట్టు మార్క్ చేయడానికి నొక్కండి 👇',
  'pay.tell.how.upi': 'UPIతో',
  'pay.tell.how.cash': 'నగదుగా',
  'pay.tell.utr.label': 'UPI రెఫరెన్స్ (ఐచ్ఛికం)',
  'pay.tell.utr.hint': '12 అంకెలు, మీ UPI యాప్‌లోని చెల్లింపు వివరాల్లో',
  'pay.tell.utr.error': 'UPI రెఫరెన్స్‌లో 12 అంకెలు ఉంటాయి.',
  'pay.tell.opened.status': 'WhatsApp తెరుచుకుంది — {name}కి పంపండి.',
  // A link that can't be shown.
  'pay.problem.invalid.title': 'ఈ పే లింక్ పనిచేయడం లేదు',
  'pay.problem.invalid.body': 'కాపీ చేసేటప్పుడు అది మధ్యలో కట్ అయి ఉండవచ్చు. పంపినవారిని మళ్ళీ షేర్ చేయమని అడగండి.',
  'pay.problem.empty.title': 'ఇక్కడ పే లింక్ లేదు',
  'pay.problem.empty.body': 'మీ స్నేహితుడు షేర్ చేసిన లింక్ తెరవండి — వారికి చెల్లించడానికి కావలసినదంతా అందులో ఉంది.',
  'pay.loading.status': 'పే లింక్ తెరుస్తోంది…',
  // The browser tab title and the link preview.
  'pay.meta.title': '{name} కు చెల్లించండి · {title} · {brand}',
  'pay.meta.title.empty': 'పే లింక్ · {brand}',
  'pay.meta.description': 'మీ సరైన వాటా చూసి, ఏ UPI యాప్‌తోనైనా చెల్లించండి. {brand} తో పంపబడింది.',
} as const satisfies Messages
