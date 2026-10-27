/** Marathi copy for the public pay page (opened from a friend's link). Keys: `pay.<area>.<element>`. */
import type { Messages } from '../types'

export const pay = {
  // The frame of every public page a friend opens from a link (/pay, /claim, /pool).
  'pay.shell.home.aria': '{brand} होम',
  'pay.shell.what': '{brand} म्हणजे काय?',
  'pay.shell.pitch.title': 'पुढच्या वेळी बिल वाटायचे?',
  'pay.shell.pitch.body': 'बिलाचा फोटो घ्या, अशीच एक लिंक शेअर करा, आणि UPI ने परत मिळवा. साइन-अप नाही, जाहिराती नाहीत.',
  'pay.shell.pitch.cta': '{brand} वापरून तुमची बिले वाटा — मोफत',
  'pay.shell.privacy': 'गोपनीयता',
  'pay.shell.terms': 'अटी',

  // The request card, the page's h1. <by> is the small line, <what> the big title (user content).
  'pay.request.title': '<by>{name} यांनी पैसे मागितले</by> <what>{title}</what>',
  // In the line under the title: "21 Oct · Food · Total ₹2,766".
  'pay.request.total': 'एकूण {amount}',
  'pay.request.collected': '{owed} पैकी {collected} जमा',
  'pay.request.paidCount': '{count} पैकी {paid} जणांनी दिले',

  // "Which one are you?" — the list of everyone on the link.
  'pay.who.title': 'तुम्ही कोण आहात?',
  'pay.who.empty': 'या लिंकवर कोणाचेही काही देणे नाही.',
  'pay.who.hint': 'तुमचा हिस्सा पाहण्यासाठी आणि पैसे देण्यासाठी तुमच्या नावावर टॅप करा.',
  // Badge next to someone the payee has marked as paid.
  'pay.who.paid': 'दिले',

  // One person's share.
  'pay.panel.notYou.cta': '{name} नाही? तुमचे नाव निवडा',
  'pay.panel.share.title': '{name} यांचा हिस्सा',
  'pay.panel.partPaid': '{share} पैकी {paid} आधीच दिले — हे उरलेले',
  'pay.panel.paid.title': 'तुमचा हिशोब मिटला आहे',
  'pay.panel.paid.body': '{name} यांनी तुमचा हिस्सा दिला म्हणून चिन्हांकित केले आहे.',
  'pay.panel.reveal.cta': 'तरीही पेमेंट तपशील दाखवा',
  'pay.panel.nothing.title': 'देण्यासारखे काही नाही',
  'pay.panel.nothing.body': 'यातील तुमचा हिस्सा {amount} आहे.',
  'pay.panel.noUpi.title': '{name} यांनी UPI ID जोडलेला नाही',
  'pay.panel.noUpi.body': 'नेहमीप्रमाणे त्यांना पैसे द्या — किंवा त्यांचा UPI ID विचारून कोणत्याही UPI ॲपने द्या.',
  'pay.panel.notInr.title': 'नेहमीच्या पद्धतीने द्या',
  'pay.panel.notInr.body': 'UPI फक्त रुपयांत चालतो, म्हणून {name} यांना नेहमीच्या पद्धतीने द्या.',
  'pay.panel.breakdown.title': 'तुमच्या हिश्यात काय आहे',
  'pay.panel.breakdown.share': 'तुमचा हिस्सा',
  // Under an item someone shared: "Shared 3 ways", or "2 of 3 shares" for unequal shares.
  'pay.breakdown.sharedWays': '{count} जणांत वाटले',
  'pay.breakdown.shares': '{total} पैकी {shares} हिस्से',
  'pay.breakdown.extras.added': 'कर, शुल्क आणि राउंड-ऑफ',
  'pay.breakdown.extras.taken': 'सवलती आणि राउंड-ऑफ',

  // "Paid? Tell them" — a ready message the payer sends to the payee's chat.
  'pay.tell.title': 'पैसे दिले?',
  'pay.tell.cta': '{name} यांना सांगा की तुम्ही दिले आहेत',
  'pay.tell.copied.status': 'संदेश कॉपी झाला — तुमच्या चॅटमध्ये पेस्ट करा.',
  'pay.tell.shared.status': 'पाठवला. हिशोब मिटवल्याबद्दल धन्यवाद!',
  'pay.tell.failed.status': 'संदेश शेअर करता आला नाही. पुन्हा प्रयत्न करा.',
  // The message itself ({title} is what the bill was for).
  'pay.tell.message': 'नमस्कार {name}! {title} साठी आत्ताच {amount} दिले ✓',
  'pay.tell.message.noName': 'नमस्कार! {title} साठी आत्ताच {amount} दिले ✓',
  'pay.tell.message.cash': 'नमस्कार {name}! {title} साठी {amount} रोख दिले ✓',
  'pay.tell.message.cash.noName': 'नमस्कार! {title} साठी {amount} रोख दिले ✓',
  'pay.tell.message.ref': 'UPI रेफ: {ref}',
  'pay.tell.message.link': 'मला पैसे दिलेले म्हणून मार्क करण्यासाठी टॅप करा 👇',
  'pay.tell.how.upi': 'UPI ने',
  'pay.tell.how.cash': 'रोख',
  'pay.tell.utr.label': 'UPI रेफरन्स (ऐच्छिक)',
  'pay.tell.utr.hint': '12 अंक, तुमच्या UPI ॲपमधील पेमेंटच्या तपशिलात',
  'pay.tell.utr.error': 'UPI रेफरन्समध्ये 12 अंक असतात.',
  'pay.tell.opened.status': 'WhatsApp उघडले — {name} यांना पाठवा.',

  // A link that can't be shown.
  'pay.problem.invalid.title': 'ही पे लिंक चालत नाही',
  'pay.problem.invalid.body': 'कॉपी करताना लिंक कापली गेली असेल. ज्यांनी पाठवली त्यांना पुन्हा शेअर करायला सांगा.',
  'pay.problem.empty.title': 'येथे पे लिंक नाही',
  'pay.problem.empty.body': 'मित्राने शेअर केलेली लिंक उघडा — त्यात त्यांना पैसे देण्यासाठी सर्व माहिती आहे.',
  'pay.loading.status': 'पे लिंक उघडत आहे…',

  // The browser tab title and the link preview.
  'pay.meta.title': '{name} यांना पैसे द्या · {title} · {brand}',
  'pay.meta.title.empty': 'पे लिंक · {brand}',
  'pay.meta.description': 'तुमचा नेमका हिस्सा पाहा आणि कोणत्याही UPI ॲपने द्या. {brand} द्वारे पाठवले.',
} as const satisfies Messages
