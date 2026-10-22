/**
 * Indian number words → digits, deterministically (spec 03 §4). "dhai hazaar" = 2500, "sava sau" =
 * 125, "dedh lakh" = 150000, "paune do sau" = 175, "six forty nine" = 649, "ढाई हज़ार" = 2500,
 * "3 ஆயிரம்" = 3000. Used by the server before the AI reads a description and by the client for
 * voice transcripts, so an amount is never left to a model's guess.
 *
 * Values are kept in QUARTERS while reading so "sava" (+¼), "saadhe" (+½), "paune" (−¼), "dedh"
 * (1½) and "dhai" (2½) stay exact. Words that are also ordinary words ("do", "teen", "saath",
 * "Das") only count as numbers in number context. Dependency-free; no regex lookbehind.
 */

/** A number phrase found in text. `value` is in major units and may end in .25/.5/.75 ("sava"). */
export interface NumberSpan {
  start: number
  end: number
  text: string
  value: number
}

/** Quarters per unit. */
const Q = 4

/* ------------------------------------------------------------------ folding */

/** Lower-case Latin; Devanagari: NFC, nukta removed, chandrabindu → anusvara; Bengali/Gujarati nukta removed. */
export function foldWord(word: string): string {
  return word
    .normalize('NFC')
    .toLowerCase()
    .replace(/़/g, '') // Devanagari nukta
    .replace(/ँ/g, 'ं') // chandrabindu → anusvara
    .replace(/়/g, '') // Bengali nukta
    .replace(/઼/g, '') // Gujarati nukta
}

/* ------------------------------------------------------------------ lexicon */

const UNITS = new Map<string, number>()
const add = (value: number, ...words: string[]): void => {
  for (const w of words) UNITS.set(foldWord(w), value)
}

// English (Indian usage)
add(0, 'zero')
;['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'].forEach((w, i) => add(i + 1, w))
add(20, 'twenty')
add(30, 'thirty')
add(40, 'forty', 'fourty')
add(50, 'fifty')
add(60, 'sixty')
add(70, 'seventy')
add(80, 'eighty')
add(90, 'ninety')

// Hindi, romanized (Hinglish). Words that are also common English/Hindi non-numbers are AMBIGUOUS (below).
const HI_LATIN: ReadonlyArray<readonly [number, ...string[]]> = [
  [0, 'shunya', 'sunya'],
  [1, 'ek'],
  [2, 'do', 'doh'],
  [3, 'teen', 'tin'],
  [4, 'char', 'chaar'],
  [5, 'paanch', 'panch', 'paach', 'paanc'],
  [6, 'chhah', 'chhe', 'chah', 'chheh', 'chhai'],
  [7, 'saat', 'sat'],
  [8, 'aath', 'ath'],
  [9, 'nau', 'nao'],
  [10, 'das', 'dus'],
  [11, 'gyarah', 'gyara', 'gyaarah', 'gyaraah', 'igyarah'],
  [12, 'barah', 'bara', 'baarah', 'baara'],
  [13, 'terah', 'tehrah'],
  [14, 'chaudah', 'chauda', 'chodah', 'chaudha'],
  [15, 'pandrah', 'pandra', 'pundrah', 'pandhra'],
  [16, 'solah', 'sola'],
  [17, 'satrah', 'satra', 'sattrah'],
  [18, 'atharah', 'athara', 'attharah', 'athaarah'],
  [19, 'unnis', 'unees', 'unnees', 'unis'],
  [20, 'bees', 'bis'],
  [21, 'ikkis', 'ikkees'],
  [22, 'bais', 'baees', 'baais'],
  [23, 'teis', 'teyis', 'teyees', 'teees'],
  [24, 'chaubis', 'chaubees', 'chobis'],
  [25, 'pachchis', 'pachees', 'pacchis', 'pachis', 'pachhis'],
  [26, 'chhabbis', 'chhabees', 'chabbis'],
  [27, 'sattais', 'sattaees', 'sataees'],
  [28, 'atthais', 'athaees', 'athais', 'atthaees'],
  [29, 'untis', 'unatees', 'untees'],
  [30, 'tees', 'tis'],
  [31, 'iktis', 'ikattees', 'iktees'],
  [32, 'battis', 'battees', 'batees'],
  [33, 'taintis', 'tetees', 'taintees'],
  [34, 'chautis', 'chauntees', 'chontis'],
  [35, 'paintis', 'paintees', 'pentis'],
  [36, 'chhattis', 'chhattees', 'chattis'],
  [37, 'saintis', 'saintees', 'sentis'],
  [38, 'adtis', 'arhtees', 'adtees'],
  [39, 'untalis', 'untaalees', 'untalees'],
  [40, 'chalis', 'chaalees', 'chalees', 'chaalis'],
  [41, 'iktalis', 'iktaalees'],
  [42, 'bayalis', 'bayaalees', 'biyalis'],
  [43, 'tentalis', 'taintaalees'],
  [44, 'chavalis', 'chauvaalees', 'chawalis'],
  [45, 'paintalis', 'paintaalees', 'pentalis'],
  [46, 'chhiyalis', 'chhiyaalees'],
  [47, 'saintalis', 'saintaalees'],
  [48, 'adtalis', 'adtaalees', 'artalis'],
  [49, 'unchas', 'unchaas'],
  [50, 'pachas', 'pachaas', 'pachaas'],
  [51, 'ikyavan', 'ikyaavan'],
  [52, 'bavan', 'baavan'],
  [53, 'tirpan', 'tirepan'],
  [54, 'chauvan', 'chauvaan'],
  [55, 'pachpan', 'pachapan'],
  [56, 'chhappan', 'chappan'],
  [57, 'sattavan', 'sattaavan'],
  [58, 'atthavan', 'atthaavan'],
  [59, 'unsath', 'unsaath'],
  [60, 'saath', 'sath'],
  [61, 'iksath', 'iksaath'],
  [62, 'basath', 'baasath'],
  [63, 'tirsath', 'tiresath'],
  [64, 'chausath', 'chaunsath'],
  [65, 'painsath', 'paisath'],
  [66, 'chhiyasath', 'chhiyaasath'],
  [67, 'sadsath', 'sarsath'],
  [68, 'adsath', 'arsath'],
  [69, 'unhattar'],
  [70, 'sattar'],
  [71, 'ikhattar'],
  [72, 'bahattar'],
  [73, 'tihattar'],
  [74, 'chauhattar'],
  [75, 'pachhattar', 'pachattar'],
  [76, 'chhihattar'],
  [77, 'satattar', 'sathattar'],
  [78, 'athattar'],
  [79, 'unasi', 'unaasi'],
  [80, 'assi', 'asi'],
  [81, 'ikyasi', 'ikyaasi'],
  [82, 'bayasi', 'bayaasi'],
  [83, 'tirasi', 'tiraasi'],
  [84, 'chaurasi', 'chauraasi'],
  [85, 'pachasi', 'pachaasi'],
  [86, 'chhiyasi', 'chhiyaasi'],
  [87, 'sattasi', 'sattaasi'],
  [88, 'athasi', 'athaasi'],
  [89, 'navasi', 'nevasi', 'navaasi'],
  [90, 'nabbe', 'nabbey'],
  [91, 'ikyanve', 'ikyaanave'],
  [92, 'banve', 'baanave'],
  [93, 'tiranve', 'tiraanave'],
  [94, 'chauranve', 'chauraanave'],
  [95, 'pachanve', 'pachaanave'],
  [96, 'chhiyanve', 'chhiyaanave'],
  [97, 'sattanve', 'sattaanave'],
  [98, 'atthanve', 'atthaanave'],
  [99, 'ninyanve', 'ninyaanave', 'nindyanve'],
]
for (const [v, ...ws] of HI_LATIN) add(v, ...ws)

// Hindi, Devanagari 0–99
const HI_DEVA =
  'शून्य एक दो तीन चार पांच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरेसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानबे बानबे तिरानबे चौरानबे पंचानबे छियानबे सत्तानबे अट्ठानबे निन्यानबे'.split(' ')
HI_DEVA.forEach((w, i) => add(i, w))
add(5, 'पाँच')
add(6, 'छः', 'छे')
add(15, 'पन्द्रह')
add(95, 'पिचानवे', 'पंचानवे')

// Marathi (Devanagari): 1–10, tens, a few common teens
add(2, 'दोन')
add(5, 'पाच')
add(6, 'सहा')
add(9, 'नऊ')
add(10, 'दहा')
add(20, 'वीस')
add(40, 'चाळीस')
add(50, 'पन्नास')
add(80, 'ऐंशी')
add(90, 'नव्वद')
// Gujarati
;['એક', 'બે', 'ત્રણ', 'ચાર', 'પાંચ', 'છ', 'સાત', 'આઠ', 'નવ', 'દસ'].forEach((w, i) => add(i + 1, w))
add(20, 'વીસ')
add(30, 'ત્રીસ')
add(40, 'ચાલીસ')
add(50, 'પચાસ')
add(60, 'સાઠ')
add(70, 'સિત્તેર')
add(80, 'એંસી')
add(90, 'નેવું')
// Bengali
;['এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'].forEach((w, i) => add(i + 1, w))
add(20, 'বিশ', 'কুড়ি')
add(30, 'ত্রিশ')
add(40, 'চল্লিশ')
add(50, 'পঞ্চাশ')
add(60, 'ষাট')
add(70, 'সত্তর')
add(80, 'আশি')
add(90, 'নব্বই')

const HUNDRED = new Set(['hundred', 'sau', 'सौ', 'शंभर', 'સો', 'শো', 'নূরু', 'நூறு', 'వంద', 'వందలు', 'ನೂರು'].map(foldWord))
// Bengali "একশো" (one hundred) is written as one word.
UNITS.set(foldWord('একশো'), 100)

const SCALES = new Map<string, number>()
const scale = (value: number, ...words: string[]): void => {
  for (const w of words) SCALES.set(foldWord(w), value)
}
scale(1000, 'thousand', 'thousands', 'grand', 'hazaar', 'hazar', 'hajar', 'hajaar', 'hazaar', 'हज़ार', 'हजार', 'હજાર', 'হাজার', 'ஆயிரம்', 'వెయ్యి', 'వేలు', 'వేల', 'ಸಾವಿರ')
scale(100000, 'lakh', 'lakhs', 'lac', 'lacs', 'laakh', 'लाख', 'લાખ', 'লাখ', 'লক্ষ', 'லட்சம்', 'లక్ష', 'లక్షలు', 'ಲಕ್ಷ')
scale(10000000, 'crore', 'crores', 'karod', 'karor', 'करोड़', 'करोड', 'कोटी', 'કરોડ', 'কোটি', 'கோடி', 'కోటి', 'కోట్లు', 'ಕೋಟಿ')
scale(1000000, 'million', 'millions')

/** Quarter-based bases: dedh = 1.5, dhai = 2.5. */
const FRACTION_BASES = new Map<string, number>()
for (const w of ['dedh', 'derh', 'dher', 'डेढ़', 'डेढ', 'दीड', 'દોઢ', 'দেড়']) FRACTION_BASES.set(foldWord(w), 6)
for (const w of ['dhai', 'dhaai', 'adhai', 'arhai', 'dhaii', 'ढाई', 'अढ़ाई', 'अडीच', 'અઢી', 'আড়াই']) FRACTION_BASES.set(foldWord(w), 10)

/** Modifiers: + or − quarters applied to the NEXT number (or to 1 when a scale follows directly). */
const MODIFIERS = new Map<string, number>()
for (const w of ['sava', 'savaa', 'sawa', 'सवा', 'सव्वा', 'સવા', 'সোয়া']) MODIFIERS.set(foldWord(w), 1)
for (const w of ['saadhe', 'saade', 'sadhe', 'saarhe', 'sade', 'साढ़े', 'साढे', 'साडे', 'સાડા', 'সাড়ে']) MODIFIERS.set(foldWord(w), 2)
for (const w of ['paune', 'pone', 'paunay', 'पौने', 'पावणे', 'પોણા', 'পৌনে']) MODIFIERS.set(foldWord(w), -1)

/** Latin words that are numbers only in number context (see `isNumberContext`). */
const AMBIGUOUS = new Set(
  ['do', 'doh', 'teen', 'tin', 'char', 'sat', 'ath', 'bis', 'tis', 'bees', 'das', 'dus', 'sola', 'bara', 'tera', 'chhe', 'chah', 'chhai', 'saath', 'sath', 'asi', 'nao', 'ek', 'one', 'sattar', 'दो', 'বিশ', 'নয়', 'ਨੌ'].map(foldWord),
)
/** 60: only before a scale/hundred or a currency word, never in "ke saath". */
const SIXTY_WORDS = new Set(['saath', 'sath'])

const CURRENCY_AFTER = new Set(
  ['rs', 'rupees', 'rupee', 'rupaye', 'rupaiye', 'rupay', 'rupiya', 'rupye', 'rupya', 'bucks', 'रुपये', 'रुपए', 'रुपया', 'रु', 'रूपये', 'টাকা', 'রুপি', 'રૂપિયા', 'ரூபாய்', 'రూపాయలు', 'ರೂಪಾಯಿ', 'रुपये'].map(foldWord),
)
const COUNT_AFTER = new Set(
  ['log', 'logon', 'logo', 'logg', 'bande', 'jan', 'jane', 'people', 'persons', 'person', 'friends', 'ways', 'way', 'plates', 'plate', 'baar', 'times', 'लोग', 'लोगों', 'जन', 'बंदे', 'लोक', 'જણ', 'লোক', 'জন', 'பேர்', 'మంది', 'ಜನ'].map(foldWord),
)
const CURRENCY_BEFORE = new Set(['rs', 'inr', '₹', 'rupees', 'रु'])
const CONNECT_EN = new Set(['and'])
const CONNECT_HI = new Set(['aur', 'और'].map(foldWord))
const DIGIT_SUFFIX: Readonly<Record<string, number>> = { k: 1000, l: 100000, lakh: 100000, lac: 100000, cr: 10000000 }

/* ------------------------------------------------------------------ digits */

/** Zero code points of the digit blocks people type: Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, full-width. */
const DIGIT_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10]

/** Indian digits (०-९ ০-৯ ૦-૯ ௦-௯ ౦-౯ ೦-೯ ０-９) → ASCII. Same length as the input. */
export function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0) ?? 0
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9)
    return zero === undefined ? ch : String(cp - zero)
  })
}

/** "2,500" "1,23,456" "2.5" → number; null when not a plain number. */
function digitValue(text: string): number | null {
  if (!/^\d{1,3}(?:,\d{2,3})+(?:\.\d+)?$|^\d+(?:\.\d+)?$/.test(text)) return null
  return Number(text.replace(/,/g, ''))
}

/* ------------------------------------------------------------------ tokens */

interface Token {
  raw: string
  start: number
  end: number
  digits: string | null
  suffix: string | null
}

type Kind =
  | { kind: 'digits'; quarters: number; scaled: boolean }
  | { kind: 'mod'; quarters: number }
  | { kind: 'unit'; quarters: number; value?: number; fraction?: boolean; word: string }
  | { kind: 'hundred' }
  | { kind: 'scale'; value: number }
  | { kind: 'article' }
  | { kind: 'and'; lang: 'en' | 'hi' }
  | { kind: 'half' }
  | { kind: 'other'; word?: string }

// A token: digits with grouping/decimals and an optional glued suffix (2.5k, 1.5L, 2cr), a word
// (letters + combining marks), "₹", or anything else (kept as a separator).
const TOKEN = /(\d[\d,]*(?:\.\d+)?)(k|l|lakh|lac|cr)?(?![\p{L}\p{N}])|[\p{L}\p{M}]+|₹|\S/giu

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const m of text.matchAll(TOKEN)) {
    // A lone hyphen joins words ("twenty-five"); it is never a token of its own.
    if (m[0] === '-') continue
    const start = m.index ?? 0
    tokens.push({ raw: m[0], start, end: start + m[0].length, digits: m[1] ?? null, suffix: m[2] ?? null })
  }
  return tokens
}

/** What a token means for numbers. */
function classify(tok: Token): Kind {
  if (tok.digits !== null) {
    const v = digitValue(tok.digits)
    if (v === null) return { kind: 'other' }
    const mult = tok.suffix ? (DIGIT_SUFFIX[tok.suffix.toLowerCase()] ?? 1) : 1
    return { kind: 'digits', quarters: Math.round(v * mult * Q), scaled: Boolean(tok.suffix) }
  }
  const w = foldWord(tok.raw)
  const mod = MODIFIERS.get(w)
  if (mod !== undefined) return { kind: 'mod', quarters: mod }
  const fraction = FRACTION_BASES.get(w)
  if (fraction !== undefined) return { kind: 'unit', quarters: fraction, fraction: true, word: w }
  if (HUNDRED.has(w)) return { kind: 'hundred' }
  const scaleValue = SCALES.get(w)
  if (scaleValue !== undefined) return { kind: 'scale', value: scaleValue }
  const unit = UNITS.get(w)
  if (unit !== undefined) return { kind: 'unit', quarters: unit * Q, value: unit, word: w }
  if (w === 'a' || w === 'an') return { kind: 'article' }
  if (CONNECT_EN.has(w)) return { kind: 'and', lang: 'en' }
  if (CONNECT_HI.has(w)) return { kind: 'and', lang: 'hi' }
  if (w === 'half') return { kind: 'half' }
  return { kind: 'other', word: w }
}

/* ------------------------------------------------------------------ phrases */

/**
 * Every number phrase written in words (or digits + scale words / k / L / cr), left to right.
 * Plain digit numbers are not returned (nothing to rewrite). Offsets refer to `asciiDigits(text)`.
 */
export function findNumberPhrases(input: string): NumberSpan[] {
  const text = asciiDigits(input)
  const tokens = tokenize(text)
  const kinds = tokens.map(classify)
  const out: NumberSpan[] = []
  let i = 0
  while (i < tokens.length) {
    const phrase = readPhrase(text, tokens, kinds, i)
    if (phrase) {
      if (phrase.span) out.push(phrase.span)
      i = phrase.next
    } else i++
  }
  return out
}

function gapOk(text: string, a: Token, b: Token): boolean {
  const gap = text.slice(a.end, b.start)
  return /^\s*$/.test(gap) || /^-$/.test(gap)
}

function isNumberish(k: Kind): boolean {
  return k.kind === 'digits' || k.kind === 'unit' || k.kind === 'hundred' || k.kind === 'scale' || k.kind === 'mod'
}

function wordOf(token: Token | undefined): string {
  return token ? foldWord(token.raw) : ''
}

/** Reads one phrase starting at token `start`, evaluated left to right in quarters. */
function readPhrase(text: string, tokens: readonly Token[], kinds: readonly Kind[], start: number): { span: NumberSpan | null; next: number } | null {
  const k0 = kinds[start]
  if (!k0 || !(isNumberish(k0) || k0.kind === 'article')) return null
  if (k0.kind === 'hundred' || k0.kind === 'scale') return null // a bare "hundred"/"lakh" is a word, not a number
  let total = 0
  let group: number | null = null
  let mod = 0
  let lastScale = Number.POSITIVE_INFINITY
  let lastKind: 'mod' | 'unit' | 'hundred' | 'scale' | null = null
  let lastUnitValue: number | null = null
  let count = 0
  let end = start
  let j = start
  let ambiguousOnly = true

  for (; j < tokens.length; j++) {
    const k = kinds[j]
    const tok = tokens[j]
    const prevTok = tokens[j - 1]
    if (!k || !tok) break
    if (j > start && prevTok && !gapOk(text, prevTok, tok)) break
    if (k.kind === 'article') {
      // "a hundred", "a lakh": only right before a hundred/scale.
      const next = kinds[j + 1]
      if (count === 0 && next && (next.kind === 'hundred' || next.kind === 'scale')) continue
      break
    }
    if (k.kind === 'and') {
      // "two thousand and fifty", "do hazaar aur paanch sau"; "two and a half lakh".
      const n1 = kinds[j + 1]
      const n2 = kinds[j + 2]
      const n3 = kinds[j + 3]
      if (k.lang === 'en' && n1?.kind === 'article' && n2?.kind === 'half' && count > 0 && group !== null) {
        group += 2 // + ½
        j += 2
        end = j
        lastKind = 'unit'
        continue
      }
      if (k.lang === 'en' && n1?.kind === 'half' && count > 0 && group !== null) {
        group += 2
        j += 1
        end = j
        lastKind = 'unit'
        continue
      }
      const afterScale = lastKind === 'scale' || lastKind === 'hundred'
      if (!afterScale) break
      if (k.lang === 'en' && n1?.kind === 'unit' && !(n2?.kind === 'other' && n2.word !== undefined && COUNT_AFTER.has(n2.word))) continue
      if (k.lang === 'hi' && (n1?.kind === 'unit' || n1?.kind === 'mod') && (n2?.kind === 'hundred' || n3?.kind === 'hundred')) continue
      break
    }
    if (k.kind === 'half') break
    if (k.kind === 'mod') {
      const next = kinds[j + 1]
      if (!next || !(next.kind === 'unit' || next.kind === 'digits' || next.kind === 'hundred' || next.kind === 'scale')) break
      if (group !== null && lastKind !== 'scale') break
      mod = k.quarters
      count++
      lastKind = 'mod'
      ambiguousOnly = false
      continue
    }
    if (k.kind === 'unit' || k.kind === 'digits') {
      const v = k.quarters + mod
      const nextWord = wordOf(tokens[j + 1])
      const unitValue = k.kind === 'unit' ? k.value : undefined
      // "32 hazaar chaar log": the 4 counts people, it isn't part of the amount.
      if ((lastKind === 'scale' || lastKind === 'hundred') && mod === 0 && COUNT_AFTER.has(nextWord)) break
      // English price reading: "six forty nine" = 649, "two fifty" = 250, "twelve fifty" = 1250.
      if (
        group !== null &&
        lastKind === 'unit' &&
        k.kind === 'unit' &&
        lastUnitValue !== null &&
        lastUnitValue >= 1 &&
        lastUnitValue <= 19 &&
        group === lastUnitValue * Q &&
        unitValue !== undefined &&
        unitValue >= 20 &&
        unitValue % 10 === 0 &&
        isEnglishWord(prevTok) &&
        isEnglishWord(tok) &&
        !nextIsScale(kinds, j)
      ) {
        group = group * 100 + v
        mod = 0
        count++
        lastKind = 'unit'
        lastUnitValue = unitValue
        ambiguousOnly = false
        end = j
        continue
      }
      if (group !== null) {
        // English "twenty five": tens followed by 1–9.
        const tensThenOnes =
          lastKind === 'unit' &&
          lastUnitValue !== null &&
          lastUnitValue % 10 === 0 &&
          lastUnitValue >= 20 &&
          lastUnitValue <= 90 &&
          k.kind === 'unit' &&
          unitValue !== undefined &&
          unitValue >= 1 &&
          unitValue <= 9 &&
          group % (100 * Q) === lastUnitValue * Q &&
          isEnglishWord(tok)
        const afterHundred = lastKind === 'hundred' && k.quarters < 100 * Q
        if (!(tensThenOnes || afterHundred)) break
        group += v
      } else {
        if (lastKind === 'scale' && k.kind === 'digits' && k.quarters >= lastScale * Q) break
        group = v
      }
      mod = 0
      count++
      lastKind = 'unit'
      lastUnitValue = unitValue ?? null
      if (k.kind === 'digits') {
        ambiguousOnly = false
        if (k.scaled) lastKind = 'scale'
      } else if (!AMBIGUOUS.has(k.word)) ambiguousOnly = false
      end = j
      continue
    }
    if (k.kind === 'hundred') {
      if (lastKind === 'hundred') break
      if (group === null) group = Q + mod
      else if (group >= 100 * Q) break
      group *= 100
      mod = 0
      count++
      lastKind = 'hundred'
      ambiguousOnly = false
      end = j
      continue
    }
    if (k.kind === 'scale') {
      if (k.value >= lastScale) break
      const base = group ?? Q + mod
      total += base * k.value
      group = null
      mod = 0
      lastScale = k.value
      count++
      lastKind = 'scale'
      ambiguousOnly = false
      end = j
      continue
    }
    break
  }

  if (count === 0) return null
  const value = (total + (group ?? 0)) / Q
  const first = tokens[start]
  const lastTok = tokens[end]
  if (!first || !lastTok) return null
  // A phrase made of one ambiguous word needs context.
  if (ambiguousOnly && !isNumberContext(tokens, kinds, start, end)) return null
  // A lone digit token without a scale is already a number: no rewrite needed.
  const onlyDigits = kinds.slice(start, end + 1).every((k) => k.kind === 'digits' && !k.scaled)
  if (onlyDigits) return { span: null, next: end + 1 }
  return { span: { start: first.start, end: lastTok.end, text: text.slice(first.start, lastTok.end), value }, next: end + 1 }
}

const ENGLISH_WORDS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fourty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
])

function isEnglishWord(tok: Token | undefined): boolean {
  return tok !== undefined && ENGLISH_WORDS.has(foldWord(tok.raw))
}

function nextIsScale(kinds: readonly Kind[], j: number): boolean {
  const n1 = kinds[j + 1]
  const n2 = kinds[j + 2]
  return n1?.kind === 'scale' || n1?.kind === 'hundred' || (n1?.kind === 'unit' && (n2?.kind === 'scale' || n2?.kind === 'hundred'))
}

/** Whether an ambiguous one-word phrase ("do", "teen", "saath") stands for a number here. */
function isNumberContext(tokens: readonly Token[], kinds: readonly Kind[], start: number, end: number): boolean {
  const prevWord = wordOf(tokens[start - 1])
  const nextKind = kinds[end + 1]
  const nextWord = wordOf(tokens[end + 1])
  const word = wordOf(tokens[start])
  if (SIXTY_WORDS.has(word)) return CURRENCY_AFTER.has(nextWord)
  if (CURRENCY_BEFORE.has(prevWord)) return true
  if (CURRENCY_AFTER.has(nextWord) || COUNT_AFTER.has(nextWord)) return true
  if (prevWord === 'for' && (nextKind === undefined || nextWord === '' || /^[.,!?]$/.test(tokens[end + 1]?.raw ?? ''))) return true
  return false
}

/* ------------------------------------------------------------------ public API */

/** The text with every number phrase written as digits ("dhai hazaar" → "2500"). Idempotent. */
export function normalizeNumberWords(input: string): string {
  const text = asciiDigits(input)
  const spans = findNumberPhrases(input)
  let out = ''
  let at = 0
  for (const s of spans) {
    out += text.slice(at, s.start) + String(s.value)
    at = s.end
  }
  return out + text.slice(at)
}

/** A whole phrase as one number, or null ("do teen" → null). Plain digits ("1,23,456") parse too. */
export function parseNumberPhrase(phrase: string): number | null {
  const text = asciiDigits(phrase.trim())
  const plain = digitValue(text)
  if (plain !== null) return plain
  const spans = findNumberPhrases(text)
  if (spans.length !== 1) return null
  const s = spans[0]
  return s && s.start === 0 && s.end === text.length ? s.value : null
}
