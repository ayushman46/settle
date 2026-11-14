import { describe, expect, it } from 'vitest'
import type { Expense } from '../../domain/types'
import { answerLines, answerNotes, askExamples, headline, understoodParts } from './askText'
import { ask, MAX_LIST, nameMatch, normalize, readQuestion, type AskIntent, type AskAnswer } from './engine'
import { DATA, EXPENSES, TODAY } from './fixture'

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
  // "cabs" is a word in a title (Cab to airport), so it’s that, not every transport expense (the scooter isn’t a cab)
  { q: 'how much did I spend on cabs', intent: 'spent', category: null, amount: 75_000 },
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
    expect(a.rows.length).toBeLessThanOrEqual(MAX_LIST)
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

/*
 * What the customer panel asked, on a small book like theirs (worked out by hand):
 * - Goa trip (me, Riya, Sam, Karan): Hotel ₹6,000 I paid, Drinks ₹500 Sam paid, Dinner ₹1,200 Riya paid, all split 4 ways;
 *   Riya paid me ₹1,000. Balances: me +3,075, Riya +275, Sam −1,425, Karan −1,925.
 *   Simplified: Karan pays me ₹1,925, Sam pays me ₹1,150, Sam pays Riya ₹275.
 * - Outside groups: Movie ₹800 with Neha in October (Neha owes ₹400), Coffee ₹200 with Riya today (Riya owes ₹100).
 */
const base = EXPENSES[0]!
let made = 0
const bill = (id: string, title: string, total: number, date: string, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense => ({
  ...base,
  id,
  title,
  total,
  date,
  payerId,
  shares,
  participants: Object.keys(shares).map((friendId) => ({ friendId, input: null })),
  groupId: null,
  paidBack: {},
  createdAt: ++made,
  updatedAt: made,
  ...more,
})
const four = (each: number): Record<string, number> => ({ me: each, riya: each, sam: each, karan: each })
const PANEL_FRIENDS = [
  { id: 'me', name: 'Anjali' },
  { id: 'riya', name: 'Riya' },
  { id: 'sam', name: 'Sam' },
  { id: 'karan', name: 'Karan' },
  { id: 'neha', name: 'Neha' },
]
const PANEL: typeof DATA = {
  ...DATA,
  friends: PANEL_FRIENDS,
  groups: [{ ...DATA.groups[0]!, id: 'goa', name: 'Goa trip', memberIds: ['me', 'riya', 'sam', 'karan'], settlements: [{ id: 'p1', fromId: 'riya', toId: 'me', amount: 100_000, date: '2026-11-06', createdAt: 1, method: 'upi' }] }],
  expenses: [
    bill('h', 'Hotel', 600_000, '2026-11-05', 'me', four(150_000), { groupId: 'goa', category: 'travel' }),
    bill('d', 'Drinks', 50_000, '2026-11-05', 'sam', four(12_500), { groupId: 'goa', category: 'food' }),
    bill('n', 'Dinner', 120_000, '2026-11-06', 'riya', four(30_000), { groupId: 'goa', category: 'food' }),
    bill('m', 'Movie', 80_000, '2026-10-12', 'me', { me: 40_000, neha: 40_000 }, { category: 'entertainment' }),
    bill('c', 'Coffee', 20_000, TODAY, 'me', { me: 10_000, riya: 10_000 }, { category: 'food' }),
  ],
  nameOf: (id) => (id === 'me' ? 'You' : (PANEL_FRIENDS.find((f) => f.id === id)?.name ?? 'Someone')),
}
const panelNames = PANEL.nameOf!
const say = (q: string): string => headline(ask(q, PANEL), TODAY, panelNames)
const readAs = (q: string): string[] => understoodParts(ask(q, PANEL), PANEL, panelNames)

describe('what the customer panel found', () => {
  it('a group in an owing question scopes the answer to that group', () => {
    const a = ask('who owes me in Goa', PANEL)
    expect(a.intent).toBe('owedToMe')
    expect(a.amount).toBe(307_500)
    expect(a.rows.map((r) => [r.title, r.amount])).toEqual([
      ['Karan', 192_500],
      ['Sam', 115_000],
    ])
    expect(readAs('who owes me in Goa')).toEqual(['Owed to you', 'Goa trip'])
    // without the group: everyone, Neha and the coffee too
    expect(ask('who owes me', PANEL).amount).toBe(357_500)
    expect(ask('how much does Riya owe me in Goa', PANEL).amount).toBe(0)
    expect(ask('how much does Riya owe me', PANEL).amount).toBe(10_000)
    expect(readAs('how much does Sam owe me in goa trip')).toEqual(['Between you and Sam', 'Goa trip'])
  })

  it('an unknown name is said to be unknown, never swapped for a similar one', () => {
    const a = ask('how much does Priya owe me', PANEL)
    expect(a.intent).toBe('unknownPerson')
    expect(a.amount).toBeNull()
    expect(say('how much does Priya owe me')).toBe('I don’t know anyone called Priya')
    expect(say('Priya ne kitna dena hai')).toBe('I don’t know anyone called Priya')
    // a slip of one letter still finds the person
    expect(ask('how much does Rya owe me', PANEL).filters.friendId).toBe('riya')
    expect(ask('Karran owes me?', PANEL).filters.friendId).toBe('karan')
    expect(ask('how much does Samm owe me', PANEL).filters.friendId).toBe('sam')
    // and a group nobody has is said too
    expect(ask('who owes me in Gao', PANEL).intent).toBe('unknownGroup')
    expect(say('who owes me in Gao')).toBe('I don’t know a group called Gao')
  })

  it('a slip of typing is a match; a different name is not', () => {
    expect(nameMatch('priya', 'riya')).toBe(0)
    expect(nameMatch('riyaz', 'riya')).toBe(0)
    expect(nameMatch('kiran', 'karan')).toBe(0)
    expect(nameMatch('sneha', 'neha')).toBe(0)
    expect(nameMatch('rya', 'riya')).toBe(1)
    expect(nameMatch('samm', 'sam')).toBe(1)
    expect(nameMatch('sami', 'sam')).toBe(0)
    expect(nameMatch('karran', 'karan')).toBe(1)
    expect(nameMatch('riua', 'riya')).toBe(1)
  })

  it('“how much did Sam pay” is what Sam paid, with settle-up payments apart', () => {
    const sam = ask('how much did Sam pay in Goa', PANEL)
    expect(sam.intent).toBe('friendPaid')
    expect(sam.amount).toBe(50_000)
    expect(say('how much did Sam pay in Goa')).toBe('Sam paid ₹500 for 1 expense')
    expect(readAs('how much did Sam pay in Goa')).toEqual(['What Sam paid', 'Goa trip'])
    const riya = ask('Riya ne kitna diya', PANEL)
    expect(riya.intent).toBe('friendPaid')
    expect(riya.amount).toBe(120_000)
    expect(riya.payments).toBe(100_000)
    expect(answerLines(riya)).toEqual(['Plus ₹1,000 paid to settle up, not counted above'])
    expect(say('how much did Karan pay')).toBe('Karan hasn’t paid for any expense that matches')
    expect(ask('how much did Sam spend in goa', PANEL)).toMatchObject({ intent: 'friendShare', amount: 192_500 })
  })

  it('who gives whom: “Samm kitna dega” is Sam owing me; two other people are not guessed at', () => {
    const a = ask('Samm kitna dega', PANEL)
    expect(a.intent).toBe('friendOwesMe')
    expect(a.amount).toBe(115_000)
    expect(ask('Sam ko kitna dena hai', PANEL).intent).toBe('iOweFriend')
    const pair = ask('how much does Karan owe Riya', PANEL)
    expect(pair.intent).toBe('otherPair')
    expect(pair.amount).toBeNull()
    expect(say('how much does Karan owe Riya')).toBe('I only know what people owe you, not what Karan owes Riya')
    expect(ask('how much do Sam and Karan owe me', PANEL).intent).toBe('onePerson')
  })

  it('spending by category, group or month is a breakdown, and long lists carry every row', () => {
    const cat = ask('spending by category', PANEL)
    expect(cat.intent).toBe('breakdown')
    expect(cat.amount).toBe(242_500)
    expect(cat.rows.map((r) => [r.title, r.amount])).toEqual([
      ['Travel & stays', 150_000],
      ['Food & drinks', 52_500],
      ['Entertainment', 40_000],
    ])
    expect(cat.rows.reduce((s, r) => s + r.amount, 0)).toBe(cat.amount)
    expect(say('spending by category')).toBe('Your share by category: ₹2,425 in all')
    expect(readAs('spending by category')).toEqual(['Your share of spending', 'by category'])
    expect(ask('spending by group', PANEL).rows.map((r) => [r.title, r.amount])).toEqual([
      ['Goa trip', 192_500],
      ['Not in a group', 50_000],
    ])
    expect(ask('spending by month', PANEL).rows.map((r) => [r.title, r.amount])).toEqual([
      ['November 2026', 202_500],
      ['October 2026', 40_000],
    ])
    const many = { ...PANEL, expenses: Array.from({ length: 12 }, (_, i) => bill(`x${i}`, `Chai ${i}`, 1_000 + i, TODAY, 'me', { me: 500 + i, riya: 500 })) }
    expect(ask('how much did I spend', many).rows).toHaveLength(12)
  })

  it('commands get “I didn’t follow” with where it’s done, never a number', () => {
    for (const [q, kind] of [
      ['delete all expenses', 'change'],
      ['split 500 with Riya', 'add'],
      ['please add 300 for chai', 'add'],
      ['remind Sam to pay', 'settle'],
    ] as const) {
      const a = ask(q, PANEL)
      expect(a.intent, q).toBe('command')
      expect(a.command, q).toBe(kind)
      expect(a.amount, q).toBeNull()
    }
    expect(say('delete all expenses')).toBe('I didn’t follow that one. I only answer questions about your money.')
    expect(answerNotes(ask('delete all expenses', PANEL))).toEqual(['To change or delete an expense, open it from your list.'])
    expect(answerNotes(ask('split 500 with Riya', PANEL))).toEqual(['To add or split an expense, use Just say it at the top of Home.'])
    // “add up” is a question
    expect(ask('add up my spending', PANEL).intent).not.toBe('command')
  })

  it('“last expense” is the last expense', () => {
    const a = ask('last expense', PANEL)
    expect(a.intent).toBe('lastExpense')
    expect(a.title).toBe('Coffee')
    expect(say('last expense')).toBe('The last expense was Coffee: ₹200, Today')
    expect(answerLines(a)).toEqual(['Your share: ₹100'])
    expect(ask('last expense in goa', PANEL).title).toBe('Dinner')
  })

  it('“hotel kitna tha” is the whole bill, with my share under it', () => {
    const a = ask('hotel kitna tha', PANEL)
    expect(a.intent).toBe('spent')
    expect(a.filters.title).toBe('hotel')
    expect(a.amount).toBe(600_000)
    expect(answerLines(a)).toEqual(['Your share: ₹1,500'])
    expect(readAs('hotel kitna tha')).toEqual(['Spending in all', 'called “hotel”'])
    // and “we” in a group shows my part too
    expect(answerLines(ask('how much did we spend in goa', PANEL))).toEqual(['Your share: ₹1,925'])
  })

  it('a word in a title is matched before the whole category, and a broader answer says so', () => {
    const drinks = ask('what did I spend on drinks', PANEL)
    expect(drinks.filters.title).toBe('drinks')
    expect(drinks.amount).toBe(12_500)
    expect(answerNotes(drinks)).toEqual([])
    const snacks = ask('what did I spend on snacks', PANEL)
    expect(snacks.filters.category).toBe('food')
    expect(snacks.amount).toBe(52_500)
    expect(answerNotes(snacks)).toEqual(['No expense is called “snacks”, so this is all of Food & drinks.'])
  })

  it('a month that a balance can’t honour is said, not dropped', () => {
    const a = ask('how much did Neha owe me in October', PANEL)
    expect(a.intent).toBe('friendOwesMe')
    expect(a.amount).toBe(40_000)
    expect(answerNotes(a)).toEqual(['Balances are as they stand today, not for October 2026.'])
  })

  it('balances that come through a simplified group say so in one line', () => {
    expect(answerNotes(ask('how much do I owe Riya', PANEL))).toContain('Group balances are simplified, so who pays whom can differ from who paid for what.')
    expect(answerNotes(ask('kisko kitna dena hai', PANEL))).toContain('Group balances are simplified, so who pays whom can differ from who paid for what.')
    expect(ask('kisko kitna dena hai', PANEL).intent).toBe('iOwe')
    // Neha is in no group with me: nothing is simplified
    expect(answerNotes(ask('how much does Neha owe me', PANEL))).toEqual([])
  })
})

describe('what the panel liked still works', () => {
  it('Hinglish, typos and clean refusals', () => {
    expect(ask('kitna dena hai', PANEL).intent).toBe('iOwe')
    expect(ask('is mahine kitna kharch kiya', PANEL)).toMatchObject({ intent: 'spent', amount: 202_500 })
    expect(ask('Goa mein sabse bada kharcha', PANEL)).toMatchObject({ intent: 'biggest', title: 'Hotel' })
    for (const q of ['what’s the weather like', 'book a cab to the airport', 'who is the president']) expect(ask(q, PANEL).intent, q).toBe('unknown')
  })
})
