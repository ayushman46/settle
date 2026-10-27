/**
 * The note Bill check shows the restaurant's staff: please take these off, and why — polite, short
 * and in the language they read best (any of Settle's eight, whatever the app is set to). Plain data
 * rather than catalog messages, because the note is shown in a language the app may not have loaded.
 */
import type { LanguageCode } from '../../domain/types'
import { intlLocale } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { BillFinding } from './billCheck'

interface NoteText {
  hello: string
  /** `{list}`: what to take off, joined in the language. */
  ask: string
  service: string
  serviceGst: string
  /** A renamed charge or an abolished tax line, by its printed name. */
  named: string
  tip: string
  supply: string
  whyService: string
  whyTip: string
  whyOldTax: string
  whySupply: string
  thanks: string
}

const NOTES: Record<LanguageCode, NoteText> = {
  en: {
    hello: 'Hello!',
    ask: 'Could you please take {list} off our bill?',
    service: 'the service charge ({amount})',
    serviceGst: 'the GST worked out on it ({amount})',
    named: '“{label}” ({amount})',
    tip: 'the tip ({amount})',
    supply: 'the GST ({amount})',
    whyService:
      "Under the Central Consumer Protection Authority's guidelines of 4 July 2022, upheld by the Delhi High Court on 28 March 2025, a service charge is optional: it can't be added to the bill by default or under another name, or have GST added on it. If we'd like to tip, we'll add it ourselves.",
    whyTip: "We'd like to decide on the tip ourselves.",
    whyOldTax: 'Service tax and its cesses were replaced by GST in July 2017.',
    whySupply: "This is a bill of supply: a restaurant under the GST composition scheme pays its tax itself and can't add GST to the bill.",
    thanks: 'Thank you!',
  },
  hi: {
    hello: 'नमस्ते!',
    ask: 'कृपया हमारे बिल से {list} हटा दें।',
    service: 'सर्विस चार्ज ({amount})',
    serviceGst: 'उस पर लगा GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'टिप ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'केंद्रीय उपभोक्ता संरक्षण प्राधिकरण (CCPA) के 4 जुलाई 2022 के दिशानिर्देशों के अनुसार, जिन्हें दिल्ली हाई कोर्ट ने 28 मार्च 2025 को सही ठहराया, सर्विस चार्ज ऐच्छिक है: इसे बिल में अपने-आप, किसी और नाम से, या उस पर GST लगाकर नहीं जोड़ा जा सकता। टिप देनी होगी तो हम अपनी मर्ज़ी से देंगे।',
    whyTip: 'टिप हम खुद तय करेंगे।',
    whyOldTax: 'सर्विस टैक्स और उसके सेस जुलाई 2017 से GST में बदल चुके हैं।',
    whySupply: 'यह बिल ऑफ़ सप्लाई है: GST कंपोज़िशन स्कीम वाला रेस्टोरेंट अपना टैक्स खुद भरता है और बिल में GST नहीं जोड़ सकता।',
    thanks: 'धन्यवाद!',
  },
  bn: {
    hello: 'নমস্কার!',
    ask: 'অনুগ্রহ করে আমাদের বিল থেকে {list} বাদ দিন।',
    service: 'সার্ভিস চার্জ ({amount})',
    serviceGst: 'তার উপর ধরা GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'টিপ ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'কেন্দ্রীয় ক্রেতা সুরক্ষা কর্তৃপক্ষের (CCPA) 4 জুলাই 2022-এর নির্দেশিকা অনুযায়ী, যা দিল্লি হাইকোর্ট 28 মার্চ 2025-এ বহাল রেখেছে, সার্ভিস চার্জ ঐচ্ছিক: এটি বিলে নিজে থেকে, অন্য নামে, বা তার উপর GST বসিয়ে যোগ করা যায় না। টিপ দিতে চাইলে আমরা নিজেরাই দেব।',
    whyTip: 'টিপ আমরা নিজেরাই ঠিক করব।',
    whyOldTax: 'সার্ভিস ট্যাক্স ও তার সেস জুলাই 2017 থেকে GST-তে বদলে গেছে।',
    whySupply: 'এটি বিল অফ সাপ্লাই: GST কম্পোজিশন স্কিমের রেস্তোরাঁ নিজের কর নিজেই দেয় এবং বিলে GST যোগ করতে পারে না।',
    thanks: 'ধন্যবাদ!',
  },
  mr: {
    hello: 'नमस्कार!',
    ask: 'कृपया आमच्या बिलातून {list} काढून टाका.',
    service: 'सर्व्हिस चार्ज ({amount})',
    serviceGst: 'त्यावर लावलेला GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'टिप ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'केंद्रीय ग्राहक संरक्षण प्राधिकरणाच्या (CCPA) 4 जुलै 2022 च्या मार्गदर्शक तत्त्वांनुसार, ज्यांना दिल्ली उच्च न्यायालयाने 28 मार्च 2025 रोजी वैध ठरवले, सर्व्हिस चार्ज ऐच्छिक आहे: तो बिलात आपोआप, दुसऱ्या नावाने किंवा त्यावर GST लावून जोडता येत नाही. टिप द्यायची असल्यास आम्ही स्वतः देऊ.',
    whyTip: 'टिप आम्ही स्वतः ठरवू.',
    whyOldTax: 'सर्व्हिस टॅक्स आणि त्यावरचे सेस जुलै 2017 पासून GST मध्ये बदलले आहेत.',
    whySupply: 'हे बिल ऑफ सप्लाय आहे: GST कंपोझिशन योजनेतील रेस्टॉरंट आपला कर स्वतः भरते आणि बिलात GST जोडू शकत नाही.',
    thanks: 'धन्यवाद!',
  },
  ta: {
    hello: 'வணக்கம்!',
    ask: 'தயவுசெய்து எங்கள் பில்லிலிருந்து இவற்றை நீக்குங்கள்: {list}.',
    service: 'சர்வீஸ் சார்ஜ் ({amount})',
    serviceGst: 'அதன் மீது போட்ட GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'டிப் ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'மத்திய நுகர்வோர் பாதுகாப்பு ஆணையத்தின் (CCPA) 4 ஜூலை 2022 வழிகாட்டுதல்களின்படி — இவற்றை டெல்லி உயர் நீதிமன்றம் 28 மார்ச் 2025 அன்று உறுதி செய்தது — சர்வீஸ் சார்ஜ் கட்டாயமில்லை: அதைத் தானாகவோ, வேறு பெயரிலோ, அதன் மீது GST சேர்த்தோ பில்லில் சேர்க்கக் கூடாது. டிப் தர விரும்பினால் நாங்களே தருவோம்.',
    whyTip: 'டிப்பை நாங்களே முடிவு செய்வோம்.',
    whyOldTax: 'சர்வீஸ் டேக்ஸ் மற்றும் அதன் செஸ்கள் ஜூலை 2017 முதல் GST-ஆக மாறிவிட்டன.',
    whySupply: 'இது பில் ஆஃப் சப்ளை: GST காம்போசிஷன் திட்டத்தில் உள்ள உணவகம் தன் வரியைத் தானே செலுத்தும்; பில்லில் GST சேர்க்க முடியாது.',
    thanks: 'நன்றி!',
  },
  te: {
    hello: 'నమస్తే!',
    ask: 'దయచేసి మా బిల్లు నుంచి ఇవి తీసేయండి: {list}.',
    service: 'సర్వీస్ ఛార్జ్ ({amount})',
    serviceGst: 'దానిపై వేసిన GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'టిప్ ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'కేంద్ర వినియోగదారుల రక్షణ అథారిటీ (CCPA) 4 జూలై 2022 మార్గదర్శకాల ప్రకారం — వీటిని ఢిల్లీ హైకోర్టు 28 మార్చి 2025న సమర్థించింది — సర్వీస్ ఛార్జ్ ఐచ్ఛికం: దాన్ని బిల్లులో ఆటోమేటిక్‌గా, వేరే పేరుతో, లేదా దానిపై GST వేసి కలపకూడదు. టిప్ ఇవ్వాలనుకుంటే మేమే ఇస్తాం.',
    whyTip: 'టిప్ మేమే నిర్ణయించుకుంటాం.',
    whyOldTax: 'సర్వీస్ ట్యాక్స్, దాని సెస్‌లు జూలై 2017 నుంచి GSTగా మారిపోయాయి.',
    whySupply: 'ఇది బిల్ ఆఫ్ సప్లై: GST కంపోజిషన్ పథకంలో ఉన్న రెస్టారెంట్ తన పన్ను తానే కడుతుంది, బిల్లులో GST కలపకూడదు.',
    thanks: 'ధన్యవాదాలు!',
  },
  kn: {
    hello: 'ನಮಸ್ಕಾರ!',
    ask: 'ದಯವಿಟ್ಟು ನಮ್ಮ ಬಿಲ್‌ನಿಂದ ಇವನ್ನು ತೆಗೆದುಹಾಕಿ: {list}.',
    service: 'ಸರ್ವಿಸ್ ಚಾರ್ಜ್ ({amount})',
    serviceGst: 'ಅದರ ಮೇಲೆ ಹಾಕಿದ GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'ಟಿಪ್ ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'ಕೇಂದ್ರ ಗ್ರಾಹಕ ಸಂರಕ್ಷಣಾ ಪ್ರಾಧಿಕಾರದ (CCPA) 4 ಜುಲೈ 2022ರ ಮಾರ್ಗಸೂಚಿಗಳ ಪ್ರಕಾರ — ಇವನ್ನು ದೆಹಲಿ ಹೈಕೋರ್ಟ್ 28 ಮಾರ್ಚ್ 2025ರಂದು ಎತ್ತಿಹಿಡಿದಿದೆ — ಸರ್ವಿಸ್ ಚಾರ್ಜ್ ಐಚ್ಛಿಕ: ಅದನ್ನು ಬಿಲ್‌ಗೆ ತಾನಾಗಿ, ಬೇರೆ ಹೆಸರಿನಲ್ಲಿ ಅಥವಾ ಅದರ ಮೇಲೆ GST ಹಾಕಿ ಸೇರಿಸುವಂತಿಲ್ಲ. ಟಿಪ್ ಕೊಡಬೇಕೆಂದರೆ ನಾವೇ ಕೊಡುತ್ತೇವೆ.',
    whyTip: 'ಟಿಪ್ ಅನ್ನು ನಾವೇ ನಿರ್ಧರಿಸುತ್ತೇವೆ.',
    whyOldTax: 'ಸರ್ವಿಸ್ ಟ್ಯಾಕ್ಸ್ ಮತ್ತು ಅದರ ಸೆಸ್‌ಗಳು ಜುಲೈ 2017ರಿಂದ GST ಆಗಿ ಬದಲಾಗಿವೆ.',
    whySupply: 'ಇದು ಬಿಲ್ ಆಫ್ ಸಪ್ಲೈ: GST ಕಾಂಪೊಸಿಷನ್ ಯೋಜನೆಯ ರೆಸ್ಟೋರೆಂಟ್ ತನ್ನ ತೆರಿಗೆಯನ್ನು ತಾನೇ ಕಟ್ಟುತ್ತದೆ, ಬಿಲ್‌ಗೆ GST ಸೇರಿಸುವಂತಿಲ್ಲ.',
    thanks: 'ಧನ್ಯವಾದಗಳು!',
  },
  gu: {
    hello: 'નમસ્તે!',
    ask: 'કૃપા કરીને અમારા બિલમાંથી {list} કાઢી નાખો.',
    service: 'સર્વિસ ચાર્જ ({amount})',
    serviceGst: 'તેના પર લાગેલો GST ({amount})',
    named: '“{label}” ({amount})',
    tip: 'ટિપ ({amount})',
    supply: 'GST ({amount})',
    whyService:
      'કેન્દ્રીય ગ્રાહક સુરક્ષા સત્તામંડળ (CCPA)ની 4 જુલાઈ 2022ની માર્ગદર્શિકા મુજબ, જેને દિલ્હી હાઈકોર્ટે 28 માર્ચ 2025ના રોજ માન્ય રાખી છે, સર્વિસ ચાર્જ વૈકલ્પિક છે: તેને બિલમાં આપમેળે, બીજા નામે, કે તેના પર GST લગાવીને ઉમેરી શકાય નહીં. ટિપ આપવી હશે તો અમે જાતે આપીશું.',
    whyTip: 'ટિપ અમે જાતે નક્કી કરીશું.',
    whyOldTax: 'સર્વિસ ટેક્સ અને તેના સેસ જુલાઈ 2017થી GSTમાં બદલાઈ ગયા છે.',
    whySupply: 'આ બિલ ઑફ સપ્લાય છે: GST કમ્પોઝિશન યોજનાવાળી રેસ્ટોરન્ટ પોતાનો ટેક્સ જાતે ભરે છે અને બિલમાં GST ઉમેરી શકતી નથી.',
    thanks: 'આભાર!',
  },
}

/** Where the rules come from, under the note (the same in every language: it's a citation). */
export const NOTE_SOURCES = 'CCPA Guidelines on Service Charge, 4 Jul 2022, para 7 · NRAI v. Union of India, Delhi HC, 28 Mar 2025'

const fill = (template: string, vars: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match)

/** "A, B and C" in the language (plain commas where the browser can't). */
function joinList(items: readonly string[], lang: LanguageCode): string {
  try {
    return new Intl.ListFormat(intlLocale(lang), { type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/** True when the note has something to ask for: a finding with money the restaurant can take off. */
export function hasNote(findings: readonly BillFinding[]): boolean {
  return findings.some((f) => f.saving > 0)
}

/**
 * The note for `findings` (those with a saving) in `lang`: a greeting with what to take off, why,
 * and thanks — one paragraph each. Empty when there's nothing to ask for.
 */
export function staffNote(findings: readonly BillFinding[], lang: LanguageCode, currency = 'INR'): string[] {
  const text = NOTES[lang] ?? NOTES.en
  const money = (minor: number) => formatMoney(minor, currency, { trimZeros: true })
  const asks: string[] = []
  const why = new Set<string>()
  let serviceLike = false
  for (const f of findings) {
    if (f.saving <= 0) continue
    if (f.kind === 'service_charge') {
      asks.push(fill(text.service, { amount: money(f.amount) }))
      if (f.gst > 0) asks.push(fill(text.serviceGst, { amount: money(f.gst) }))
      serviceLike = true
    } else if (f.kind === 'renamed_charge') {
      asks.push(fill(text.named, { label: f.label, amount: money(f.amount + f.gst) }))
      serviceLike = true
    } else if (f.kind === 'printed_tip') {
      asks.push(fill(text.tip, { amount: money(f.amount) }))
      why.add('tip')
    } else if (f.kind === 'old_tax') {
      asks.push(fill(text.named, { label: f.label, amount: money(f.amount) }))
      why.add('oldTax')
    } else if (f.kind === 'supply_gst') {
      asks.push(fill(text.supply, { amount: money(f.amount) }))
      why.add('supply')
    }
  }
  if (asks.length === 0) return []
  const reasons: string[] = []
  if (serviceLike) reasons.push(text.whyService)
  // The service-charge reason already says the table will tip themselves.
  else if (why.has('tip')) reasons.push(text.whyTip)
  if (why.has('oldTax')) reasons.push(text.whyOldTax)
  if (why.has('supply')) reasons.push(text.whySupply)
  return [`${text.hello} ${fill(text.ask, { list: joinList(asks, lang) })}`, ...reasons, text.thanks]
}
