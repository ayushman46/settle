/**
 * Ask Settle: a question about your own money, in plain words, answered on this phone.
 *
 * A small rule-based reader (no AI, nothing uploaded, works offline). It knows a short list of
 * questions — who owes you and what you owe, where you stand with one friend, how much was spent
 * (on a category, in a group, with a friend, over a time), the biggest expense, the last payment,
 * how many expenses, who paid the most and the spend per day — and says so when it doesn't
 * understand. English with common Hinglish forms ("kitna", "kisne", "mujhe", "dena hai", "lena
 * hai"); friend and group names may be misspelt by a letter.
 *
 * Pure: `today` comes in; no clock, no storage. Loans aren't spending. Totals are in one currency
 * (the profile's, or the group's when asking about a group); other currencies are named as left out.
 */
import { CATEGORY_IDS, ME_ID, type CategoryId, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { addDays, daysBetween, toIsoDate } from '../../engine/dates'
import { friendBalance } from '../friends/friendBalance'
import { expensePath, friendPath, groupPath } from '../groups/paths'
import { weekStart } from '../play/engine'

/* ------------------------------------------------------------------ what comes out */

export type AskIntent =
  | 'owedToMe'
  | 'iOwe'
  | 'friendOwesMe'
  | 'iOweFriend'
  | 'spent'
  | 'biggest'
  | 'lastPaidByFriend'
  | 'lastPaidToFriend'
  | 'count'
  | 'topPayer'
  | 'perDay'
  | 'unknown'

export type RangeKind = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'month' | 'year'

export interface AskRange {
  kind: RangeKind
  /** YYYY-MM-DD, both counted. */
  from: string
  to: string
  /** For `month` (1–12) and `month`/`year`. */
  month?: number
  year?: number
}

export interface AskFilters {
  category: CategoryId | null
  groupId: string | null
  friendId: string | null
  range: AskRange | null
  /** "I" (my share) or "we" (the whole bill). */
  who: 'me' | 'we'
}

export interface AskRow {
  key: string
  title: string
  amount: Minor
  currency: string
  /** YYYY-MM-DD, or null when it isn't about a day. */
  date: string | null
  /** Where tapping it goes, or null. */
  path: string | null
}

export interface AskAnswer {
  intent: AskIntent
  filters: AskFilters
  /** The number the headline is about (signed for a friend: + they owe me), or null when there's none. */
  amount: Minor | null
  currency: string
  /** Expenses (or people) behind it. */
  count: number
  /** Up to 5 rows that back it up. */
  rows: AskRow[]
  /** Currencies left out of the total. */
  leftOut: string[]
  /** Days the spend per day is over. */
  days?: number
  /** The person the answer is about (who paid most, who paid last). */
  personId?: string
  /** The day of the answer (the biggest expense, the last payment). */
  date?: string
  /** The biggest expense's title. */
  title?: string
}

export interface AskData {
  expenses: readonly Expense[]
  groups: readonly Group[]
  /** Your people (you may be in the list; you're never matched by name). */
  friends: readonly Pick<Friend, 'id' | 'name'>[]
  /** The profile currency. */
  currency: string
  /** YYYY-MM-DD. */
  today: string
  me?: string
  /** How a person is named in a row ("You" for me). */
  nameOf?: (id: string) => string
}

export const MAX_ROWS = 5

/* ------------------------------------------------------------------ words */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'s\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const CATEGORY_WORDS: Readonly<Record<string, CategoryId>> = {
  food: 'food', foods: 'food', dinner: 'food', dinners: 'food', lunch: 'food', lunches: 'food', breakfast: 'food', khana: 'food', khane: 'food', restaurant: 'food', restaurants: 'food', swiggy: 'food', zomato: 'food', chai: 'food', coffee: 'food', drinks: 'food', eating: 'food', snacks: 'food',
  grocery: 'groceries', groceries: 'groceries', sabzi: 'groceries', vegetables: 'groceries', blinkit: 'groceries', zepto: 'groceries', bigbasket: 'groceries', ration: 'groceries',
  rent: 'rent', kiraya: 'rent',
  utilities: 'utilities', utility: 'utilities', electricity: 'utilities', bijli: 'utilities', wifi: 'utilities', internet: 'utilities', water: 'utilities', gas: 'utilities', broadband: 'utilities',
  travel: 'travel', flight: 'travel', flights: 'travel', hotel: 'travel', hotels: 'travel', train: 'travel', trains: 'travel', stay: 'travel',
  transport: 'transport', cab: 'transport', cabs: 'transport', uber: 'transport', ola: 'transport', auto: 'transport', autos: 'transport', taxi: 'transport', petrol: 'transport', fuel: 'transport', metro: 'transport', rapido: 'transport',
  shopping: 'shopping', clothes: 'shopping', amazon: 'shopping', flipkart: 'shopping', myntra: 'shopping',
  entertainment: 'entertainment', movie: 'entertainment', movies: 'entertainment', film: 'entertainment', concert: 'entertainment', party: 'entertainment', games: 'entertainment',
  subscription: 'subscription', subscriptions: 'subscription', netflix: 'subscription', spotify: 'subscription', prime: 'subscription', hotstar: 'subscription',
  gift: 'gift', gifts: 'gift', present: 'gift',
  health: 'health', medicine: 'health', medicines: 'health', doctor: 'health', pharmacy: 'health', hospital: 'health', gym: 'health',
}
for (const id of CATEGORY_IDS) if (id !== 'other') (CATEGORY_WORDS as Record<string, CategoryId>)[id] = id

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

const ME_WORDS = ['i', 'me', 'my', 'mine', 'myself', 'maine', 'mujhe', 'mera', 'meri', 'mere', 'main', 'im', 'ive']
const WE_WORDS = ['we', 'us', 'our', 'ours', 'together', 'humne', 'hamne', 'hum', 'hame', 'humne', 'everyone', 'sabne', 'sab']

/** Words the reader uses itself: never taken for a misspelt name. */
const GRAMMAR = new Set([
  ...ME_WORDS, ...WE_WORDS, ...Object.keys(CATEGORY_WORDS), ...Object.keys(MONTHS),
  'how', 'much', 'many', 'what', 'who', 'whom', 'whose', 'when', 'where', 'which', 'did', 'do', 'does', 'done', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  'the', 'a', 'an', 'in', 'on', 'at', 'for', 'with', 'to', 'from', 'of', 'by', 'and', 'or', 'during', 'over', 'since', 'so', 'far', 'all', 'any', 'still', 'right', 'now', 'there', 'than', 'that', 'it', 'its', 'you', 'your',
  'owe', 'owes', 'owed', 'owing', 'spend', 'spent', 'spending', 'spends', 'expense', 'expenses', 'bill', 'bills', 'split', 'splits', 'cost', 'costs', 'paid', 'pay', 'pays', 'paying', 'payment', 'payments', 'back',
  'total', 'money', 'last', 'this', 'previous', 'past', 'time', 'today', 'yesterday', 'week', 'month', 'year', 'day', 'days', 'per', 'daily', 'each', 'every', 'most', 'least', 'biggest', 'largest', 'highest', 'expensive', 'costliest',
  'collect', 'get', 'got', 'balance', 'stand', 'square', 'settle', 'people', 'person', 'number', 'count', 'up', 'out',
  'kitna', 'kitni', 'kitne', 'kisne', 'kis', 'kaun', 'kab', 'kya', 'dena', 'dene', 'deni', 'dega', 'degi', 'lena', 'lene', 'milna', 'milne', 'milega', 'hai', 'hain', 'ho', 'tha', 'thi', 'ne', 'ko', 'se', 'ka', 'ki', 'ke', 'mein', 'me',
  'kharch', 'kharcha', 'kharche', 'kiya', 'kiye', 'hua', 'hue', 'diya', 'diye', 'bheja', 'aaj', 'kal', 'is', 'pichhle', 'pichle', 'hafte', 'hafta', 'mahine', 'mahina', 'saal', 'roz', 'rozana', 'din', 'har', 'sabse', 'zyada', 'jyada', 'bada', 'badi', 'paise', 'paisa', 'rupees', 'rs', 'inr', 'hisaab', 'hisab',
  'trip', 'group', 'groups', 'friend', 'friends',
])

/** Group-name words too common to pick a group by on their own. */
const GENERIC = new Set(['trip', 'group', 'the', 'gang', 'squad', 'friends', 'home', 'flat', 'house', 'team', 'family', 'and', 'of', 'to', 'a', 'my', 'our', 'club', 'crew'])

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j] ?? 0
      prev[j] = Math.min(above + 1, (prev[j - 1] ?? 0) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = above
    }
  }
  return prev[b.length] ?? 2
}

/** How well a typed word matches a name word: 3 exact, 2 the start of it, 1 one letter off, 0 not at all. Short names must be exact. */
export function nameMatch(word: string, name: string): number {
  if (word === name) return 3
  if (name.length < 4 || word.length < 3) return 0
  if (name.startsWith(word)) return 2
  return editDistance(word, name) <= 1 ? 1 : 0
}

/* ------------------------------------------------------------------ reading the question */

interface Reading {
  intent: AskIntent
  filters: AskFilters
}

function findGroup(words: readonly string[], groups: readonly Group[]): { id: string; used: Set<number> } | null {
  let best: { id: string; used: Set<number>; score: number; name: string } | null = null
  for (const group of groups) {
    const parts = normalize(group.name).split(' ').filter((w) => w.length >= 2)
    const keyParts = parts.filter((w) => !GENERIC.has(w) && !(w in CATEGORY_WORDS))
    const look = keyParts.length > 0 ? keyParts : parts
    if (look.length === 0) continue
    const used = new Set<number>()
    let score = 0
    for (const part of look) {
      let found = -1
      let quality = 0
      words.forEach((word, i) => {
        if (used.has(i)) return
        const q = GRAMMAR.has(word) ? (word === part && keyParts.length === 0 ? 3 : 0) : nameMatch(word, part)
        if (q > quality) {
          quality = q
          found = i
        }
      })
      if (found >= 0) {
        used.add(found)
        score += quality
      }
    }
    if (score === 0) continue
    // Generic words of the name ("trip" in "Goa trip") are taken too, so they don't read as anything else.
    words.forEach((word, i) => {
      if (parts.includes(word)) used.add(i)
    })
    const name = normalize(group.name)
    if (!best || score > best.score || (score === best.score && name.localeCompare(best.name) < 0)) best = { id: group.id, used, score, name }
  }
  return best ? { id: best.id, used: best.used } : null
}

function findFriend(words: readonly string[], friends: AskData['friends'], me: string, taken: ReadonlySet<number>): { id: string; at: number; used: Set<number> } | null {
  let best: { id: string; at: number; used: Set<number>; score: number; name: string } | null = null
  for (const friend of friends) {
    if (friend.id === me) continue
    const parts = normalize(friend.name).split(' ').filter((w) => w.length >= 2)
    const used = new Set<number>()
    let score = 0
    let at = -1
    for (const part of parts) {
      let found = -1
      let quality = 0
      words.forEach((word, i) => {
        if (taken.has(i) || used.has(i) || GRAMMAR.has(word)) return
        const q = nameMatch(word, part)
        if (q > quality) {
          quality = q
          found = i
        }
      })
      if (found >= 0) {
        used.add(found)
        score += quality
        if (at < 0) at = found
      }
    }
    if (score === 0) continue
    const name = normalize(friend.name)
    if (!best || score > best.score || (score === best.score && name.localeCompare(best.name) < 0)) best = { id: friend.id, at, used, score, name }
  }
  return best ? { id: best.id, at: best.at, used: best.used } : null
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`
  const next = month === 12 ? `${String(year + 1).padStart(4, '0')}-01-01` : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-01`
  return { from, to: addDays(next, -1) }
}

function findRange(words: readonly string[], taken: ReadonlySet<number>, today: string): AskRange | null {
  const free = (i: number): string | null => (taken.has(i) ? null : (words[i] ?? null))
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  for (let i = 0; i < words.length; i++) {
    const w = free(i)
    if (w === null) continue
    if (w === 'today' || w === 'aaj') return { kind: 'today', from: today, to: today }
    if (w === 'yesterday' || w === 'kal') return { kind: 'yesterday', from: addDays(today, -1), to: addDays(today, -1) }
    const nextWord = free(i + 1)
    const isThis = w === 'this' || w === 'is' || w === 'current'
    const isLast = w === 'last' || w === 'previous' || w === 'pichhle' || w === 'pichle' || w === 'pichla'
    if ((isThis || isLast) && nextWord) {
      if (nextWord === 'week' || nextWord === 'hafte' || nextWord === 'hafta') {
        const monday = weekStart(today)
        return isThis ? { kind: 'thisWeek', from: monday, to: today } : { kind: 'lastWeek', from: addDays(monday, -7), to: addDays(monday, -1) }
      }
      if (nextWord === 'month' || nextWord === 'mahine' || nextWord === 'mahina') {
        if (isThis) return { kind: 'thisMonth', from: monthRange(year, month).from, to: today }
        const y = month === 1 ? year - 1 : year
        const m = month === 1 ? 12 : month - 1
        return { kind: 'lastMonth', ...monthRange(y, m), year: y, month: m }
      }
      if (nextWord === 'year' || nextWord === 'saal') {
        return isThis ? { kind: 'thisYear', from: `${year}-01-01`, to: today } : { kind: 'lastYear', from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, year: year - 1 }
      }
    }
  }
  // A month by name ("in October", "oct 2025"), or a year ("in 2025").
  let named: number | null = null
  let namedYear: number | null = null
  words.forEach((w, i) => {
    if (taken.has(i)) return
    const m = MONTHS[w]
    if (m !== undefined && named === null) {
      // "may" is a month only after "in"/"of"/"during" or before a year.
      const before = words[i - 1]
      const after = words[i + 1]
      if (w === 'may' && !(before === 'in' || before === 'of' || before === 'during' || (after !== undefined && /^\d{4}$/.test(after)))) return
      named = m
    }
    if (/^(19|20|21)\d{2}$/.test(w)) namedYear = Number(w)
  })
  if (named !== null) {
    const y = namedYear ?? (named > month ? year - 1 : year)
    return { kind: 'month', ...monthRange(y, named), month: named, year: y }
  }
  if (namedYear !== null) return { kind: 'year', from: `${namedYear}-01-01`, to: `${namedYear}-12-31`, year: namedYear }
  return null
}

export function readQuestion(question: string, data: Pick<AskData, 'groups' | 'friends' | 'today' | 'me'>): Reading {
  const me = data.me ?? ME_ID
  const text = normalize(question)
  const words = text ? text.split(' ') : []
  const padded = ` ${text} `
  const has = (...list: string[]): boolean => list.some((w) => words.includes(w))
  const phrase = (...list: string[]): boolean => list.some((p) => padded.includes(` ${p} `))

  const group = findGroup(words, data.groups)
  const taken = new Set(group?.used ?? [])
  const friend = findFriend(words, data.friends, me, taken)
  for (const i of friend?.used ?? []) taken.add(i)
  let category: CategoryId | null = null
  words.forEach((w, i) => {
    const c = CATEGORY_WORDS[w]
    if (!taken.has(i) && c !== undefined && category === null) category = c
  })
  const range = findRange(words, taken, data.today)

  const meSaid = has(...ME_WORDS)
  const weSaid = has(...WE_WORDS) || phrase('in all')
  const filters: AskFilters = { category, groupId: group?.id ?? null, friendId: friend?.id ?? null, range, who: meSaid && !has('we', 'us', 'our', 'humne', 'hamne', 'together') ? 'me' : weSaid || group ? 'we' : 'me' }
  const read = (intent: AskIntent): Reading => ({ intent, filters })
  const friendAfter = (...marks: string[]): boolean => friend !== null && marks.includes(words[friend.at + 1] ?? '')

  const oweWords = has('owe', 'owes', 'owed', 'owing', 'dena', 'dene', 'deni', 'dega', 'degi', 'lena', 'lene', 'milna', 'milne', 'milega', 'collect', 'udhaar', 'udhar') || phrase('get back', 'pay back', 'pay me back')
  const paidWords = has('paid', 'pay', 'payment', 'diya', 'diye', 'bheja', 'bheje', 'transferred', 'sent')

  /* ---- the last time someone paid ---- */
  if (paidWords && (has('last', 'kab', 'latest', 'recent', 'recently') || (has('when') && !has('much')))) {
    const iPaid = phrase('i paid', 'did i', 'have i', 'i last', 'i sent', 'maine', 'my last')
    return read(iPaid ? 'lastPaidToFriend' : 'lastPaidByFriend')
  }

  /* ---- who paid the most ---- */
  if (has('who', 'kisne', 'kaun', 'whose') && has('most', 'zyada', 'jyada', 'sabse', 'max', 'maximum', 'highest') && !oweWords) return read('topPayer')

  /* ---- what's owed ---- */
  if (oweWords || (friend !== null && has('balance', 'stand', 'square', 'hisaab', 'hisab', 'settle', 'settled'))) {
    const giveWords = has('dena', 'dene', 'deni', 'dega', 'degi')
    const toMe =
      phrase('owe me', 'owes me', 'owed to me', 'am i owed', 'i am owed', 'im owed', 'get back', 'pay me', 'pay me back', 'to collect', 'i collect') ||
      has('collect', 'lena', 'lene', 'milna', 'milne', 'milega') ||
      (giveWords && (has('kisne', 'kis') || friendAfter('ne'))) ||
      (has('owes', 'owe', 'owed', 'owing') && !phrase('i owe', 'do i owe', 'i owed', 'should i', 'i have to', 'i need to', 'am i owing', 'i am owing', 'my debts'))
    const iOwe = !toMe && (giveWords || phrase('i owe', 'do i owe', 'i owed', 'i have to pay', 'i need to pay', 'should i pay', 'pay back', 'my debts', 'am i owing', 'i am owing'))
    if (friend !== null) return read(iOwe ? 'iOweFriend' : 'friendOwesMe')
    if (iOwe) return read('iOwe')
    if (toMe) return read('owedToMe')
  }

  /* ---- per day ---- */
  if (phrase('per day', 'a day', 'each day', 'every day', 'per din', 'har din', 'ek din') || has('daily', 'perday', 'roz', 'rozana', 'everyday', 'avg', 'average')) return read('perDay')

  /* ---- the biggest ---- */
  if (has('biggest', 'largest', 'costliest', 'priciest', 'highest', 'expensive', 'bada', 'badi', 'sabse', 'max', 'maximum', 'top')) return read('biggest')

  /* ---- how many ---- */
  if (phrase('how many', 'number of') || has('count') || (has('kitne', 'kitni') && has('expenses', 'expense', 'bills', 'bill', 'splits', 'split', 'kharche', 'entries', 'baar'))) return read('count')

  /* ---- how much was spent ---- */
  if (has('spend', 'spent', 'spending', 'spends', 'expense', 'expenses', 'kharch', 'kharcha', 'kharche', 'cost', 'costs', 'total', 'splurged', 'blew') || ((group || category || range) && (phrase('how much') || has('kitna', 'kitni', 'kitne')))) return read('spent')

  /* ---- just a name: where we stand ---- */
  if (friend !== null && !group && !category && !range) return read('friendOwesMe')

  return read('unknown')
}

/* ------------------------------------------------------------------ answering */

const dayOf = (ms: number): string => toIsoDate(new Date(ms))

const newestFirst = (a: { date: string | null; key: string }, b: { date: string | null; key: string }): number => (a.date === b.date ? (a.key < b.key ? -1 : 1) : (a.date ?? '') < (b.date ?? '') ? 1 : -1)

export function ask(question: string, data: AskData): AskAnswer {
  const me = data.me ?? ME_ID
  const nameOf = data.nameOf ?? ((id: string) => data.friends.find((f) => f.id === id)?.name ?? id)
  const { intent, filters } = readQuestion(question, data)
  const group = filters.groupId ? (data.groups.find((g) => g.id === filters.groupId) ?? null) : null
  const currency = group?.currency ?? data.currency
  const answer = (patch: Partial<AskAnswer>): AskAnswer => ({ intent, filters, amount: null, currency, count: 0, rows: [], leftOut: [], ...patch })

  if (intent === 'unknown') return answer({})

  /* ---- owed ---- */
  if (intent === 'owedToMe' || intent === 'iOwe') {
    const summary = overallSummary(data.expenses, data.groups, me, data.currency)
    const wantOwed = intent === 'owedToMe'
    const people = Object.entries(summary.byFriend)
      .filter(([, v]) => (wantOwed ? v > 0 : v < 0))
      .map(([id, v]) => ({ id, amount: Math.abs(v), name: nameOf(id) }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    const leftOut = Object.entries(summary.otherCurrencies)
      .filter(([, t]) => (wantOwed ? t.owedToMe : t.iOwe) > 0)
      .map(([code]) => code)
    return answer({
      currency: data.currency,
      amount: wantOwed ? summary.owedToMe : summary.iOwe,
      count: people.length,
      rows: people.slice(0, MAX_ROWS).map((p) => ({ key: p.id, title: p.name, amount: p.amount, currency: data.currency, date: null, path: friendPath(p.id) })),
      leftOut,
    })
  }

  if (intent === 'friendOwesMe' || intent === 'iOweFriend') {
    const id = filters.friendId
    if (!id) return answer({ intent: 'unknown' })
    const balance = friendBalance(id, data.expenses, data.groups, data.currency, me)
    const net = balance.totals.find((t) => t.currency === data.currency)?.amount ?? 0
    const rows: AskRow[] = balance.sources
      .filter((s) => s.currency === data.currency && s.amount !== 0)
      .map((s) =>
        s.kind === 'group'
          ? { key: s.key, title: s.group.name, amount: s.amount, currency: s.currency, date: null, path: groupPath(s.group.id) }
          : { key: s.key, title: s.titles.slice(0, 3).join(', '), amount: s.amount, currency: s.currency, date: null, path: friendPath(id) },
      )
    return answer({ currency: data.currency, amount: net, count: rows.length, rows: rows.slice(0, MAX_ROWS), leftOut: balance.totals.filter((t) => t.currency !== data.currency).map((t) => t.currency), personId: id })
  }

  /* ---- payments ---- */
  if (intent === 'lastPaidByFriend' || intent === 'lastPaidToFriend') {
    const mine = intent === 'lastPaidToFriend'
    const other = filters.friendId
    const payments: Array<AskRow & { personId: string }> = []
    for (const e of data.expenses) {
      if (mine) {
        if (e.payerId === me || (other && e.payerId !== other)) continue
        const at = e.paidBack[me]
        if (at !== undefined && Number.isFinite(at)) payments.push({ key: `${e.id}:${me}`, title: e.title, amount: e.shares[me] ?? 0, currency: e.currency, date: dayOf(at), path: expensePath(e.id), personId: e.payerId })
      } else {
        if (e.payerId !== me) continue
        for (const [id, at] of Object.entries(e.paidBack)) {
          if (id === me || (other && id !== other) || !Number.isFinite(at)) continue
          payments.push({ key: `${e.id}:${id}`, title: e.title, amount: e.shares[id] ?? 0, currency: e.currency, date: dayOf(at), path: expensePath(e.id), personId: id })
        }
      }
    }
    for (const g of data.groups) {
      for (const s of g.settlements) {
        const match = mine ? s.fromId === me && (!other || s.toId === other) : s.toId === me && (!other || s.fromId === other)
        if (match && s.fromId !== s.toId) payments.push({ key: s.id, title: g.name, amount: s.amount, currency: g.currency, date: s.date, path: groupPath(g.id), personId: mine ? s.toId : s.fromId })
      }
    }
    const sorted = payments.filter((p) => p.date !== null && p.date <= data.today).sort(newestFirst)
    const last = sorted[0]
    return answer({
      currency: last?.currency ?? data.currency,
      amount: last ? last.amount : null,
      count: sorted.length,
      rows: sorted.slice(0, MAX_ROWS).map(({ personId: _p, ...row }) => row),
      ...(last ? { date: last.date ?? undefined, personId: last.personId } : other ? { personId: other } : {}),
    })
  }

  /* ---- spending ---- */
  const r = filters.range
  const involved = (e: Expense): boolean => e.payerId === me || (e.shares[me] ?? 0) > 0
  const matching = data.expenses.filter((e) => {
    if (e.kind === 'loan' || e.date > data.today) return false
    if (r && (e.date < r.from || e.date > r.to)) return false
    if (filters.category && e.category !== filters.category) return false
    if (group && e.groupId !== group.id) return false
    if (filters.friendId && !(e.payerId === filters.friendId || (e.shares[filters.friendId] ?? 0) > 0)) return false
    if (!group && !involved(e)) return false
    return true
  })

  if (intent === 'count') {
    const counted = filters.who === 'me' && !group ? matching.filter(involved) : matching
    return answer({
      amount: null,
      count: counted.length,
      rows: [...counted]
        .sort((a, b) => newestFirst({ date: a.date, key: a.id }, { date: b.date, key: b.id }))
        .slice(0, MAX_ROWS)
        .map((e) => ({ key: e.id, title: e.title, amount: e.total, currency: e.currency, date: e.date, path: expensePath(e.id) })),
    })
  }

  const inCurrency = matching.filter((e) => e.currency === currency)
  const leftOut = [...new Set(matching.filter((e) => e.currency !== currency).map((e) => e.currency))].sort()

  if (intent === 'topPayer') {
    const byPayer = new Map<string, Minor>()
    for (const e of inCurrency) byPayer.set(e.payerId, (byPayer.get(e.payerId) ?? 0) + e.total)
    const people = [...byPayer.entries()].map(([id, amount]) => ({ id, amount, name: nameOf(id) })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    const top = people[0]
    return answer({
      amount: top?.amount ?? null,
      count: people.length,
      leftOut,
      rows: people.slice(0, MAX_ROWS).map((p) => ({ key: p.id, title: p.name, amount: p.amount, currency, date: null, path: p.id === me ? null : friendPath(p.id) })),
      ...(top ? { personId: top.id } : {}),
    })
  }

  if (intent === 'biggest') {
    const sorted = [...inCurrency].sort((a, b) => b.total - a.total || (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1))
    const top = sorted[0]
    return answer({
      amount: top?.total ?? null,
      count: sorted.length,
      leftOut,
      rows: sorted.slice(0, MAX_ROWS).map((e) => ({ key: e.id, title: e.title, amount: e.total, currency: e.currency, date: e.date, path: expensePath(e.id) })),
      ...(top ? { date: top.date, title: top.title } : {}),
    })
  }

  // spent and per day: my share, or the whole bill
  const valueOf = (e: Expense): Minor => (filters.who === 'me' ? (e.shares[me] ?? 0) : e.total)
  const counted = inCurrency.filter((e) => valueOf(e) > 0)
  const total = counted.reduce((sum, e) => sum + valueOf(e), 0)
  const rows = [...counted]
    .sort((a, b) => valueOf(b) - valueOf(a) || (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1))
    .slice(0, MAX_ROWS)
    .map((e) => ({ key: e.id, title: e.title, amount: valueOf(e), currency: e.currency, date: e.date, path: expensePath(e.id) }))

  if (intent === 'perDay') {
    if (counted.length === 0) return answer({ amount: null, count: 0, leftOut, days: 0 })
    const dates = counted.map((e) => e.date).sort()
    const from = r ? r.from : (dates[0] ?? data.today)
    const to = r ? (r.to < data.today ? r.to : data.today) : (dates.at(-1) ?? data.today)
    const days = Math.max(1, daysBetween(from, to) + 1)
    return answer({ amount: Math.round(total / days), count: counted.length, leftOut, rows, days })
  }

  return answer({ amount: total, count: counted.length, leftOut, rows })
}
