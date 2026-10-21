import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DESCRIBE_BUDGET_MS, DESCRIBE_LIMITS, type DescribedSplit } from '../shared/api'
import {
  describeSplit,
  isAcceptableDescribe,
  looksLikeDescribe,
  normalizeDescribed,
  parseDescribeRequest,
  REQUEST_MESSAGES,
  type DescribeInput,
} from './describe'
import { forgetPromptOnlyModels, UpstreamError } from './nvidia'
import { chatResponse, errorResponse, sentBody, testConfig } from './testing'

const TODAY = '2026-10-21' // a Wednesday
const input = (text: string, people: string[] = [], currency: string | null = 'INR'): DescribeInput => ({ text, people, currency, today: TODAY })

/** The model's answer with every key, overridable. */
function reply(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    isExpense: true,
    title: 'Dinner',
    category: 'food',
    amount: 2400,
    currency: null,
    payer: null,
    mode: 'equal',
    people: [
      { name: 'Me', value: null },
      { name: 'Riya', value: null },
      { name: 'Sam', value: null },
    ],
    headcount: null,
    date: null,
    ...overrides,
  }
}

function split(raw: unknown, describeInput: DescribeInput): DescribedSplit {
  const outcome = normalizeDescribed(raw, describeInput)
  if (outcome.kind !== 'split') throw new Error(`expected a split, got ${outcome.kind}`)
  return outcome.split
}

const people = (result: DescribedSplit) => result.people.map(({ name, value }) => `${name}${value === null ? '' : `:${value}`}`)

/* ---------------------------------------------------------------- the request */

describe('parseDescribeRequest', () => {
  it('cleans the text and hints, dedupes known people and drops the speaker from them', () => {
    const check = parseDescribeRequest(
      { text: '  Cab 840\nwith  Riya \u0007 ', currency: ' inr ', people: ['Riya Sharma', ' riya sharma ', '', 'Me', 'Sam'], today: '2026-10-20' },
      TODAY,
    )
    expect(check).toEqual({ ok: true, input: { text: 'Cab 840 with Riya', currency: 'INR', people: ['Riya Sharma', 'Sam'], today: '2026-10-20' } })
  })

  it('treats hints as optional and forgives odd ones', () => {
    expect(parseDescribeRequest({ text: 'Cab 840' }, TODAY)).toEqual({ ok: true, input: { text: 'Cab 840', currency: null, people: [], today: TODAY } })
    expect(parseDescribeRequest({ text: 'Cab 840', currency: 'rupees', people: null, today: 'yesterday' }, TODAY)).toEqual({
      ok: true,
      input: { text: 'Cab 840', currency: null, people: [], today: TODAY },
    })
    const longName = 'x'.repeat(DESCRIBE_LIMITS.maxNameChars + 1)
    expect(parseDescribeRequest({ text: 'Cab 840', people: [longName, 'Sam'] }, TODAY)).toMatchObject({ ok: true, input: { people: ['Sam'] } })
  })

  it.each([
    [null, REQUEST_MESSAGES.malformed],
    [[], REQUEST_MESSAGES.malformed],
    [{}, REQUEST_MESSAGES.malformed],
    [{ text: 42 }, REQUEST_MESSAGES.malformed],
    [{ text: 'Cab', people: 'Riya' }, REQUEST_MESSAGES.malformed],
    [{ text: 'Cab', people: [1, 2] }, REQUEST_MESSAGES.malformed],
    [{ text: 'Cab', currency: 5 }, REQUEST_MESSAGES.malformed],
    [{ text: '' }, REQUEST_MESSAGES.empty],
    [{ text: '   \n ' }, REQUEST_MESSAGES.empty],
    [{ text: 'x'.repeat(DESCRIBE_LIMITS.maxTextChars + 1) }, REQUEST_MESSAGES.tooLong],
    [{ text: 'Cab', people: Array.from({ length: DESCRIBE_LIMITS.maxPeople + 1 }, (_, i) => `P${i}`) }, REQUEST_MESSAGES.tooManyPeople],
  ])('rejects %j', (body, message) => {
    expect(parseDescribeRequest(body, TODAY)).toEqual({ ok: false, message })
  })

  it('counts characters, not UTF-16 units, against the limit', () => {
    expect(parseDescribeRequest({ text: '₹'.repeat(DESCRIBE_LIMITS.maxTextChars) }, TODAY).ok).toBe(true)
    expect(parseDescribeRequest({ text: '🍕'.repeat(DESCRIBE_LIMITS.maxTextChars) }, TODAY).ok).toBe(true)
  })
})

/* ---------------------------------------------------------------- live model replies */

/** Real replies from nvidia/nemotron-3.5-lightning-30b-a3b (and Omni, last), recorded while tuning the prompt. */
const LIVE: ReadonlyArray<{ text: string; known: string[]; raw: Record<string, unknown>; expected: DescribedSplit }> = [
  {
    text: 'Cab 840 with Riya and Sam, Sam pays double',
    known: ['Riya Sharma', 'Sam', 'Aditya', 'Neha'],
    raw: reply({ title: 'Cab', category: 'transport', amount: 840, mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }, { name: 'Sam', value: 2 }] }),
    expected: {
      title: 'Cab',
      category: 'transport',
      amount: 840,
      currency: null,
      mode: 'shares',
      payer: null,
      people: [
        { name: 'Me', value: 1 },
        { name: 'Riya Sharma', value: 1 },
        { name: 'Sam', value: 2 },
      ],
      headcount: null,
      date: null,
    },
  },
  {
    text: 'Rent 32000 me 40% Aditya 30% Neha 30%',
    known: ['Riya Sharma', 'Sam', 'Aditya', 'Neha'],
    raw: reply({ title: 'Rent', category: 'rent', amount: 32000, mode: 'percent', people: [{ name: 'Me', value: 40 }, { name: 'Aditya', value: 30 }, { name: 'Neha', value: 30 }] }),
    expected: {
      title: 'Rent',
      category: 'rent',
      amount: 32000,
      currency: null,
      mode: 'percent',
      payer: null,
      people: [
        { name: 'Me', value: 40 },
        { name: 'Aditya', value: 30 },
        { name: 'Neha', value: 30 },
      ],
      headcount: null,
      date: null,
    },
  },
  {
    text: 'Netflix 649 for 4',
    known: [],
    raw: reply({ title: 'Netflix', category: 'subscription', amount: 649, people: [{ name: 'Me', value: null }], headcount: 4 }),
    expected: { title: 'Netflix', category: 'subscription', amount: 649, currency: null, mode: 'equal', payer: null, people: [{ name: 'Me', value: null }], headcount: 4, date: null },
  },
  {
    // The model invented "INR" and missed that "paid …" means the speaker paid.
    text: 'paid 2.4k for dinner at toit yesterday with riya, sam and adi',
    known: ['Riya Sharma', 'Sam', 'Aditya'],
    raw: reply({
      title: 'Dinner at Toit',
      currency: 'INR',
      people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }, { name: 'Sam', value: null }, { name: 'Aditya', value: null }],
      date: '2026-10-20',
    }),
    expected: {
      title: 'Dinner at Toit',
      category: 'food',
      amount: 2400,
      currency: null,
      mode: 'equal',
      payer: 'Me',
      people: [
        { name: 'Me', value: null },
        { name: 'Riya Sharma', value: null },
        { name: 'Sam', value: null },
        { name: 'Aditya', value: null },
      ],
      headcount: null,
      date: '2026-10-20',
    },
  },
  {
    text: 'Goa trip hotel ₹18,500 — Riya paid, split between me, Riya, Sam and Neha',
    known: ['Riya Sharma', 'Sam'],
    raw: reply({
      title: 'Goa trip hotel',
      category: 'travel',
      amount: 18500,
      currency: 'INR',
      payer: 'Riya',
      people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }, { name: 'Sam', value: null }, { name: 'Neha', value: null }],
      headcount: 4,
    }),
    expected: {
      title: 'Goa Trip Hotel',
      category: 'travel',
      amount: 18500,
      currency: 'INR',
      mode: 'equal',
      payer: 'Riya Sharma',
      people: [
        { name: 'Me', value: null },
        { name: 'Riya Sharma', value: null },
        { name: 'Sam', value: null },
        { name: 'Neha', value: null },
      ],
      headcount: 4,
      date: null,
    },
  },
  {
    text: 'Groceries 1260: Riya 500, Sam 400, rest me',
    known: [],
    raw: reply({ title: 'Groceries', category: 'groceries', amount: 1260, mode: 'exact', people: [{ name: 'Me', value: null }, { name: 'Riya', value: 500 }, { name: 'Sam', value: 400 }] }),
    expected: {
      title: 'Groceries',
      category: 'groceries',
      amount: 1260,
      currency: null,
      mode: 'exact',
      payer: null,
      people: [
        { name: 'Me', value: 360 },
        { name: 'Riya', value: 500 },
        { name: 'Sam', value: 400 },
      ],
      headcount: null,
      date: null,
    },
  },
  {
    // The model said the speaker paid; the text says Kabir did. It also invented "INR".
    text: 'wifi bill 1179 with flatmates kabir and zoya, kabir covered it last friday',
    known: [],
    raw: reply({ title: 'wifi bill', category: 'utilities', amount: 1179, currency: 'INR', payer: 'Me', people: [{ name: 'Me', value: null }, { name: 'kabir', value: null }, { name: 'zoya', value: null }] }),
    expected: {
      title: 'Wifi Bill',
      category: 'utilities',
      amount: 1179,
      currency: null,
      mode: 'equal',
      payer: 'Kabir',
      people: [
        { name: 'Me', value: null },
        { name: 'Kabir', value: null },
        { name: 'Zoya', value: null },
      ],
      headcount: null,
      date: '2026-10-16',
    },
  },
  {
    text: 'Movie tickets 900 for Riya and Sam only, I paid',
    known: ['Riya Sharma', 'Sam'],
    raw: reply({ title: 'Movie tickets', category: 'entertainment', amount: 900, payer: 'Me' }),
    expected: {
      title: 'Movie Tickets',
      category: 'entertainment',
      amount: 900,
      currency: null,
      mode: 'equal',
      payer: 'Me',
      people: [
        { name: 'Riya Sharma', value: null },
        { name: 'Sam', value: null },
      ],
      headcount: null,
      date: null,
    },
  },
  {
    // The model made up "Person 3" for the unnamed third person.
    text: 'Lunch 600 split 3 ways, Arjun picked up the tab',
    known: [],
    raw: reply({ title: 'Lunch', amount: 600, payer: 'Arjun', people: [{ name: 'Me', value: null }, { name: 'Arjun', value: null }, { name: 'Person 3', value: null }], headcount: 3 }),
    expected: {
      title: 'Lunch',
      category: 'food',
      amount: 600,
      currency: null,
      mode: 'equal',
      payer: 'Arjun',
      people: [
        { name: 'Me', value: null },
        { name: 'Arjun', value: null },
      ],
      headcount: 3,
      date: null,
    },
  },
  {
    text: 'Uber 450 with Priya, I pay 60% she pays 40%',
    known: [],
    raw: reply({ title: 'Uber', category: 'transport', amount: 450, mode: 'percent', people: [{ name: 'Me', value: 60 }, { name: 'Priya', value: 40 }] }),
    expected: {
      title: 'Uber',
      category: 'transport',
      amount: 450,
      currency: null,
      mode: 'percent',
      payer: null,
      people: [
        { name: 'Me', value: 60 },
        { name: 'Priya', value: 40 },
      ],
      headcount: null,
      date: null,
    },
  },
  {
    // nvidia/nemotron-3-nano-omni-30b-a3b-reasoning (the fallback model)
    text: 'Cab 840 with riya and sam, sam pays double, I paid',
    known: ['Riya Sharma', 'Sam'],
    raw: reply({ title: 'Cab', category: 'transport', amount: 840, payer: 'Me', mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }, { name: 'Sam', value: 2 }] }),
    expected: {
      title: 'Cab',
      category: 'transport',
      amount: 840,
      currency: null,
      mode: 'shares',
      payer: 'Me',
      people: [
        { name: 'Me', value: 1 },
        { name: 'Riya Sharma', value: 1 },
        { name: 'Sam', value: 2 },
      ],
      headcount: null,
      date: null,
    },
  },
]

describe('normalizeDescribed — live replies', () => {
  it.each(LIVE.map((entry) => [entry.text, entry] as const))('%s', (_text, { text, known, raw, expected }) => {
    expect(split(raw, input(text, known))).toEqual(expected)
  })

  it('"what\'s the weather" is not a split', () => {
    const raw = reply({ isExpense: false, title: '', category: 'other', amount: null, people: [] })
    expect(normalizeDescribed(raw, input("what's the weather tomorrow"))).toEqual({ kind: 'not_a_split' })
  })
})

/* ---------------------------------------------------------------- what the model may claim */

describe('normalizeDescribed — currency and payer only from the text', () => {
  it('drops a currency the text never names, and finds the one it does', () => {
    expect(split(reply({ currency: 'USD' }), input('Dinner 2400 with Riya and Sam')).currency).toBeNull()
    expect(split(reply({ currency: null }), input('Dinner $24 with Riya and Sam', [], 'SGD')).currency).toBe('SGD')
    expect(split(reply({ currency: 'INR' }), input('Dinner €24 with Riya and Sam')).currency).toBe('EUR')
  })

  it('drops a payer when nobody said who paid — "pays double" is about shares', () => {
    const raw = reply({ payer: 'Sam', mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }, { name: 'Sam', value: 2 }] })
    expect(split(raw, input('Cab 840 with Riya and Sam, Sam pays double')).payer).toBeNull()
  })

  it('keeps a payer the text names, spelled like the person in the split', () => {
    expect(split(reply({ payer: 'riya' }), input('Dinner 2400 with Riya and Sam, riya paid')).payer).toBe('Riya')
    expect(split(reply({ payer: 'Riya' }), input('Dinner 2400 with Riya and Sam, Riya paid', ['Riya Sharma'])).payer).toBe('Riya Sharma')
  })

  it('takes "Me" as the payer only when the speaker speaks for themselves', () => {
    expect(split(reply({ payer: 'Me' }), input('Dinner 2400 with Riya and Sam, I paid')).payer).toBe('Me')
    expect(split(reply({ payer: 'I' }), input('Dinner 2400 with Riya and Sam, on me')).payer).toBe('Me')
    expect(split(reply({ payer: 'Me' }), input('Dinner 2400 Riya and Sam, one of them paid')).payer).toBeNull()
  })

  it('keeps a payer from the model who is named but not sharing', () => {
    const raw = reply({ payer: 'Riya', people: [{ name: 'Sam', value: null }, { name: 'Me', value: null }] })
    expect(split(raw, input('Riya paid 900 for Sam and me'))).toMatchObject({ payer: 'Riya' })
  })

  it('drops a payer the text never mentions', () => {
    expect(split(reply({ payer: 'Kabir' }), input('Dinner 2400 with Riya and Sam, someone paid')).payer).toBeNull()
  })
})

describe('normalizeDescribed — people', () => {
  it('drops people the text never mentions (including known people the model added)', () => {
    const raw = reply({ people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }, { name: 'Aditya', value: null }, { name: 'Friend 2', value: null }] })
    expect(people(split(raw, input('Dinner 2400 with Riya', ['Aditya'])))).toEqual(['Me', 'Riya'])
  })

  it('maps "me / I / myself / we" to Me, splits "Riya and Sam", and de-duplicates', () => {
    const raw = reply({ people: [{ name: 'myself', value: null }, { name: 'Riya and Sam', value: null }, { name: 'riya', value: null }, { name: 'I', value: null }, { name: 'we', value: null }] })
    expect(people(split(raw, input('Dinner 2400 with Riya and Sam')))).toEqual(['Me', 'Riya', 'Sam'])
  })

  it('tidies names: "@riya\'s" → Riya, lower case capitalised, deliberate casing kept, long names cut', () => {
    const raw = reply({ people: [{ name: "@riya's", value: null }, { name: 'mcDonald', value: null }, { name: 'x'.repeat(60), value: null }] })
    const result = split(raw, input(`Dinner 2400 riya mcdonald ${'x'.repeat(60)}`))
    expect(result.people.map((person) => person.name)).toEqual(['Riya', 'mcDonald', 'X'.padEnd(40, 'x')])
  })

  it('adds Me when the speaker takes part and the model forgot', () => {
    expect(people(split(reply({ people: [{ name: 'Riya', value: null }, { name: 'Sam', value: null }] }), input('Dinner 2400 with Riya and Sam')))).toEqual([
      'Me',
      'Riya',
      'Sam',
    ])
  })

  it('takes Me out when the speaker says they are out', () => {
    expect(people(split(reply(), input('Dinner 2400 for Riya and Sam, not me')))).toEqual(['Riya', 'Sam'])
  })

  it('splits between just the speaker when nobody else is named', () => {
    expect(people(split(reply({ people: [] }), input('Uber 300')))).toEqual(['Me'])
  })

  it('reads people written as plain names or as a { name: value } map', () => {
    expect(people(split(reply({ people: ['Me', 'Riya'] }), input('Dinner 2400 with Riya')))).toEqual(['Me', 'Riya'])
    expect(people(split(reply({ mode: 'shares', people: { Me: 1, Riya: 2 } }), input('Dinner 2400 with Riya, she pays double')))).toEqual(['Me:1', 'Riya:2'])
  })

  it('keeps at most 50 people', () => {
    const names = Array.from({ length: 70 }, (_, i) => `Friend${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`)
    const raw = reply({ people: names.map((name) => ({ name, value: null })) })
    expect(split(raw, input(`Party 9000 with ${names.join(' ')}`)).people).toHaveLength(DESCRIBE_LIMITS.maxPeople)
  })
})

describe('normalizeDescribed — modes and values', () => {
  const three = (values: unknown[]) => values.map((value, i) => ({ name: ['Me', 'Riya', 'Sam'][i], value }))
  const text = 'Dinner 2400 with Riya and Sam'

  it('clears values for equal splits', () => {
    expect(people(split(reply({ mode: 'equal', people: three([1, 2, 3]) }), input(text)))).toEqual(['Me', 'Riya', 'Sam'])
  })

  it('turns weights into small whole numbers, and equal weights into an equal split', () => {
    expect(people(split(reply({ mode: 'shares', people: three([1.5, 1, 1]) }), input(text)))).toEqual(['Me:3', 'Riya:2', 'Sam:2'])
    expect(people(split(reply({ mode: 'shares', people: three([4, 2, 2]) }), input(text)))).toEqual(['Me:2', 'Riya:1', 'Sam:1'])
    expect(people(split(reply({ mode: 'shares', people: three([null, -1, 2]) }), input(text)))).toEqual(['Me:1', 'Riya:1', 'Sam:2'])
    const even = split(reply({ mode: 'shares', people: three([2, 2, 2]) }), input(text))
    expect(even.mode).toBe('equal')
    expect(people(even)).toEqual(['Me', 'Riya', 'Sam'])
  })

  it('keeps percentages that add up to 100 and fills in the one left out', () => {
    expect(people(split(reply({ mode: 'percent', people: three([50, 30, 20]) }), input(text)))).toEqual(['Me:50', 'Riya:30', 'Sam:20'])
    expect(people(split(reply({ mode: 'percent', people: three([50, 30, null]) }), input(text)))).toEqual(['Me:50', 'Riya:30', 'Sam:20'])
    expect(people(split(reply({ mode: 'percent', people: three([0.5, 0.3, 0.2]) }), input(text)))).toEqual(['Me:50', 'Riya:30', 'Sam:20'])
    expect(people(split(reply({ mode: 'percent', people: three(['50%', '30 %', 20]) }), input(text)))).toEqual(['Me:50', 'Riya:30', 'Sam:20'])
    expect(people(split(reply({ mode: 'percent', people: three([33.33, 33.33, 33.34]) }), input(text)))).toEqual(['Me:33.33', 'Riya:33.33', 'Sam:33.34'])
  })

  it('falls back to an equal split when percentages do not add up (or are all the same)', () => {
    for (const values of [
      [50, 30, 30],
      [50, null, null],
      [120, -10, -10],
      [33.33, 33.33, 33.33],
    ]) {
      const result = split(reply({ mode: 'percent', people: three(values) }), input(text))
      expect(result.mode).toBe('equal')
      expect(people(result)).toEqual(['Me', 'Riya', 'Sam'])
    }
  })

  it('keeps exact amounts, fills in the one left out, and keeps a gap for the editor to show', () => {
    expect(people(split(reply({ mode: 'exact', people: three([1000, 800, 600]) }), input(text)))).toEqual(['Me:1000', 'Riya:800', 'Sam:600'])
    expect(people(split(reply({ mode: 'exact', people: three([null, 800, 600]) }), input(text)))).toEqual(['Me:1000', 'Riya:800', 'Sam:600'])
    const gap = split(reply({ mode: 'exact', people: three([500, 800, 600]) }), input(text))
    expect(gap).toMatchObject({ mode: 'exact', amount: 2400 })
    expect(people(gap)).toEqual(['Me:500', 'Riya:800', 'Sam:600'])
    expect(people(split(reply({ mode: 'exact', people: three([null, null, 600]) }), input(text)))).toEqual(['Me', 'Riya', 'Sam:600'])
  })

  it('takes the sum of exact amounts as the total when none was given', () => {
    expect(split(reply({ amount: null, mode: 'exact', people: three([100, 250.5, 49.5]) }), input('Riya 250.5, Sam 49.5, me 100'))).toMatchObject({
      amount: 400,
      mode: 'exact',
    })
  })

  it('treats exact with no amounts at all as an equal split', () => {
    expect(split(reply({ mode: 'exact', people: three([null, null, null]) }), input(text)).mode).toBe('equal')
  })

  it('works out the mode from the values when the model names an odd one', () => {
    expect(split(reply({ mode: 'equally', people: three([1, 1, 1]) }), input(text)).mode).toBe('equal')
    expect(split(reply({ mode: 'percentage', people: three([50, 25, 25]) }), input(text)).mode).toBe('percent')
    expect(split(reply({ mode: 'weights', people: three([2, 1, 1]) }), input(text)).mode).toBe('shares')
    expect(split(reply({ mode: '?', people: three([1200, 600, 600]) }), input(text)).mode).toBe('exact')
    expect(split(reply({ mode: '?', people: three([50, 25, 25]) }), input(text)).mode).toBe('percent')
    expect(split(reply({ mode: '?', people: three([2, 1, 1]) }), input(text)).mode).toBe('shares')
    expect(split(reply({ mode: undefined, people: three([null, null, null]) }), input(text)).mode).toBe('equal')
  })
})

describe('normalizeDescribed — title, amount, category, headcount, date', () => {
  it('tidies the title: no people, no amount, Title Case for lower-case text', () => {
    expect(split(reply({ title: 'dinner with riya and sam' }), input('dinner 2400 with riya and sam')).title).toBe('Dinner')
    expect(split(reply({ title: 'Cab 840', amount: 840 }), input('cab 840 with riya')).title).toBe('Cab')
    expect(split(reply({ title: 'Dinner ₹2,400' }), input('dinner ₹2,400 with riya')).title).toBe('Dinner')
    expect(split(reply({ title: 'pizza 2.4k' }), input('pizza 2.4k with riya')).title).toBe('Pizza')
    expect(split(reply({ title: 'Goa trip 2026' }), input('goa trip 2026 18500 with riya')).title).toBe('Goa Trip 2026')
    expect(split(reply({ title: 'iPhone case' }), input('iphone case 900 with riya')).title).toBe('iPhone Case')
  })

  it('falls back to a title from the category', () => {
    expect(split(reply({ title: '', category: 'transport' }), input('840 with riya')).title).toBe('Ride')
    expect(split(reply({ title: '2400', category: 'other' }), input('2400 with riya')).title).toBe('Expense')
  })

  it('drops an amount when the text gives no number at all', () => {
    const result = split(reply({ amount: 2400 }), input('Dinner with Riya and Sam'))
    expect(result.amount).toBeNull()
  })

  it('reads amounts written as text and rejects impossible ones', () => {
    expect(split(reply({ amount: '₹2,400.50' }), input('dinner 2400.50 with riya')).amount).toBe(2400.5)
    expect(split(reply({ amount: -5 }), input('dinner 5 with riya')).amount).toBeNull()
    expect(split(reply({ amount: 5e12 }), input('dinner 5 with riya')).amount).toBeNull()
  })

  it('fills in a category the model left out from the title or the text', () => {
    expect(split(reply({ category: 'Dining out' }), input('dinner 2400 with riya')).category).toBe('food')
    expect(split(reply({ category: null, title: 'Uber' }), input('uber 300 with riya')).category).toBe('transport')
    expect(split(reply({ category: null, title: 'Stuff' }), input('blinkit 300 with riya')).category).toBe('groceries')
    expect(split(reply({ category: 'misc', title: 'Stuff' }), input('stuff 300 with riya')).category).toBe('other')
  })

  it('keeps a headcount the text backs up and that fits the people named', () => {
    expect(split(reply({ headcount: 5 }), input('dinner 2400 with riya and sam, 5 of us')).headcount).toBe(5)
    expect(split(reply({ headcount: 2 }), input('dinner 2400 with riya and sam')).headcount).toBeNull()
    expect(split(reply({ headcount: 1.5 }), input('dinner 2400 with riya and sam')).headcount).toBeNull()
    expect(split(reply({ headcount: 4, amount: null }), input('pizza with riya and sam for four')).headcount).toBe(4)
  })

  it('counts the speaker in a headcount unless they are out', () => {
    expect(people(split(reply({ people: [], headcount: 4 }), input('Netflix 649 for 4')))).toEqual(['Me'])
    expect(people(split(reply({ people: [{ name: 'Riya', value: null }], headcount: 2 }), input('Netflix 649 for 2, Riya and')))).toEqual(['Me', 'Riya'])
  })

  it('works the date out from the text, and drops one the text never names', () => {
    expect(split(reply({ date: null }), input('dinner 2400 with riya yesterday')).date).toBe('2026-10-20')
    expect(split(reply({ date: '2026-10-19' }), input('dinner 2400 with riya yesterday')).date).toBe('2026-10-20')
    expect(split(reply({ date: '2026-10-01' }), input('dinner 2400 with riya')).date).toBeNull()
  })

  it("uses the model's date for a day only it could pin down, if it isn't in the future", () => {
    expect(split(reply({ date: '2026-10-14' }), input('dinner on 31 Feb with riya 2400')).date).toBe('2026-10-14')
    expect(split(reply({ date: '2026-12-25' }), input('dinner on 31 Feb with riya 2400')).date).toBeNull()
    expect(split(reply({ date: 'last week' }), input('dinner on 31 Feb with riya 2400')).date).toBeNull()
  })
})

describe('normalizeDescribed — not a split', () => {
  it('says so when the model says so', () => {
    expect(normalizeDescribed(reply({ isExpense: false }), input('hello'))).toEqual({ kind: 'not_a_split' })
    expect(normalizeDescribed(reply({ isExpense: 'no' }), input('hello'))).toEqual({ kind: 'not_a_split' })
  })

  it('says so when there is nothing to split: no amount, nobody else, no count', () => {
    expect(normalizeDescribed(reply({ amount: null, people: [{ name: 'Me', value: null }] }), input('dinner'))).toEqual({ kind: 'not_a_split' })
    expect(normalizeDescribed('not an object', input('dinner'))).toEqual({ kind: 'not_a_split' })
    expect(normalizeDescribed(null, input('dinner'))).toEqual({ kind: 'not_a_split' })
  })

  it('still drafts a split with people but no amount', () => {
    expect(split(reply({ amount: null }), input('dinner with Riya and Sam'))).toMatchObject({ amount: null, people: [{ name: 'Me' }, { name: 'Riya' }, { name: 'Sam' }] })
  })

  it('reads keys under other names', () => {
    const raw = { is_expense: 'true', description: 'Cab', type: 'Taxi', total: '840', paid_by: null, split_type: 'equal', participants: ['me', 'Riya'] }
    expect(split(raw, input('cab 840 with riya'))).toMatchObject({ title: 'Cab', category: 'transport', amount: 840, mode: 'equal', people: [{ name: 'Me' }, { name: 'Riya' }] })
  })
})

describe('looksLikeDescribe / isAcceptableDescribe', () => {
  it('finds the answer object, never an echoed schema', () => {
    expect(looksLikeDescribe({ isExpense: true })).toBe(true)
    expect(looksLikeDescribe({ participants: [] })).toBe(true)
    expect(looksLikeDescribe({ type: 'object', properties: { people: {} } })).toBe(false)
    expect(looksLikeDescribe({ name: 'Riya', value: 1 })).toBe(false)
  })

  it('accepts a usable split or a confident "not an expense", and asks another model otherwise', () => {
    expect(isAcceptableDescribe(reply(), input('Dinner 2400 with Riya and Sam'))).toBe(true)
    expect(isAcceptableDescribe(reply({ isExpense: false }), input('hi'))).toBe(true)
    expect(isAcceptableDescribe(reply({ amount: null, people: [] }), input('dinner'))).toBe(false)
    expect(isAcceptableDescribe('junk', input('dinner'))).toBe(false)
  })
})

/* ---------------------------------------------------------------- calling the models */

describe('describeSplit', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    forgetPromptOnlyModels()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const cab = input('Cab 840 with Riya and Sam, Sam pays double', ['Riya Sharma'])
  const cabReply = reply({ title: 'Cab', amount: 840, mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }, { name: 'Sam', value: 2 }] })

  it('asks the first text model and returns the checked split', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(cabReply))
    const result = await describeSplit(testConfig(), cab)
    expect(result.model).toBe('nvidia/nemotron-test-text')
    expect(result.outcome).toMatchObject({ kind: 'split', split: { title: 'Cab', mode: 'shares', people: [{ name: 'Me' }, { name: 'Riya Sharma' }, { name: 'Sam' }] } })
    const body = sentBody(fetchMock)
    expect(body).toMatchObject({ model: 'nvidia/nemotron-test-text', max_tokens: 800, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } })
    expect(JSON.stringify(body.messages)).toContain('Cab 840 with Riya and Sam, Sam pays double')
  })

  it('tries the next model when the first answers with nothing usable, and when it is out of capacity', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(reply({ amount: null, people: [] }))).mockResolvedValueOnce(chatResponse(cabReply))
    expect((await describeSplit(testConfig(), cab)).model).toBe('meta/llama-test-text')

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(errorResponse(503, 'ResourceExhausted')).mockResolvedValueOnce(chatResponse(cabReply))
    expect((await describeSplit(testConfig(), cab)).model).toBe('meta/llama-test-text')
  })

  it('stops at a confident "not an expense"', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(reply({ isExpense: false })))
    expect(await describeSplit(testConfig(), input('hello there'))).toEqual({ outcome: { kind: 'not_a_split' }, model: 'nvidia/nemotron-test-text' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reads JSON out of prose and fences', async () => {
    fetchMock.mockResolvedValueOnce(chatResponse(`Here is the split:\n\`\`\`json\n${JSON.stringify(cabReply)}\n\`\`\``))
    expect((await describeSplit(testConfig(), cab)).outcome.kind).toBe('split')
  })

  it('throws UpstreamError when every model fails', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'down'))
    await expect(describeSplit(testConfig(), cab)).rejects.toBeInstanceOf(UpstreamError)
  })

  it('gives up within the describe budget', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
        }),
    )
    const started = Date.now()
    const pending = describeSplit(testConfig({ describeTimeoutMs: 20_000, textModels: ['a', 'b', 'c'] }), cab).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(DESCRIBE_BUDGET_MS + 1_000)
    const error = await pending
    expect(error).toBeInstanceOf(UpstreamError)
    expect((error as UpstreamError).kind).toBe('timeout')
    expect(Date.now() - started).toBeLessThanOrEqual(DESCRIBE_BUDGET_MS + 1_000)
    expect(fetchMock).toHaveBeenCalledTimes(2) // 20 s, then the 10 s that were left
  })
})
