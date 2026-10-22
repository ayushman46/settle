/**
 * Indian number words (spec 03 §4.4): all 114 phrases of the reference grammar — 79 parse, 22
 * normalize, 13 must stay unchanged — plus idempotence and the offsets of found phrases.
 */
import { describe, expect, it } from 'vitest'
import { asciiDigits, findNumberPhrases, normalizeNumberWords, parseNumberPhrase } from './numberWords'

const PARSE: ReadonlyArray<readonly [string, number | null]> = [
  // Hinglish fractions and scales (the owner's examples first)
  ['dhai hazaar', 2500],
  ['sava sau', 125],
  ['dedh lakh', 150000],
  ['paanch sau', 500],
  ['saadhe teen sau', 350],
  ['paune do sau', 175],
  ['paune sau', 75],
  ['sava do lakh', 225000],
  ['saadhe paanch hazaar', 5500],
  ['dedh sau', 150],
  ['dhai sau', 250],
  ['sava lakh', 125000],
  ['paune teen hazaar', 2750],
  ['do hazaar paanch sau', 2500],
  ['ek lakh bees hazaar', 120000],
  ['barah sau', 1200],
  ['unnis sau', 1900],
  ['pachees sau', 2500],
  ['teen hazaar chaar sau pachaas', 3450],
  ['do crore', 20000000],
  ['dedh crore', 15000000],
  ['saadhe chaar lakh', 450000],
  ['ninyanve', 99],
  ['chhappan', 56],
  ['sattar hazaar', 70000],
  ['do hazaar aur paanch sau', 2500],
  // Devanagari
  ['ढाई हज़ार', 2500],
  ['ढाई हजार', 2500],
  ['सवा सौ', 125],
  ['डेढ़ लाख', 150000],
  ['पाँच सौ', 500],
  ['पांच सौ', 500],
  ['साढ़े तीन सौ', 350],
  ['पौने दो सौ', 175],
  ['बारह सौ', 1200],
  ['दो हज़ार पाँच सौ', 2500],
  ['एक लाख बीस हज़ार', 120000],
  ['निन्यानबे', 99],
  ['सवा करोड़', 12500000],
  // Marathi, Gujarati, Bengali fractions + scales
  ['दीड हजार', 1500],
  ['अडीच हजार', 2500],
  ['दोन हजार', 2000],
  ['પાંચ સો', 500],
  ['દોઢ હજાર', 1500],
  ['અઢી હજાર', 2500],
  ['સાડા ત્રણ હજાર', 3500],
  ['দেড় হাজার', 1500],
  ['আড়াই হাজার', 2500],
  ['সাড়ে তিন হাজার', 3500],
  ['পাঁচ হাজার', 5000],
  // Digits with a scale word, any script
  ['2 hazaar', 2000],
  ['2.5 lakh', 250000],
  ['२ हज़ार', 2000],
  ['२५००', 2500],
  ['3 ஆயிரம்', 3000],
  ['2 వేల', 2000],
  ['4 ಸಾವಿರ', 4000],
  ['1.5 லட்சம்', 150000],
  ['2.4k', 2400],
  ['1.5L', 150000],
  ['2cr', 20000000],
  ['1,23,456', 123456],
  // English, Indian scale
  ['two thousand five hundred', 2500],
  ['twenty five hundred', 2500],
  ['fifteen hundred', 1500],
  ['a hundred', 100],
  ['a thousand', 1000],
  ['two lakh', 200000],
  ['one lakh twenty thousand', 120000],
  ['twenty-five', 25],
  ['two thousand and fifty', 2050],
  ['two and a half lakh', 250000],
  ['ninety nine', 99],
  ['two fifty', 250],
  ['four ninety nine', 499],
  ['twelve fifty', 1250],
  // Not one number
  ['do teen', null],
  ['hazaar', null],
  ['sava', null],
]

const NORMALIZE: ReadonlyArray<readonly [string, string]> = [
  ['dhai hazaar ka dinner Riya aur Sam ke saath, maine diya', '2500 ka dinner Riya aur Sam ke saath, maine diya'],
  ['cab ke sava sau, Riya ne diya', 'cab ke 125, Riya ne diya'],
  ['Goa trip dedh lakh, 5 log', 'Goa trip 150000, 5 log'],
  ['paanch sau ka recharge', '500 ka recharge'],
  ['teen log, dinner barah sau', '3 log, dinner 1200'],
  ['do log, chai bees rupaye', '2 log, chai 20 rupaye'],
  ['ढाई हज़ार का डिनर रिया और सैम के साथ मैंने दिया', '2500 का डिनर रिया और सैम के साथ मैंने दिया'],
  ['किराया बत्तीस हज़ार चार लोग', 'किराया 32000 4 लोग'],
  ['Rent thirty two thousand split 4 ways', 'Rent 32000 split 4 ways'],
  ['Netflix six forty nine for four', 'Netflix 649 for 4'],
  ['Dinner two thousand four hundred with Riya and Sam', 'Dinner 2400 with Riya and Sam'],
  ['movie tickets saadhe saat sau, Kabir paid', 'movie tickets 750, Kabir paid'],
  ['petrol paune do hazaar', 'petrol 1750'],
  ['३ हज़ार की शॉपिंग', '3000 की शॉपिंग'],
  ['அரிசி 2 ஆயிரம்', 'அரிசி 2000'],
  ['dinner for two, 1,200', 'dinner for 2, 1,200'],
  ['Rs do sau', 'Rs 200'],
  ['₹ dedh hazaar ka gift', '₹ 1500 ka gift'],
  ['saath hazaar ka laptop', '60000 ka laptop'],
  ['saath rupaye ki chai', '60 rupaye ki chai'],
  ['sattar rupaye ka samosa', '70 rupaye ka samosa'],
  ['Riya Das ne diya teen sau', 'Riya Das ne diya 300'],
]

const NONE: readonly string[] = [
  'Riya ke saath dinner',
  'Riya ko do',
  'chai pe chalo',
  'Sam ke sath movie',
  'paise do yaar',
  'teen patti night',
  'dinner with Riya and Sam',
  'रिया के साथ लंच',
  'no idea',
  'so tired',
  'aadha aadha kar lo',
  'the one with the cake',
  'Abdul Sattar ke saath lunch',
]

describe('numberWords — the 114 reference phrases', () => {
  it('has every case', () => {
    expect(PARSE.length + NORMALIZE.length + NONE.length).toBe(114)
  })

  it.each(PARSE)('parses %j → %j', (phrase, want) => {
    expect(parseNumberPhrase(phrase)).toBe(want)
  })

  it.each(NORMALIZE)('normalizes %j', (text, want) => {
    expect(normalizeNumberWords(text)).toBe(want)
  })

  it.each(NONE.map((text) => [text]))('leaves %j unchanged', (text) => {
    expect(normalizeNumberWords(text)).toBe(text)
    expect(findNumberPhrases(text)).toEqual([])
  })
})

describe('numberWords — properties', () => {
  it('is idempotent', () => {
    for (const text of [...NORMALIZE.map(([t]) => t), ...NONE, ...PARSE.map(([p]) => p)]) {
      const once = normalizeNumberWords(text)
      expect(normalizeNumberWords(once), text).toBe(once)
    }
  })

  it('reports offsets into the digit-folded text', () => {
    const text = 'cab ke sava sau, Riya ne diya'
    const [span] = findNumberPhrases(text)
    expect(span).toEqual({ start: 7, end: 15, text: 'sava sau', value: 125 })
    const deva = '३ हज़ार की शॉपिंग'
    const [d] = findNumberPhrases(deva)
    expect(d).toMatchObject({ start: 0, value: 3000 })
    expect(asciiDigits(deva).slice(d!.start, d!.end)).toBe(d!.text)
    expect(d!.text).toBe('3 हज़ार')
  })

  it('finds several phrases left to right and skips plain digits', () => {
    const spans = findNumberPhrases('dinner dhai hazaar, cab do sau rupaye, tip 50')
    expect(spans.map((s) => [s.text, s.value])).toEqual([
      ['dhai hazaar', 2500],
      ['do sau', 200],
    ])
  })

  it('keeps quarters exact', () => {
    expect(parseNumberPhrase('sava')).toBeNull()
    expect(parseNumberPhrase('sava do')).toBe(2.25)
    expect(parseNumberPhrase('saadhe teen')).toBe(3.5)
    expect(parseNumberPhrase('paune do')).toBe(1.75)
    expect(normalizeNumberWords('saadhe teen rupaye')).toBe('3.5 rupaye')
  })

  it('folds every Indian digit block to ASCII without changing the length', () => {
    for (const [digits, ascii] of [
      ['१२३', '123'],
      ['১২৩', '123'],
      ['૧૨૩', '123'],
      ['௧௨௩', '123'],
      ['౧౨౩', '123'],
      ['೧೨೩', '123'],
      ['１２３', '123'],
    ] as const) {
      expect(asciiDigits(digits)).toBe(ascii)
      expect(asciiDigits(digits)).toHaveLength(digits.length)
    }
  })
})
