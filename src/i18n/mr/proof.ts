/** Marathi copy for "Paid? Drop the screenshot" (payment screenshots). Keys: `proof.<screen>.<element>`. */
import type { Messages } from '../types'

export const proof = {
  // The screen (`/app/proof`) and its drop area.
  'proof.screen.title': 'पैसे आले? स्क्रीनशॉट टाका',
  'proof.screen.subtitle': 'GPay, PhonePe, Paytm किंवा तुमच्या बँक ॲपमधील पेमेंटचा स्क्रीनशॉट टाका. Settle तो तपासून कोणी पैसे दिले ते चिन्हांकित करेल.',
  'proof.drop.choose': 'स्क्रीनशॉट निवडा',
  'proof.drop.aria': 'पेमेंटचा स्क्रीनशॉट निवडा',
  'proof.drop.hint': 'JPG, PNG किंवा WebP. एकदाच वाचला जातो; काहीही जतन होत नाही.',
  'proof.reading.title': 'स्क्रीनशॉट वाचत आहे…',
  'proof.reading.cancel': 'रद्द करा',
  'proof.again': 'आणखी एक स्क्रीनशॉट टाका',
  // What goes wrong reading the screenshot.
  'proof.error.generic': 'स्क्रीनशॉट वाचता आला नाही. पुन्हा प्रयत्न करा, किंवा स्वतः व्यक्ती निवडा.',
  'proof.error.network': 'तुम्ही ऑफलाइन आहात. कनेक्ट करून पुन्हा प्रयत्न करा.',
  'proof.error.not_a_payment': 'हे UPI पेमेंटसारखे वाटत नाही. तुमच्या पेमेंट ॲपची यशस्वी स्क्रीन वापरा.',
  'proof.error.unsupported_image': 'कृपया JPG, PNG किंवा WebP स्क्रीनशॉट वापरा.',
  'proof.error.image_too_large': 'तो स्क्रीनशॉट खूप मोठा आहे. लहान स्क्रीनशॉट वापरा.',
  'proof.error.rate_limited': 'सध्या खूप स्क्रीनशॉट येत आहेत. काही मिनिटांनी पुन्हा प्रयत्न करा.',
  'proof.error.timeout': 'स्क्रीनशॉट वाचायला खूप वेळ लागला. पुन्हा प्रयत्न करा.',
  'proof.error.unreadable': 'तो स्क्रीनशॉट वाचता आला नाही. चांगल्या प्रकाशात संपूर्ण यशस्वी स्क्रीन वापरा.',
  'proof.error.not_configured': 'स्क्रीनशॉट वाचण्याची सुविधा सध्या उपलब्ध नाही.',
  // Refusals: the payment is not marked, and the screen says why.
  'proof.verdict.pending.title': 'हे पेमेंट अजून प्रलंबित आहे. ते दिले म्हणून चिन्हांकित केलेले नाही.',
  'proof.verdict.pending.body': 'ते “Paid” म्हटल्यावर पुन्हा स्क्रीनशॉट टाका.',
  'proof.verdict.failed.title': 'हे पेमेंट अयशस्वी झाले. ते दिले म्हणून चिन्हांकित केलेले नाही.',
  'proof.verdict.failed.body': 'काहीही दिले गेले नाही. त्यांना पुन्हा प्रयत्न करायला सांगा.',
  'proof.verdict.unreadable.title': 'हे पेमेंट यशस्वी झाले की नाही ते कळत नाही.',
  'proof.verdict.unreadable.body': 'यशस्वी झाल्याच्या स्क्रीनचा स्क्रीनशॉट टाका.',
  'proof.verdict.wrongPayee.title': 'हे पैसे तुम्हाला गेलेले नाहीत. ते दिले म्हणून चिन्हांकित केलेले नाही.',
  'proof.verdict.wrongPayee.body': 'ते {payee} यांना गेले आहेत.',
  'proof.verdict.payeeUnknown.title': 'हे पेमेंट कोणाला मिळाले ते दिसत नाही. ते दिले म्हणून चिन्हांकित केलेले नाही.',
  'proof.verdict.payeeUnknown.body': 'प्राप्तकर्त्याचे नाव किंवा UPI ID दिसणारा स्क्रीनशॉट टाका.',
  'proof.verdict.duplicate.title': 'हे पेमेंट आधीच नोंदवलेले आहे.',
  'proof.verdict.duplicate.body': 'UPI संदर्भ {utr} आधीच {name} यांच्याशी चिन्हांकित आहे.',
  'proof.verdict.duplicate.someone': 'तुमच्या यादीतील कोणीतरी',
  // A match: one person owes exactly this.
  'proof.match.title': '{name} यांचे {amount} दिले म्हणून चिन्हांकित करू?',
  'proof.match.ref': 'UPI संदर्भ {utr}',
  'proof.match.noRef': 'या स्क्रीनवर UPI संदर्भ नाही. हे बरोबर पेमेंट आहे ते तपासा.',
  'proof.match.confirm': 'दिले म्हणून चिन्हांकित करा',
  'proof.match.notThis': 'हे नाही',
  'proof.match.done': '{name} यांचे {amount} दिले म्हणून चिन्हांकित केले.',
  // Nothing matches exactly: the person picks.
  'proof.nomatch.title': 'हे कोणाशीही जुळले नाही.',
  'proof.nomatch.amount': 'स्क्रीनवर {amount} दिसत आहेत. त्यांपैकी कोणी पैसे दिले असतील तर ते निवडा.',
  'proof.nomatch.noAmount': 'स्क्रीनवर रक्कम दिसत नाही. त्यांपैकी कोणी पैसे दिले असतील तर ते निवडा.',
  'proof.nomatch.none': 'कोणाचेही नेमके {amount} बाकी नाही. मित्र विभागात रक्कम तपासा.',
  'proof.nomatch.pick': '{name} ({amount}) निवडा',
  // The shared-from-another-app note and the More sheet entry.
  'proof.shared.note': 'दुसऱ्या ॲपवरून शेअर केलेले',
  'proof.more.title': 'पैसे आले? स्क्रीनशॉट टाका',
  'proof.more.subtitle': 'स्क्रीनशॉटवरून UPI पेमेंट दिले म्हणून चिन्हांकित करा',
} as const satisfies Messages
