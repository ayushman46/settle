/**
 * Plain-text checks on what the user typed for "Just say it". The model drafts the split;
 * these decide what it is allowed to claim. Live probes showed the model inventing a currency
 * ("USD") when none was typed and a payer ("Sam") when nobody said who paid — so a currency
 * comes only from the text itself, and a payer only when the text talks about paying.
 */

/** Lower-case, accents and punctuation off, single spaces: "Zoë's  CAFÉ!" → "zoes cafe". */
export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/* ------------------------------------------------------------------ currency */

const DOLLAR_CURRENCIES: ReadonlySet<string> = new Set(['USD', 'SGD', 'AUD', 'CAD', 'NZD', 'HKD'])
const RUPEE_CURRENCIES: ReadonlySet<string> = new Set(['INR', 'PKR', 'LKR', 'NPR'])

/** Codes we accept in any case, as a whole word ("840 inr"). Ones that are also English words (TRY, ALL, CUP…) are left out. */
const ISO_CODES =
  /\b(INR|USD|EUR|GBP|AED|SGD|AUD|CAD|NZD|HKD|JPY|CNY|THB|MYR|IDR|CHF|LKR|NPR|BDT|PKR|SAR|QAR|KWD|OMR|BHD|ZAR|KRW|VND|SEK|DKK|PLN|BRL|MXN)\b/i

type CurrencyRule = readonly [pattern: RegExp, code: (hint: string | null) => string]
const fixed = (code: string) => () => code
const rupee = (hint: string | null) => (hint !== null && RUPEE_CURRENCIES.has(hint) ? hint : 'INR')
const dollar = (hint: string | null) => (hint !== null && DOLLAR_CURRENCIES.has(hint) ? hint : 'USD')

/* ------------------------------------------------------------------ Indian languages */

// `\b` only knows ASCII letters: Indic words get their own edges (space, punctuation, the danda).
const B = String.raw`(?<=^|[\s,.!?।])`
const E = String.raw`(?=$|[\s,.!?।])`

/** One regex for whole Indic words or phrases (NFC, so composed and decomposed letters match alike). */
function indic(alternatives: readonly string[], flags = 'u'): RegExp {
  return new RegExp(`${B}(?:${alternatives.map((a) => a.normalize('NFC')).join('|')})${E}`, flags)
}

/** Any Devanagari … Sinhala letter: the text is (partly) in an Indian script. */
const INDIC_LETTER = /[\u0900-\u0DFF]/u

/** "मैंने दिया", "मी दिले", "આમિ দিয়েছি"…: the speaker paid. */
const SPEAKER_PAYS_INDIC = indic([
  'मैंने',
  'मैने',
  'मी (?:दिले|भरले)',
  'મેં (?:આપ્યા|ચૂકવ્યા)',
  'আমি (?:দিয়েছি|দিলাম)',
  'நான் (?:கொடுத்தேன்|கட்டினேன்|செலுத்தினேன்)',
  'నేను (?:కట్టాను|ఇచ్చాను)',
  'ನಾನು (?:ಕೊಟ್ಟೆ|ಪಾವತಿಸಿದೆ)',
])

/** Someone (named) paid: "रिया ने दिया", "সৌরভ দিয়েছে", "கபீர் கொடுத்தார்"… */
const SOMEONE_PAYS_INDIC = indic([
  'ने (?:दिया|दिए|भरा|पे किया|पेमेंट किया)',
  'ने (?:दिले|भरले)',
  'એ (?:આપ્યા|ચૂકવ્યા)',
  '(?:দিয়েছে|দিল|দিয়েছেন)',
  '(?:கொடுத்தார்|கொடுத்தான்|கொடுத்தாள்|கட்டினார்)',
  '(?:కట్టాడు|కట్టింది|ఇచ్చాడు|ఇచ్చింది)',
  '(?:ಕೊಟ್ಟರು|ಕೊಟ್ಟ|ಕೊಟ್ಟಳು|ಪಾವತಿಸಿದರು)',
])

/** I, my, we… in Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada. */
const FIRST_PERSON_INDIC = indic([
  'मैं', 'मेरा', 'मेरी', 'मेरे', 'मुझे', 'हम', 'हमने', 'हमारा', 'हमारे',
  'मी', 'माझा', 'माझी', 'माझे', 'आम्ही', 'आपण',
  'હું', 'મારું', 'મારી', 'મેં', 'અમે', 'આપણે',
  'আমি', 'আমার', 'আমরা',
  'நான்', 'என்', 'நாம்', 'நாங்கள்',
  'నేను', 'నా', 'మేము', 'మనం',
  'ನಾನು', 'ನನ್ನ', 'ನಾವು',
])

/** "without me" and friends. */
const SPEAKER_OUT_INDIC = indic(['मेरे बिना', 'मुझे छोड़कर', 'मैं नहीं', 'माझ्याशिवाय', 'મારા વગર', 'আমাকে ছাড়া', 'என்னைத் தவிர', 'నన్ను తప్ప', 'ನನ್ನನ್ನು ಬಿಟ್ಟು'])

const DAY_BEFORE_YESTERDAY_INDIC = indic(['परसों', 'parson'], 'iu')
// Describe is only ever about money already spent, so "कल" (yesterday / tomorrow) is yesterday.
const YESTERDAY_INDIC = indic(['कल', 'गतकाल', 'গতকাল', 'काल', 'ગઈકાલે', 'நேற்று', 'నిన్న', 'ನಿನ್ನೆ'])
const TODAY_INDIC = indic(['आज', 'আজ', 'આજે', 'இன்று', 'ఈరోజు', 'ಇಂದು'])

/** When several match, the earliest in the text wins — so "US$ 5" is USD, not a bare "$". */
const CURRENCY_RULES: readonly CurrencyRule[] = [
  [/US\$/i, fixed('USD')],
  [/HK\$/i, fixed('HKD')],
  [/NZ\$/i, fixed('NZD')],
  [/\bS\$/, fixed('SGD')],
  [/\bAU?\$/, fixed('AUD')],
  [/\bCA?\$/, fixed('CAD')],
  [/\bR\$/, fixed('BRL')],
  [/₹/, fixed('INR')],
  [/₨|\brs(?:\b|\.|(?=\d))|\b(?:rupees?|rupaye|rupay|rupiya|rupye)\b/i, rupee],
  [new RegExp(`(?:रुपये|रुपए|रुपया|रु\\.?(?=\\s?\\d)|রুপি|ரூபாய்|రూపాయలు|ರೂಪಾಯಿ|રૂપિયા)`.normalize('NFC'), 'u'), fixed('INR')],
  // Bengali speakers in India say টাকা for rupees; in Bangladesh it's the taka.
  [new RegExp('টাকা'.normalize('NFC'), 'u'), (hint) => (hint === 'BDT' ? 'BDT' : 'INR')],
  [/€|\beuros?\b/i, fixed('EUR')],
  [/£|\bquid\b|\d\s*pounds?\b|\bpounds?\s*\d/i, fixed('GBP')],
  [/¥/, (hint) => (hint === 'CNY' ? 'CNY' : 'JPY')],
  [/\byen\b/i, fixed('JPY')],
  [/元|\byuan\b|\brmb\b/i, fixed('CNY')],
  [/฿|\bbaht\b/i, fixed('THB')],
  [/\bRM\s?\d/, fixed('MYR')],
  [/\bringgit\b/i, fixed('MYR')],
  [/\bRp\.?\s?\d/, fixed('IDR')],
  [/\brupiah\b/i, fixed('IDR')],
  [/₩/, fixed('KRW')],
  [/₱/, fixed('PHP')],
  [/₫/, fixed('VND')],
  [/₺/, fixed('TRY')],
  [/₪/, fixed('ILS')],
  [/₦/, fixed('NGN')],
  [/৳/, fixed('BDT')],
  [/zł/i, fixed('PLN')],
  [/د\.إ|\bdirhams?\b|\bdhs?\s?\d/i, fixed('AED')],
  [/\$|\bdollars?\b/i, dollar],
  // "500 bucks" means the local money: the user's own currency when we know it.
  [/\bbucks\b/i, (hint) => hint ?? 'USD'],
]

/**
 * The currency the text itself names, or null. `hint` (the user's usual currency) only says
 * which dollar a "$" is, or which rupee "Rs" is — it is never assumed when the text names none.
 */
export function detectCurrency(raw: string, hint: string | null): string | null {
  const text = raw.normalize('NFC')
  let bestIndex = Number.POSITIVE_INFINITY
  let best: string | null = null
  const consider = (index: number, code: string) => {
    if (index < bestIndex) {
      bestIndex = index
      best = code
    }
  }
  for (const [pattern, code] of CURRENCY_RULES) {
    const match = pattern.exec(text)
    if (match) consider(match.index, code(hint))
  }
  const iso = ISO_CODES.exec(text)
  if (iso?.[1]) consider(iso.index, iso[1].toUpperCase())
  return best
}

/* ------------------------------------------------------------------ amounts */

const NUMBER_WORDS = /\b(?:hundred|thousand|lakhs?|lacs?|crores?|grand|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)\b/i

/** Whether the text gives a number at all ("840", "2.4k", "five hundred"); without one, any amount is invented. */
export function hasAmountCue(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text)
}

/* ------------------------------------------------------------------ who paid */

/** "pays double", "paying 40%", "pays for two": how much someone owes, not who paid. */
const SHARE_PHRASE =
  /\bpay(?:s|ing)?\s+(?:double|twice|triple|thrice|half|extra|more|less|nothing|equally|evenly|\d+(?:\.\d+)?\s*(?:x|times|%|percent)|(?:an?\s+)?(?:extra|bigger|smaller|larger|equal|double)\s+(?:share|part|portion|amount)|for\s+(?:two|three|four|five|six|\d+)\b)/gi

const PAYER_CUES: readonly RegExp[] = [
  /\bpaid\b/i,
  /\bpaying\b/i,
  /\bpays?\s+(?:for|the|it|this|that|everything|all|upfront|up\s+front)\b/i,
  /\b(?:covered|covering|covers)\b/i,
  /\bpick(?:ed|s|ing)?\s+(?:it\s+|this\s+)?up\b/i,
  /\btreat(?:ed|ing|s)?\b/i,
  /\bon\s+(?:me|him|her|them|us)\b/i,
  /\bgot\s+(?:it|this|the\s+(?:bill|tab|check|cheque))\b/i,
  /\b(?:fronted|footed|bought|booked|swiped|spent|chipped\s+in|settled\s+the)\b/i,
  /\b(?:i'll|i\s+will)\s+pay\b/i,
  /\b(?:my|his|her|their|\p{L}+['’]s)\s+(?:card|account|upi|gpay|phonepe|paytm|credit\s+card|debit\s+card)\b/iu,
  // Hinglish: "maine diya", "Riya ne pay kiya"
  /\b(?:maine|mainne|mene|meine)\b/i,
  /\bne\s+(?:pay\s+kiya|diya|diye|bhara|bhare|kiya)\b/i,
]

/** Whether the text says who paid at all. Without that, a payer from the model is a guess. */
export function mentionsPayer(text: string): boolean {
  const withoutShares = text.replace(SHARE_PHRASE, ' ')
  if (PAYER_CUES.some((cue) => cue.test(withoutShares))) return true
  const nfc = withoutShares.normalize('NFC')
  return SPEAKER_PAYS_INDIC.test(nfc) || SOMEONE_PAYS_INDIC.test(nfc)
}

const PAID_VERB = String.raw`(?:has\s+|had\s+|just\s+|already\s+)?(?:paid|covered|picked\s+(?:it\s+|this\s+)?up|treated(?:\s+us)?|bought|booked|fronted|footed|is\s+paying|was\s+paying|will\s+pay|got\s+(?:it|this|the\s+(?:bill|tab|check|cheque)))\b`
/** "I paid", "paid by me", "on me", "my treat", a message that starts with "paid …" (no one else to have paid). */
const SPEAKER_PAYS = new RegExp(
  String.raw`\b(?:i|we)\s+${PAID_VERB}|^\s*(?:just\s+|already\s+)?(?:paid|spent|covered|bought|booked)\b|\b(?:paid|covered|bought|booked|picked\s+up)\s+by\s+me\b|\bon\s+me\b|\bmy\s+treat\b|\b(?:i'll|i\s+will)\s+pay\b|\b(?:maine|mainne|mene|meine)\b`,
  'i',
)
/** "Kabir covered it", "paid by Riya", "Riya's treat", "Riya ne pay kiya" → the name. */
const SOMEONE_PAYS: readonly RegExp[] = [
  new RegExp(String.raw`(\p{L}[\p{L}.'-]*)\s+${PAID_VERB}`, 'giu'),
  /\b(?:paid|covered|bought|booked|picked\s+up)\s+by\s+(\p{L}[\p{L}.'-]*)/giu,
  /(\p{L}[\p{L}.-]*)['’]s\s+treat\b/giu,
  /(\p{L}[\p{L}.-]*)\s+ne\s+(?:pay\s+kiya|diya|diye|bhara|bhare|kiya)\b/giu,
]

/**
 * Who paid, read straight from the text, when it says so plainly: "Me" for the speaker, or
 * the name of someone in `people` (matched like `textMentions`). Null when the text doesn't
 * say, or names someone who isn't sharing — the model's reading is used then.
 */
export function payerFromText(text: string, people: readonly string[]): string | null {
  const withoutShares = text.replace(SHARE_PHRASE, ' ')
  for (const pattern of SOMEONE_PAYS) {
    for (const match of withoutShares.matchAll(pattern)) {
      const word = match[1] ?? ''
      if (isSpeakerName(word)) return 'Me'
      const person = people.find((name) => name !== 'Me' && wordsMention(fold(word), name))
      if (person !== undefined) return person
    }
  }
  return SPEAKER_PAYS.test(withoutShares) || SPEAKER_PAYS_INDIC.test(withoutShares.normalize('NFC')) ? 'Me' : null
}

/* ------------------------------------------------------------------ the speaker ("Me") */

const SPEAKER_WORDS: ReadonlySet<string> = new Set(['me', 'i', 'my', 'mine', 'myself', 'self', 'im', 'ive', 'mera', 'meri', 'mere', 'maine', 'mujhe', 'speaker'])
const GROUP_WORDS: ReadonlySet<string> = new Set(['we', 'us', 'our', 'ours', 'ourselves', 'hum', 'humne', 'hamara'])
/** Words a model may put in `people` that aren't anybody in particular. */
const NOBODY_WORDS: ReadonlySet<string> = new Set([
  'everyone', 'everybody', 'all', 'all of us', 'others', 'the others', 'rest', 'the rest', 'friends', 'friend', 'group', 'the group',
  'team', 'people', 'person', 'someone', 'somebody', 'guys', 'you', 'they', 'them', 'he', 'she', 'him', 'her', 'unknown', 'other',
  'n a', 'na', 'none', 'nobody', 'null',
])

/** "me", "I", "Myself", "we", "me (you)" → the speaker. */
export function isSpeakerName(name: string): boolean {
  const key = fold(name.replace(/\(.*\)/g, ' '))
  return SPEAKER_WORDS.has(key) || GROUP_WORDS.has(key)
}

/** "everyone", "the rest", "they", "Person 2" — not someone to add. */
export function isNobody(name: string): boolean {
  const key = fold(name)
  return key === '' || NOBODY_WORDS.has(key) || /^(?:person|friend|member|guest|people|participant)\s*\d*$/.test(key) || /^\d+$/.test(key)
}

/** The speaker paying ("I paid", "on me", "my treat") isn't the speaker sharing the cost. */
const SPEAKER_PAID =
  /\b(?:i\s+(?:have\s+|had\s+|just\s+|already\s+)?(?:paid|covered|got\s+(?:it|this|the\s+\w+)|picked\s+(?:it\s+|this\s+)?up|bought|booked|fronted|spent|treated(?:\s+\w+)?)|(?:paid|covered|bought|booked|picked\s+up)\s+by\s+me|on\s+me|my\s+treat|(?:i'll|i\s+will)\s+pay(?:\s+for)?|(?:on|with|via|using|from|by)\s+my\s+(?:card|account|upi|gpay|phonepe|paytm)|maine\s+\p{L}+(?:\s+kiya)?)/giu

const FIRST_PERSON =
  /\b(?:i|i'm|im|i've|ive|i'll|i'd|me|my|mine|myself|we|we're|we've|we'll|us|our|ours|ourselves|mera|meri|mere|mujhe|hum|humne|hamara|hamare)\b/i
/** "with Riya" — but not "with card" / "with cash". */
const WITH_SOMEONE = /\b(?:with|w\/)\s+(?!(?:my\s+|his\s+|her\s+|a\s+|the\s+)?(?:card|cash|upi|gpay|phonepe|paytm|coupon|discount|offer|tax|gst|tip|service)\b)\p{L}/iu
const SPEAKER_OUT =
  /\b(?:not\s+(?:me|myself|including\s+me|for\s+me|counting\s+me)|except\s+(?:me|myself)|excluding\s+(?:me|myself)|without\s+(?:me|myself)|leave\s+me\s+out|i'?m\s+(?:not\s+in|out)|i\s+am\s+(?:not\s+in|out)|i\s+(?:didn'?t|did\s+not)\s+(?:eat|have|go|come|join)|only\s+for\s+(?!me\b)\p{L}+|for\s+(?:\p{L}+(?:\s*,\s*|\s+and\s+|\s*&\s*|\s+)){0,4}\p{L}+\s+only)\b/iu

/** Whether the text says the speaker is NOT sharing the cost ("except me", "for Riya and Sam only"). */
export function excludesSpeaker(text: string): boolean {
  return SPEAKER_OUT.test(text) || SPEAKER_OUT_INDIC.test(text.normalize('NFC'))
}

/**
 * Whether the speaker shares the cost: they speak in the first person ("me 40%", "we", "my
 * share") or split "with" someone — not counting how they paid ("I paid for Riya's ticket"
 * says nothing about the speaker's own share), and never when they say they're out.
 */
export function speakerTakesPart(text: string): boolean {
  if (excludesSpeaker(text)) return false
  const withoutPaying = text.replace(SPEAKER_PAID, ' ')
  // Spoken (and typed) Indian-language sentences almost always include the speaker.
  return FIRST_PERSON.test(withoutPaying) || WITH_SOMEONE.test(withoutPaying) || INDIC_LETTER.test(text)
}

/** Whether the text speaks in the first person at all (a payer of "Me" needs that). */
export function speaksInFirstPerson(text: string): boolean {
  if (FIRST_PERSON.test(text) || /\b(?:maine|mainne|mene|meine)\b/i.test(text)) return true
  const nfc = text.normalize('NFC')
  return FIRST_PERSON_INDIC.test(nfc) || SPEAKER_PAYS_INDIC.test(nfc)
}

/* ------------------------------------------------------------------ names */

/**
 * The caller's own spelling of `name`, when it means one of `known`: the same name ignoring
 * case and accents, or a unique first name ("riya" → "Riya Sharma" when there is one Riya).
 */
export function matchKnownName(name: string, known: readonly string[]): string | null {
  const key = fold(name)
  if (key === '') return null
  const exact = known.find((candidate) => fold(candidate) === key)
  if (exact !== undefined) return exact
  if (key.includes(' ')) return null
  const byFirstName = known.filter((candidate) => fold(candidate).split(' ')[0] === key)
  return byFirstName.length === 1 ? (byFirstName[0] ?? null) : null
}

/** Whether `a` becomes `b` with at most one letter added, removed or changed ("ria" ↔ "riya"). */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * Whether the text mentions this person: their name or first name, a short form ("Adi" for
 * "Aditya") or a one-letter spelling variant ("Ria" for "Riya"). Text in a non-Latin script gets
 * the benefit of the doubt (the model may have transliterated). A person the text never
 * mentions was made up.
 */
export function textMentions(text: string, name: string): boolean {
  const foldedText = fold(text)
  if (/[^\p{Script=Latin}\p{N}\s]/u.test(foldedText)) return fold(name) !== ''
  return wordsMention(foldedText, name)
}

/** `textMentions` without the benefit of the doubt: the folded words must really name the person. */
function wordsMention(foldedText: string, name: string): boolean {
  const folded = fold(name)
  if (folded === '' || foldedText === '') return false
  if (` ${foldedText} `.includes(` ${folded} `)) return true
  const first = folded.split(' ')[0] ?? ''
  for (const word of new Set(foldedText.split(' '))) {
    if (word === first) return true
    if (word.length < 3 || first.length < 3 || /\d/.test(word)) continue
    if (first.startsWith(word) || word.startsWith(first) || (first.length >= 4 && withinOneEdit(word, first))) return true
  }
  return false
}

/* ------------------------------------------------------------------ dates */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
/** Full names anywhere ("friday"); short ones only after on/last/this ("on sat" — "we sat down" isn't a day). */
const WEEKDAY_FULL = /\b(last\s+|this\s+|on\s+|past\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
const WEEKDAY_SHORT = /\b(last\s+|this\s+|on\s+|past\s+)(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/i
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?`
const DAY_MONTH = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?${MONTH}(?:\s*,?\s*(\d{4})\b)?`, 'i')
const MONTH_DAY = new RegExp(String.raw`\b${MONTH}\s*(\d{1,2})(?:st|nd|rd|th)?\b(?:\s*,?\s*(\d{4})\b)?`, 'i')
/** "18/10/2026", or "on 18/10" — a bare "1/2" is more likely a fraction than a date. */
const NUMERIC = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b|\b(?:on|dated?)\s+(\d{1,2})[/-](\d{1,2})\b/i
const DAYS_AGO = /\b(\d{1,2}|a|one|two|three|four|five|six|seven)\s+days?\s+ago\b/i
const WORD_NUMBERS: Readonly<Record<string, number>> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }

function parseIso(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return toIso(value) === date ? value : null
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  return parseIso(value) !== null
}

/** Whole days from `a` to `b` (both YYYY-MM-DD); NaN when either isn't a date. */
export function daysBetween(a: string, b: string): number {
  const from = parseIso(a)
  const to = parseIso(b)
  return from && to ? Math.round((to.getTime() - from.getTime()) / 86_400_000) : Number.NaN
}

/** A day and month without a year: this year's, or last year's when that would be in the future. */
function pastDayMonth(day: number, month: number, year: number | null, today: Date): Date | null {
  const make = (y: number) => {
    const candidate = new Date(Date.UTC(y, month - 1, day))
    return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day ? candidate : null
  }
  if (year !== null) return make(year)
  const thisYear = make(today.getUTCFullYear())
  if (thisYear === null) return make(today.getUTCFullYear() - 1)
  return thisYear.getTime() > today.getTime() ? make(today.getUTCFullYear() - 1) : thisYear
}

/**
 * The day the text names, worked out from `today` (YYYY-MM-DD): "today", "yesterday", "day
 * before yesterday", "last night", "3 days ago", weekdays (the most recent one, today
 * included unless it says "last"), "18 Oct", "Oct 18", "18/10/2026", "on 18/10" (day first).
 * @returns the date; null when the text names a day we can't pin down or one in the future;
 *   undefined when the text names no day at all.
 */
export function resolveDate(text: string, today: string): string | null | undefined {
  const now = parseIso(today)
  if (now === null) return undefined
  const lower = text.toLowerCase()

  const nfc = lower.normalize('NFC')
  if (/\bday\s+before\s+yesterday\b/.test(lower) || DAY_BEFORE_YESTERDAY_INDIC.test(nfc)) return toIso(addDays(now, -2))
  if (/\byesterday\b|\blast\s+night\b|\bkal\s+raat\b/.test(lower) || YESTERDAY_INDIC.test(nfc)) return toIso(addDays(now, -1))
  if (/\b(?:today|tonight|this\s+(?:morning|afternoon|evening))\b|\baaj\b/.test(lower) || TODAY_INDIC.test(nfc)) return today
  const ago = DAYS_AGO.exec(lower)
  if (ago?.[1]) {
    const days = /^\d+$/.test(ago[1]) ? Number(ago[1]) : (WORD_NUMBERS[ago[1]] ?? 0)
    return toIso(addDays(now, -days))
  }

  let explicit: Date | null | undefined
  const dayMonth = DAY_MONTH.exec(lower)
  let monthDay = MONTH_DAY.exec(lower)
  // "may 2" is usually the verb: a date only as "on May 2", "May 2nd" or "May 2, 2026".
  if (monthDay?.[1] === 'may' && !/\bon\s+$/.test(lower.slice(0, monthDay.index)) && !/(?:st|nd|rd|th)\b|\d{4}/.test(monthDay[0])) {
    monthDay = null
  }
  const numeric = NUMERIC.exec(lower)
  if (dayMonth) {
    explicit = pastDayMonth(Number(dayMonth[1]), MONTHS.indexOf((dayMonth[2] ?? '').slice(0, 3)) + 1, dayMonth[3] ? Number(dayMonth[3]) : null, now)
  } else if (monthDay) {
    explicit = pastDayMonth(Number(monthDay[2]), MONTHS.indexOf((monthDay[1] ?? '').slice(0, 3)) + 1, monthDay[3] ? Number(monthDay[3]) : null, now)
  } else if (numeric) {
    const yearText = numeric[3]
    const year = yearText ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)) : null
    explicit = pastDayMonth(Number(numeric[1] ?? numeric[4]), Number(numeric[2] ?? numeric[5]), year, now)
  }
  if (explicit !== undefined) {
    if (explicit === null || explicit.getTime() > now.getTime()) return null
    return toIso(explicit)
  }

  const weekday = WEEKDAY_FULL.exec(lower) ?? WEEKDAY_SHORT.exec(lower)
  if (weekday?.[2]) {
    const target = WEEKDAYS.findIndex((name) => name.startsWith((weekday[2] ?? '').slice(0, 3)))
    if (target === -1) return undefined
    let back = (now.getUTCDay() - target + 7) % 7
    if (back === 0 && /last|past/.test(weekday[1] ?? '')) back = 7
    return toIso(addDays(now, -back))
  }
  return undefined
}

/** Today's date (UTC) as YYYY-MM-DD, for requests that don't send their own. */
export function utcToday(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}
