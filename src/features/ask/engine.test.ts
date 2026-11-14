import { describe, expect, it } from 'vitest'
import type { Expense } from '../../domain/types'
import { askExamples, headline, understoodParts } from './askText'
import { ask, nameMatch, normalize, readQuestion, type AskIntent, type AskAnswer } from './engine'
import { DATA, EXPENSES } from './fixture'

interface Case {
  q: string
  intent: AskIntent
  amount?: number | null
  count?: number
  group?: string | null
  friend?: string | null
  category?: string | null
  range?: string | null
  who?: 'me' | 'we'
  leftOut?: string[]
  rows?: string[]
  head?: string
}

/*
 * The fixture, worked out by hand:
 * - Goa trip: I’m ₹2,700 down (₹800 fronted for dinner, ₹3,200 of shares, Riya’s ₹300 to me); simplified, I pay Sam ₹2,700.
 * - Flat 302: Neha owes me ₹13,800; plus ₹450 for groceries outside the group: ₹14,250.
 * - Arjun owes me ₹400 for the movie and ₹5,000 lent: ₹5,400. Riya owes me ฿1,000 (another currency).
 */
const CASES: Case[] = [
  // what's owed to me
  { q: 'Who owes me?', intent: 'owedToMe', amount: 1_965_000, count: 2, rows: ['Neha', 'Arjun'], leftOut: ['THB'], head: '₹19,650 is owed to you by 2 people' },
  { q: 'how much am I owed', intent: 'owedToMe', amount: 1_965_000 },
  { q: 'total to collect', intent: 'owedToMe', amount: 1_965_000 },
  { q: 'kisne mujhe paise dene hai', intent: 'owedToMe', amount: 1_965_000 },
  { q: 'mujhe kitna lena hai', intent: 'owedToMe', amount: 1_965_000 },
  { q: 'who owes me the most?', intent: 'owedToMe', rows: ['Neha', 'Arjun'] },
  // what I owe
  { q: 'What do I owe?', intent: 'iOwe', amount: 270_000, count: 1, rows: ['Sam'], head: 'You owe ₹2,700 to 1 person' },
  { q: 'whom do I owe money', intent: 'iOwe', amount: 270_000 },
  { q: 'mujhe kitna dena hai', intent: 'iOwe', amount: 270_000 },
  { q: 'how much do I have to pay back', intent: 'iOwe', amount: 270_000 },
  // one friend
  { q: 'How much does Sam owe me?', intent: 'friendOwesMe', friend: 'sam', amount: -270_000, rows: ['Goa trip'], head: 'You owe Sam ₹2,700' },
  { q: 'how much do I owe Sam', intent: 'iOweFriend', friend: 'sam', amount: -270_000 },
  { q: 'Neha ne kitna dena hai', intent: 'friendOwesMe', friend: 'neha', amount: 1_425_000, head: 'Neha owes you ₹14,250' },
  { q: 'Arjun se kitna lena hai', intent: 'friendOwesMe', friend: 'arjun', amount: 540_000 },
  { q: 'Sam ko kitna dena hai', intent: 'iOweFriend', friend: 'sam', amount: -270_000 },
  { q: 'Arjn owes me?', intent: 'friendOwesMe', friend: 'arjun', amount: 540_000 },
  { q: 'how much does Nehaa owe', intent: 'friendOwesMe', friend: 'neha', amount: 1_425_000 },
  { q: 'Riya', intent: 'friendOwesMe', friend: 'riya', amount: 0, leftOut: ['THB'], head: 'You and Riya Sharma are square' },
  { q: 'balance with riya sharma', intent: 'friendOwesMe', friend: 'riya', amount: 0 },
  { q: "what's my hisaab with Sam's", intent: 'friendOwesMe', friend: 'sam', amount: -270_000 },
  // spending
  { q: 'How much did I spend this month?', intent: 'spent', who: 'me', range: 'thisMonth', amount: 1_903_000, count: 6, leftOut: ['THB'], head: 'Your share came to ₹19,030, across 6 expenses' },
  { q: 'how much did we spend in Goa', intent: 'spent', who: 'we', group: 'goa', amount: 1_080_000, count: 3, rows: ['Villa', 'Dinner at Thalassa', 'Scooter rent'], head: '₹10,800 spent in all, across 3 expenses' },
  { q: 'how much did I spend in goa', intent: 'spent', who: 'me', group: 'goa', amount: 360_000 },
  { q: 'how much did I spend on food', intent: 'spent', category: 'food', amount: 68_000, count: 3, leftOut: ['THB'] },
  { q: 'how much on food in goa this month', intent: 'spent', who: 'we', category: 'food', group: 'goa', range: 'thisMonth', amount: 120_000, count: 1 },
  { q: 'how much did I spend last month', intent: 'spent', range: 'lastMonth', amount: 195_000, count: 2 },
  { q: 'spending in october', intent: 'spent', range: 'month', amount: 195_000 },
  { q: 'how much did I spend in Sept', intent: 'spent', range: 'month', amount: 45_000 },
  { q: 'how much did I spend with Sam', intent: 'spent', friend: 'sam', who: 'me', amount: 438_000, count: 5 },
  { q: 'how much did we spend with Sam', intent: 'spent', friend: 'sam', who: 'we', amount: 1_236_000 },
  { q: 'how much did I spend today', intent: 'spent', range: 'today', amount: 40_000, count: 1 },
  { q: 'what did I spend yesterday', intent: 'spent', range: 'yesterday', amount: 3_000 },
  { q: 'how much did I spend this week', intent: 'spent', range: 'thisWeek', amount: 43_000, leftOut: [] },
  { q: 'how much did I spend last week', intent: 'spent', range: 'lastWeek', amount: 360_000, leftOut: ['THB'] },
  { q: 'how much did I spend this year', intent: 'spent', range: 'thisYear', amount: 2_158_000 },
  { q: 'how much did I spend last year', intent: 'spent', range: 'lastYear', amount: 25_000 },
  { q: 'maine kitna kharcha kiya', intent: 'spent', who: 'me', amount: 2_183_000 },
  { q: 'Goa mein kitna kharcha hua', intent: 'spent', who: 'we', group: 'goa', amount: 1_080_000 },
  { q: 'how much rent did I pay', intent: 'spent', category: 'rent', amount: 1_500_000 },
  { q: 'how much did I spend on cabs', intent: 'spent', category: 'transport', amount: 95_000 },
  { q: 'how much did we spend in Manaali', intent: 'spent', group: 'manali', amount: 30_000 },
  { q: 'how much did I spend in may 2026', intent: 'spent', range: 'month', amount: 0, count: 0, head: 'Nothing spent that matches' },
  // the biggest
  { q: 'what’s my biggest expense', intent: 'biggest', amount: 3_000_000, head: 'The biggest was Rent November: ₹30,000, 1 Nov' },
  { q: 'biggest expense in goa', intent: 'biggest', group: 'goa', amount: 900_000, rows: ['Villa', 'Dinner at Thalassa', 'Scooter rent'] },
  { q: 'most expensive thing on food', intent: 'biggest', category: 'food', amount: 120_000 },
  { q: 'sabse bada kharcha', intent: 'biggest', amount: 3_000_000 },
  // payments
  { q: 'When did Sam last pay me?', intent: 'lastPaidByFriend', friend: 'sam', amount: 75_000, rows: ['Cab to airport'], head: 'Sam last paid you ₹750, 25 Oct' },
  { q: 'when did I last pay Sam', intent: 'lastPaidToFriend', friend: 'sam', amount: 3_000, head: 'You last paid Sam ₹30, Yesterday' },
  { q: 'last time Riya paid', intent: 'lastPaidByFriend', friend: 'riya', amount: 30_000, rows: ['Goa trip'] },
  { q: 'when did Neha last pay me', intent: 'lastPaidByFriend', friend: 'neha', amount: null, head: 'Neha hasn’t paid you back here yet' },
  { q: 'Sam ne kab diya', intent: 'lastPaidByFriend', friend: 'sam', amount: 75_000 },
  // how many
  { q: 'How many expenses in Goa?', intent: 'count', group: 'goa', count: 3, head: '3 expenses' },
  { q: 'how many expenses this month', intent: 'count', range: 'thisMonth', count: 7 },
  { q: 'kitne bills is mahine', intent: 'count', range: 'thisMonth', count: 7 },
  // who paid the most
  { q: 'Who paid the most in Goa?', intent: 'topPayer', group: 'goa', amount: 900_000, rows: ['Sam', 'You', 'Riya Sharma'], head: 'Sam paid the most: ₹9,000' },
  { q: 'kisne sabse zyada pay kiya goa mein', intent: 'topPayer', group: 'goa', amount: 900_000 },
  // per day
  { q: 'What did I spend per day in Goa?', intent: 'perDay', who: 'me', group: 'goa', amount: 120_000, head: 'Your share: about ₹1,200 a day, over 3 days' },
  { q: 'how much did we spend per day in goa', intent: 'perDay', who: 'we', group: 'goa', amount: 360_000 },
  { q: 'what did I spend per day this month', intent: 'perDay', range: 'thisMonth', amount: 135_929 },
  // not understood
  { q: 'what’s the weather like', intent: 'unknown', head: 'I didn’t follow that one. I can answer questions like these:' },
  { q: 'tell me a joke', intent: 'unknown' },
  { q: '', intent: 'unknown' },
]

const names = DATA.nameOf!

describe('Ask Settle reads a question and answers it', () => {
  it.each(CASES)('$q', (c) => {
    const a = ask(c.q, DATA)
    expect(a.intent).toBe(c.intent)
    if (c.amount !== undefined) expect(a.amount).toBe(c.amount)
    if (c.count !== undefined) expect(a.count).toBe(c.count)
    if (c.group !== undefined) expect(a.filters.groupId).toBe(c.group)
    if (c.friend !== undefined) expect(a.filters.friendId).toBe(c.friend)
    if (c.category !== undefined) expect(a.filters.category).toBe(c.category)
    if (c.range !== undefined) expect(a.filters.range?.kind ?? null).toBe(c.range)
    if (c.who !== undefined) expect(a.filters.who).toBe(c.who)
    if (c.leftOut !== undefined) expect(a.leftOut).toEqual(c.leftOut)
    if (c.rows !== undefined) expect(a.rows.map((r) => r.title)).toEqual(c.rows)
    if (c.head !== undefined) expect(headline(a, DATA.today, names)).toBe(c.head)
    expect(a.rows.length).toBeLessThanOrEqual(5)
  })

  it('has a table of at least 40 questions', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40)
  })
})

describe('what it understood', () => {
  const parts = (q: string): string[] => understoodParts(ask(q, DATA), DATA, names)
  it('lists the reading, so a wrong one shows', () => {
    expect(parts('how much on food in goa this month')).toEqual(['Spending in all', 'Food & drinks', 'Goa trip', 'this month'])
    expect(parts('how much did I spend with Sam in october')).toEqual(['Your share of spending', 'with Sam', 'October 2026'])
    expect(parts('When did Sam last pay me?')).toEqual(['Last payment to you', 'from Sam'])
    expect(parts('Who owes me?')).toEqual(['Owed to you'])
    expect(parts('Riya')).toEqual(['Between you and Riya Sharma'])
  })
})

describe('names', () => {
  it('match exactly, by their start, or one letter off; short names only exactly', () => {
    expect(nameMatch('sam', 'sam')).toBe(3)
    expect(nameMatch('sa', 'sam')).toBe(0)
    expect(nameMatch('sma', 'sam')).toBe(0)
    expect(nameMatch('nehaa', 'neha')).toBe(1)
    expect(nameMatch('neh', 'neha')).toBe(2)
    expect(nameMatch('nea', 'neha')).toBe(1)
    expect(nameMatch('arjn', 'arjun')).toBe(1)
    expect(nameMatch('ajun', 'arjun')).toBe(1)
    expect(nameMatch('arpita', 'arjun')).toBe(0)
  })

  it('never takes a question word for a misspelt name', () => {
    const data = { ...DATA, friends: [...DATA.friends, { id: 'muchi', name: 'Muchi' }, { id: 'tota', name: 'Tota' }] }
    expect(ask('how much did I spend in total', data).filters.friendId).toBeNull()
  })

  it('a group’s name can be misspelt too, and its common words don’t pick it', () => {
    expect(readQuestion('spent in manli', DATA).filters.groupId).toBe('manali')
    expect(readQuestion('how much did we spend on the trip', DATA).filters.groupId).toBeNull()
    expect(readQuestion('how much did we spend in flat 302', DATA).filters.groupId).toBe('flat')
  })

  it('reads apostrophes and capitals the same', () => {
    expect(normalize('What’s SAM’S share?')).toBe('what sam share')
  })
})

describe('honest answers', () => {
  it('loans aren’t spending, but they are owed', () => {
    const all = ask('how much did I spend', DATA)
    expect(all.rows.map((r) => r.title)).not.toContain('Loan to Arjun')
    expect(ask('how much does Arjun owe me', DATA).amount).toBe(540_000)
  })

  it('rows go where they should', () => {
    expect(ask('Who owes me?', DATA).rows[0]?.path).toBe('/app/friends/neha')
    expect(ask('biggest expense in goa', DATA).rows[0]?.path).toBe('/app/expense/e2')
    expect(ask('last time Riya paid', DATA).rows[0]?.path).toBe('/app/groups/goa')
    expect(ask('Who paid the most in Goa?', DATA).rows.find((r) => r.title === 'You')?.path).toBeNull()
  })

  it('a group question counts in the group’s currency', () => {
    const data = { ...DATA, groups: DATA.groups.map((g) => (g.id === 'goa' ? { ...g, currency: 'THB' } : g)), expenses: EXPENSES.map((e): Expense => (e.groupId === 'goa' ? { ...e, currency: 'THB' } : e)) }
    const a = ask('how much did we spend in goa', data)
    expect(a.currency).toBe('THB')
    expect(a.amount).toBe(1_080_000)
  })

  it('with no data at all, every answer is a calm zero', () => {
    const empty = { ...DATA, expenses: [], groups: [] }
    const heads = ['Who owes me?', 'What do I owe?', 'how much did I spend', 'biggest expense', 'how many expenses', 'when did Sam last pay me'].map((q) => headline(ask(q, empty), DATA.today, names))
    expect(heads).toEqual(['Nobody owes you anything right now', 'You don’t owe anyone right now', 'Nothing spent that matches', 'No expenses match that', 'No expenses match that', 'Sam hasn’t paid you back here yet'])
  })
})

describe('example questions', () => {
  it('are built from real people and groups, and each one is understood', () => {
    const examples = askExamples(DATA)
    expect(examples).toEqual(['Who owes me?', 'How much does Neha owe me?', 'How much did we spend in Goa trip?', 'Biggest expense this month'])
    for (const q of askExamples(DATA, 6)) {
      const a: AskAnswer = ask(q, DATA)
      expect(a.intent, q).not.toBe('unknown')
    }
    expect(ask('How much did we spend in Goa trip?', DATA).filters.groupId).toBe('goa')
  })

  it('fall back to plain ones with nobody to name', () => {
    const examples = askExamples({ ...DATA, expenses: [], groups: [] })
    expect(examples).toEqual(['Who owes me?', 'What do I owe?', 'How much did I spend this month?', 'Biggest expense this month'])
  })
})
