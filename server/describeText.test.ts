import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  detectCurrency,
  excludesSpeaker,
  fold,
  hasAmountCue,
  isIsoDate,
  isNobody,
  isSpeakerName,
  matchKnownName,
  mentionsPayer,
  payerFromText,
  resolveDate,
  speakerTakesPart,
  speaksInFirstPerson,
  textMentions,
  utcToday,
  withinOneEdit,
} from './describeText'

describe('fold', () => {
  it('lower-cases and strips accents, apostrophes and punctuation', () => {
    expect(fold("  Zoë's  CAFÉ!! ")).toBe('zoes cafe')
    expect(fold('Riya-Sharma')).toBe('riya sharma')
    expect(fold(' रिया! ')).toBe(fold('रिया')) // other scripts fold consistently too
  })
})

describe('detectCurrency — only what the text names', () => {
  it.each([
    ['Cab 840 with Riya', null],
    ['Dinner 2.4k', null],
    ['Rent 32000 me 40%', null],
    ['Dinner ₹2,400', 'INR'],
    ['Dinner Rs. 2400', 'INR'],
    ['Dinner Rs2400', 'INR'],
    ['dinner 2400 rs', 'INR'],
    ['2400 rupees for dinner', 'INR'],
    ['500 rupaye diye', 'INR'],
    ['2400 INR', 'INR'],
    ['2400 inr', 'INR'],
    ['Lunch $45', 'USD'],
    ['45 dollars', 'USD'],
    ['US$ 45', 'USD'],
    ['S$45 chilli crab', 'SGD'],
    ['A$ 30', 'AUD'],
    ['HK$200 dim sum', 'HKD'],
    ['€30 pizza', 'EUR'],
    ['30 euros', 'EUR'],
    ['£12 pints', 'GBP'],
    ['20 quid', 'GBP'],
    ['¥3000 ramen', 'JPY'],
    ['Taxi 300 baht', 'THB'],
    ['Dinner 120 AED', 'AED'],
    ['RM 45 nasi lemak', 'MYR'],
    ['2,400 CHF fondue', 'CHF'],
  ])('%s → %s', (text, currency) => {
    expect(detectCurrency(text, 'INR')).toBe(currency)
  })

  it('never takes the hint as a currency on its own', () => {
    expect(detectCurrency('Cab 840', 'INR')).toBeNull()
    expect(detectCurrency('Cab 840', 'USD')).toBeNull()
  })

  it('reads "$" as the user\'s own dollar and "Rs" as their own rupee', () => {
    expect(detectCurrency('Lunch $45', 'SGD')).toBe('SGD')
    expect(detectCurrency('Lunch $45', 'AUD')).toBe('AUD')
    expect(detectCurrency('Lunch $45', 'INR')).toBe('USD')
    expect(detectCurrency('Dinner Rs 2400', 'LKR')).toBe('LKR')
    expect(detectCurrency('Dinner Rs 2400', 'USD')).toBe('INR')
  })

  it('reads "bucks" as the local money', () => {
    expect(detectCurrency('500 bucks for pizza', 'INR')).toBe('INR')
    expect(detectCurrency('500 bucks for pizza', null)).toBe('USD')
  })

  it('takes the first currency named', () => {
    expect(detectCurrency('€30 or about ₹2700', 'INR')).toBe('EUR')
    expect(detectCurrency('₹2700 (€30)', 'INR')).toBe('INR')
  })

  it('ignores words that only look like currencies', () => {
    for (const text of ['Mrs Sharma 400', 'hrs 3 parking 200', 'Lunch for ALL 600', 'try the new place 900', 'cup of tea 40', 'arm wrestling 50', 'room 2 rent 9000']) {
      expect(detectCurrency(text, 'INR')).toBeNull()
    }
  })
})

describe('hasAmountCue', () => {
  it('needs digits or number words', () => {
    expect(hasAmountCue('cab 840')).toBe(true)
    expect(hasAmountCue('two thousand for rent')).toBe(true)
    expect(hasAmountCue('5 lakh wedding')).toBe(true)
    expect(hasAmountCue('dinner with riya')).toBe(false)
    expect(hasAmountCue('everyone at the party')).toBe(false)
  })
})

describe('mentionsPayer', () => {
  it.each([
    'I paid 840',
    'paid by Riya',
    'Sam covered it',
    'Riya picked up the tab',
    "Riya's treat",
    'dinner on me',
    'I got it',
    "I'll pay",
    'Riya is paying',
    'Sam pays for the cab',
    'put it on my card',
    'via Riya’s UPI',
    'maine diya 500',
    'Riya ne pay kiya',
    'I spent 500 on lunch',
    'Riya bought the tickets',
  ])('"%s" says who paid', (text) => {
    expect(mentionsPayer(text)).toBe(true)
  })

  it.each([
    'Cab 840 with Riya and Sam, Sam pays double',
    'Rent 32000 me 40% Aditya 30% Neha 30%',
    'Riya pays half, Sam pays twice',
    'I pay 60% she pays 40%',
    'Sam is paying for two',
    'Netflix 649 for 4',
    'unpaid electricity 1200',
    'prepaid recharge 299 with Sam',
  ])('"%s" does not', (text) => {
    expect(mentionsPayer(text)).toBe(false)
  })
})

describe('payerFromText', () => {
  const people = ['Me', 'Riya Sharma', 'Sam', 'Kabir', 'Aditya']
  it.each([
    ['wifi 1179 with kabir and zoya, kabir covered it', 'Kabir'],
    ['Cab 840, paid by Riya', 'Riya Sharma'],
    ['Riya paid for the cab', 'Riya Sharma'],
    ["dinner was Sam's treat", 'Sam'],
    ['Adi picked up the tab', 'Aditya'],
    ['Sam ne pay kiya', 'Sam'],
    ['I paid 840 for the cab with Sam', 'Me'],
    ['paid 2.4k for dinner with Riya', 'Me'],
    ['dinner on me with Riya', 'Me'],
    ['my treat, pizza 900 with Sam', 'Me'],
    ['we already paid the deposit', 'Me'],
    ['maine diya 500', 'Me'],
  ])('"%s" → %s', (text, payer) => {
    expect(payerFromText(text, people)).toBe(payer)
  })

  it('says nothing when the text says nothing (or only talks shares)', () => {
    for (const text of ['Cab 840 with Riya and Sam, Sam pays double', 'Rent 32000 me 40% Aditya 30%', 'who paid for this?', 'Lunch 600 with Sam']) {
      expect(payerFromText(text, people)).toBeNull()
    }
  })

  it('leaves names it does not know to the model', () => {
    expect(payerFromText('Arjun paid 600 for lunch', ['Me', 'Sam'])).toBeNull()
  })
})

describe('the speaker', () => {
  it('recognises "Me" however it is written', () => {
    for (const name of ['me', 'Me', 'ME', 'I', 'myself', 'Me (you)', 'we', 'us', 'mujhe']) expect(isSpeakerName(name)).toBe(true)
    for (const name of ['Meera', 'Main Course', 'Ian', 'Riya']) expect(isSpeakerName(name)).toBe(false)
  })

  it('knows nobody-words aren\'t people', () => {
    for (const name of ['everyone', 'The rest', 'Person 3', 'friend 2', 'they', '', '42', 'N/A']) expect(isNobody(name)).toBe(true)
    for (const name of ['Riya', 'Sam', 'Restu', 'Allen']) expect(isNobody(name)).toBe(false)
  })

  it.each([
    ['Dinner 2400 with Riya and Sam', true],
    ['Rent 32000 me 40% Aditya 30% Neha 30%', true],
    ['we went to Goa, hotel 18500', true],
    ['my share of the cab is 200', true],
    ['Cab 840 w/ Riya', true],
    ['Movie tickets 900 for Riya and Sam', false],
    ['I paid for Riya and Sam’s tickets 900', false],
    ['Pizza 900 with Riya and Sam, not me', false],
    ['Pizza 900 for Riya and Sam only, I paid', false],
    ['Lunch 600 with Riya except me', false],
    ['Cab 300 paid with card', false],
    ['Netflix 649', false],
  ])('"%s" → the speaker takes part: %s', (text, takesPart) => {
    expect(speakerTakesPart(text)).toBe(takesPart)
  })

  it('spots the speaker saying they are out', () => {
    for (const text of ['for Riya and Sam only', 'excluding me', "I'm not in", 'leave me out', "I didn't eat", 'only for Riya']) expect(excludesSpeaker(text)).toBe(true)
    for (const text of ['only 500', 'with me and Riya', 'for me and Sam']) expect(excludesSpeaker(text)).toBe(false)
  })

  it('knows first-person text', () => {
    expect(speaksInFirstPerson('I paid')).toBe(true)
    expect(speaksInFirstPerson('maine diya')).toBe(true)
    expect(speaksInFirstPerson('kabir covered it')).toBe(false)
  })
})

describe('names', () => {
  const known = ['Riya Sharma', 'Sam', 'Zoë', 'Aditya', 'Neha K', 'Neha P']

  it('reuses the caller\'s spelling for the same name, ignoring case and accents', () => {
    expect(matchKnownName('sam', known)).toBe('Sam')
    expect(matchKnownName('ZOE', known)).toBe('Zoë')
    expect(matchKnownName('riya sharma', known)).toBe('Riya Sharma')
  })

  it('maps a unique first name to the full known name, but not an ambiguous one', () => {
    expect(matchKnownName('Riya', known)).toBe('Riya Sharma')
    expect(matchKnownName('Neha', known)).toBeNull()
    expect(matchKnownName('Riya Kapoor', known)).toBeNull()
    expect(matchKnownName('Kabir', known)).toBeNull()
    expect(matchKnownName('', known)).toBeNull()
  })

  it('counts one-letter edits', () => {
    expect(withinOneEdit('ria', 'riya')).toBe(true)
    expect(withinOneEdit('riya', 'ria')).toBe(true)
    expect(withinOneEdit('sam', 'sum')).toBe(true)
    expect(withinOneEdit('sam', 'sam')).toBe(true)
    expect(withinOneEdit('sam', 'tom')).toBe(false)
    expect(withinOneEdit('riya', 'riyaaa')).toBe(false)
  })

  it('knows whether the text mentions someone', () => {
    const text = 'dinner with riya, sam and adi — ria paid'
    for (const name of ['Riya', 'Riya Sharma', 'Sam', 'Aditya']) expect(textMentions(text, name)).toBe(true)
    for (const name of ['Neha', 'Person 3', '']) expect(textMentions(text, name)).toBe(false)
    expect(textMentions('lunch with Riyaa', 'Riya')).toBe(true)
    expect(textMentions('cab 840 with 2 friends', 'Friend')).toBe(true)
    expect(textMentions('cab 840', 'Ca')).toBe(false)
  })

  it('gives transliterated names the benefit of the doubt', () => {
    expect(textMentions('रिया के साथ खाना 500', 'Riya')).toBe(true)
  })
})

describe('resolveDate', () => {
  const today = '2026-10-21' // a Wednesday

  it.each([
    ['dinner yesterday', '2026-10-20'],
    ['drinks last night', '2026-10-20'],
    ['cab today', '2026-10-21'],
    ['pizza tonight', '2026-10-21'],
    ['movie day before yesterday', '2026-10-19'],
    ['lunch 3 days ago', '2026-10-18'],
    ['lunch two days ago', '2026-10-19'],
    ['party on friday', '2026-10-16'],
    ['party last friday', '2026-10-16'],
    ['brunch on Wednesday', '2026-10-21'],
    ['brunch last wednesday', '2026-10-14'],
    ['cab on sat', '2026-10-17'],
    ['dinner on 18 Oct', '2026-10-18'],
    ['dinner on 18th October', '2026-10-18'],
    ['dinner Oct 18', '2026-10-18'],
    ['party on may 2', '2026-05-02'],
    ['party May 2nd', '2026-05-02'],
    ['flight 5 dec', '2025-12-05'],
    ['hotel 14/10/2026', '2026-10-14'],
    ['hotel on 14/10', '2026-10-14'],
    ['hotel 14-10-26', '2026-10-14'],
  ])('"%s" → %s', (text, date) => {
    expect(resolveDate(text, today)).toBe(date)
  })

  it('returns null for days it can name but not use (impossible or in the future)', () => {
    expect(resolveDate('dinner on 31 Feb', today)).toBeNull()
    expect(resolveDate('trip 14/10/2027', today)).toBeNull()
  })

  it('returns undefined when the text names no day', () => {
    for (const text of ['Cab 840 with Riya', 'we sat down for dinner 900', 'DMart 1200', 'Decathlon 50 shoes', 'split 1/2 with Sam', 'mart 12', 'Rent 32000 may 2']) {
      expect(resolveDate(text, today)).toBeUndefined()
    }
    expect(resolveDate('dinner yesterday', 'not a date')).toBeUndefined()
  })
})

describe('date helpers', () => {
  it('validates calendar dates and counts days', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('21/10/2026')).toBe(false)
    expect(daysBetween('2026-10-20', '2026-10-21')).toBe(1)
    expect(daysBetween('2026-10-21', '2026-10-20')).toBe(-1)
    expect(daysBetween('x', '2026-10-20')).toBeNaN()
    expect(utcToday(Date.UTC(2026, 9, 21, 23, 59))).toBe('2026-10-21')
  })
})
