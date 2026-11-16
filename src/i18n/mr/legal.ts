/** Marathi copy for privacy and terms (src/features/legal). The long policy text stays in English for now (see `legal.englishBody`). */
import type { Messages } from '../types'

export const legal = {
  'legal.back.label': 'मागे',
  'legal.home.label': '{brand} होम',
  // The date is formatted by code; <time> wraps it for screen readers.
  'legal.updated': 'शेवटचे अपडेट <time>{date}</time>',
  'legal.summary.title': 'थोडक्यात',
  'legal.englishBody': 'या धोरणाचा संपूर्ण मजकूर अजून इंग्रजीत आहे.',
  'legal.privacy.title': 'गोपनीयता धोरण',
  'legal.privacy.summary.1': 'बिलाचे फोटो आणि “फक्त सांगा” मधील मजकूर फक्त वाचण्यासाठी NVIDIA वर होस्ट केलेल्या AI मॉडेलला पाठवला जातो, आणि तो जतन केला जात नाही.',
  'legal.privacy.summary.2': 'पे लिंक तिची वाटणी लिंकच्या आतच नेते — तो भाग आमच्या सर्व्हरपर्यंत कधीच पोहोचत नाही.',
  'legal.privacy.summary.3': 'Pro पेमेंट Razorpay मार्फत होतात. तुमचे कार्ड तपशील किंवा UPI PIN आम्ही कधीच पाहत नाही.',
  'legal.privacy.section.leaves': 'तुमच्या फोनमधून काय बाहेर जाते, आणि का',
  'legal.privacy.section.cookies': 'कुकीज आणि ट्रॅकिंग',
  'legal.privacy.section.choices': 'तुमचे पर्याय',
  'legal.privacy.section.children': 'मुले',
  'legal.privacy.section.changes': 'बदल आणि संपर्क',
  'legal.terms.title': 'वापराच्या अटी',
  'legal.terms.description': '{brand} वापरण्याच्या अटी: खर्च वाटण्यासाठी एक मोफत साधन, सोबत ऐच्छिक एकवेळचे Pro पास.',
  'legal.terms.summary.0': '{brand} कोणाचे किती येणे-देणे आहे ते मोजते आणि नोंदवते. ते कधीही पैसे धरून ठेवत किंवा हलवत नाही — पेमेंट तुमच्या UPI ॲपमध्ये होतात.',
  'legal.terms.summary.1': 'पैसे देण्यापूर्वी किंवा कोणाला देण्यास सांगण्यापूर्वी रक्कम, नावे आणि AI चे निकाल तपासा.',
  'legal.terms.summary.2': 'Pro पास हे एकवेळचे पेमेंट आहेत. ते आपोआप नूतनीकरण होत नाहीत.',
  'legal.terms.section.using': '{brand} वापरणे',
  'legal.terms.section.money': 'पैसे आणि UPI',
  'legal.terms.section.ai': 'AI वैशिष्ट्ये',
  'legal.terms.section.pro': '{brand} Pro',
  'legal.terms.section.data': 'तुमचा डेटा',
  'legal.terms.section.service': 'सेवा',
  'legal.terms.section.changes': 'बदल आणि संपर्क',
} as const satisfies Messages
