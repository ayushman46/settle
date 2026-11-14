/**
 * Ask Settle: a question about your own money, in plain words, answered on this phone.
 *
 * A small rule-based reader (no AI, nothing uploaded, works offline). It knows a short list of
 * questions — who owes you and what you owe, where you stand with one friend, how much was spent
 * (on a category, in a group, with a friend, over a time), the biggest expense, the last payment,
 * how many expenses, who paid the most, the spend per day, what one person paid, a breakdown by
 * category, group or month, and the last expense — and says so when it doesn't understand. English
 * with common Hinglish forms ("kitna", "kisne", "mujhe", "dena hai", "lena hai"); friend and group
 * names may carry one slip of typing, but a different name is never swapped in.
 *
 * A confident wrong answer is the worst outcome: a part of the question it can't use (a name or a
 * group nobody has, a second person, a command) gets a plain "didn't follow", never a different answer.
 *
 * Pure: `today` comes in; no clock, no storage. Loans aren't spending. Totals are in one currency
 * (the profile's, or the group's when asking about a group); other currencies are named as left out.
 */
import { CATEGORY_IDS, ME_ID, type CategoryId, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { groupBalances, isSettledInGroup, overallSummary } from '../../engine/balances'
import { addDays, daysBetween, toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { categoryLabel } from '../../share/categories'
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
  | 'friendPaid'
  | 'friendShare'
  | 'breakdown'
  | 'lastExpense'
  | 'command'
  | 'unknownPerson'
  | 'unknownGroup'
  | 'otherPair'
  | 'onePerson'
  | 'unknown'

/** What a command was about, for a pointer to where it's done. */
export type AskCommand = 'add' | 'change' | 'settle'

/** What a breakdown is by. */
export type AskBy = 'category' | 'group' | 'month'

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
  /** A word the expense titles were matched on ("hotel", "drinks"), or null. */
  title: string | null
  /** The word that picked the category when no title had it ("drinks" → Food & drinks), so the answer can say it's broader. */
  categoryWord: string | null
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
  /** The rows that back it up (the screen shows the first MAX_ROWS, the rest on "Show all"). */
  rows: AskRow[]
  /** Currencies left out of the total. */
  leftOut: string[]
  /** Days the spend per day is over. */
  days?: number
  /** The person the answer is about (who paid most, who paid last). */
  personId?: string
  /** The day of the answer (the biggest expense, the last payment). */
  date?: string
  /** The biggest (or last) expense's title. */
  title?: string
  /** My share of the bills in the headline, when the headline is the whole bill. */
  share?: Minor
  /** What the person paid to settle up (kept apart from the bills they paid). */
  payments?: Minor
  /** A breakdown's dimension. */
  by?: AskBy
  /** A command's kind. */
  command?: AskCommand
  /** A name-like word that is nobody you have, as typed. */
  unknownName?: string
  /** The second person in a question about two people. */
  otherPersonId?: string
  /** Group balances went into it, and they are simplified (who pays whom, not who paid what). */
  simplified?: boolean
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

/** Rows shown before "Show all". */
export const MAX_ROWS = 5
/** Rows an answer carries at most. */
export const MAX_LIST = 100

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
  'category', 'categories', 'wise', 'categorywise', 'monthwise', 'groupwise', 'monthly', 'breakdown', 'date', 'will', 'would', 'can', 'could', 'should', 'please', 'pls', 'plz', 'tell', 'show', 'list',
  'called', 'named', 'thing', 'things', 'item', 'items', 'latest', 'recent', 'recently', 'newest', 'aakhri', 'akhri', 'pichla', 'current', 'entry', 'entries', 'baar', 'ek', 'also', 'just', 'only',
  'both', 'between', 'someone', 'anyone', 'anybody', 'everybody', 'nobody', 'he', 'she', 'they', 'him', 'her', 'them', 'his', 'their', 'but', 'not', 'no', 'yes', 'ok', 'okay', 'hey', 'hi',
  'like', 'about', 'into', 'then', 'if', 'again', 'more', 'less', 'rupee', 'rupaye', 'top', 'max', 'maximum', 'average', 'avg', 'splurged', 'blew', 'priciest', 'sent', 'transferred',
  'share', 'shares', 'kisko', 'kise', 'kisse', 'kiska', 'kiski', 'kiske', 'kahan', 'kyun', 'kaise', 'sabko', 'sabka', 'koi', 'kuch', 'jo', 'woh', 'wo', 'ye', 'yeh', 'unko', 'usko', 'inko', 'apna', 'apne', 'apni',
  'humko', 'hamko', 'mujhko', 'tumko', 'aapko', 'tum', 'tu', 'dost', 'log', 'logon', 'anything', 'everything', 'something', 'nothing', 'altogether', 'overall', 'net', 'currently', 'pending', 'due', 'dues',
  'outstanding', 'left', 'remaining', 'open', 'unpaid', 'till', 'until', 'yet', 'already', 'ever', 'pe', 'par', 'wale', 'whole', 'full', 'entire', 'amount', 'sum', 'spend', 'cash', 'upi', 'online',
  'bheje', 'udhaar', 'udhar', 'gave', 'give', 'given', 'dunga', 'dungi', 'dene', 'mujhse', 'tujhe', 'aap', 'liye', 'abhi', 'tak', 'batao', 'bata', 'debts', 'debt', 'settled', 'hisaab', 'wala', 'wali',
])

/** Group-name words too common to pick a group by on their own. */
const GENERIC = new Set(['trip', 'group', 'the', 'gang', 'squad', 'friends', 'home', 'flat', 'house', 'team', 'family', 'and', 'of', 'to', 'a', 'my', 'our', 'club', 'crew'])

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

function keyAt(c: string): [number, number] | null {
  for (let r = 0; r < KEY_ROWS.length; r++) {
    const col = (KEY_ROWS[r] ?? '').indexOf(c)
    if (col >= 0) return [r, col + r * 0.5]
  }
  return null
}

/** Two letters side by side on a phone keyboard: a slip of the thumb. */
function nearKeys(a: string, b: string): boolean {
  const p = keyAt(a)
  const q = keyAt(b)
  if (!p || !q || a === b) return false
  return Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1
}

const without = (text: string, i: number): string => text.slice(0, i) + text.slice(i + 1)

/**
 * One slip of typing that keeps the first letter: a doubled letter ("Samm", "Karran"), a dropped
 * one ("Rya", "Arjn") or a neighbouring key. A different name is not a slip: "Priya" isn't "Riya",
 * "Riyaz" isn't "Riya", "Kiran" isn't "Karan".
 */
function oneSlip(word: string, name: string): boolean {
  if (word[0] !== name[0]) return false
  if (word.length === name.length + 1) {
    for (let i = 1; i < word.length; i++) if (without(word, i) === name && (word[i] === word[i - 1] || word[i] === word[i + 1])) return true
    return false
  }
  if (word.length === name.length - 1) {
    for (let i = 1; i < name.length; i++) if (without(name, i) === word) return true
    return false
  }
  if (word.length !== name.length) return false
  let at = -1
  for (let i = 0; i < word.length; i++) {
    if (word[i] === name[i]) continue
    if (at >= 0) return false
    at = i
  }
  return at > 0 && nearKeys(word[at] ?? '', name[at] ?? '')
}

/** How well a typed word matches a name word: 3 exact, 2 the start of it, 1 one slip of typing, 0 not at all. Short names allow only a doubled letter. */
export function nameMatch(word: string, name: string): number {
  if (word === name) return 3
  if (word.length < 3) return 0
  if (name.length < 4) return word.length === name.length + 1 && oneSlip(word, name) ? 1 : 0
  if (name.startsWith(word)) return 2
  return oneSlip(word, name) ? 1 : 0
}

const singular = (w: string): string => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

/** True when a title has the word ("hotel" in "Hotel Baga", "cabs" in "Cab to airport"). */
export function titleHas(title: string, word: string): boolean {
  const want = singular(word)
  return normalize(title)
    .split(' ')
    .some((w) => w === word || singular(w) === want)
}

/** Words that name a category itself: they pick the category, never titles ("rent" is all rent, not "Scooter rent"). */
const CATEGORY_NAMES: ReadonlySet<string> = new Set([...CATEGORY_IDS, 'food', 'khana', 'grocery', 'groceries', 'rent', 'kiraya', 'utility', 'utilities', 'travel', 'transport', 'shopping', 'entertainment', 'subscription', 'subscriptions', 'gift', 'gifts', 'health'])

/** Commands: things to do, not questions. The first word counts, and a few words anywhere. */
const COMMAND_FIRST: Readonly<Record<string, AskCommand>> = {
  add: 'add', split: 'add', create: 'add', make: 'add', record: 'add', log: 'add', enter: 'add', divide: 'add',
  delete: 'change', remove: 'change', erase: 'change', edit: 'change', change: 'change', update: 'change', undo: 'change', cancel: 'change', rename: 'change', reset: 'change', wipe: 'change',
  pay: 'settle', send: 'settle', transfer: 'settle', remind: 'settle', request: 'settle', nudge: 'settle',
}
const COMMAND_ANYWHERE: Readonly<Record<string, AskCommand>> = { delete: 'change', remove: 'change', erase: 'change', wipe: 'change', undo: 'change', remind: 'settle', nudge: 'settle' }
const FILLER = new Set(['please', 'pls', 'plz', 'can', 'could', 'would', 'will', 'you', 'kindly', 'hey', 'hi', 'ok', 'okay', 'just', 'now', 'go', 'ahead'])

function findCommand(words: readonly string[]): AskCommand | null {
  const at = words.findIndex((w) => !FILLER.has(w))
  const first = words[at]
  if (first !== undefined && Object.hasOwn(COMMAND_FIRST, first) && words[at + 1] !== 'up') return COMMAND_FIRST[first] ?? null
  for (const w of words) if (Object.hasOwn(COMMAND_ANYWHERE, w)) return COMMAND_ANYWHERE[w] ?? null
  return null
}

/** Words around a person in a question ("does Priya owe", "Priya ne", "with Priya"). */
const PERSON_BEFORE = new Set(['does', 'did', 'has', 'with', 'to', 'from', 'and', 'owe', 'owes', 'pay', 'paid', 'gave', 'give'])
const PERSON_AFTER = new Set(['ne', 'ko', 'se', 'owes', 'owe', 'paid', 'pays', 'ka', 'ki', 'ke', 'gave'])

/* ------------------------------------------------------------------ reading the question */

interface Reading {
  intent: AskIntent
  filters: AskFilters
  by?: AskBy
  command?: AskCommand
  unknownName?: string
  otherPersonId?: string
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
        if (at < 0 || found < at) at = found
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

export function readQuestion(question: string, data: Pick<AskData, 'groups' | 'friends' | 'today' | 'me'> & { expenses?: readonly Expense[] }): Reading {
  const me = data.me ?? ME_ID
  const text = normalize(question)
  const words = text ? text.split(' ') : []
  const padded = ` ${text} `
  const has = (...list: string[]): boolean => list.some((w) => words.includes(w))
  const phrase = (...list: string[]): boolean => list.some((p) => padded.includes(` ${p} `))

  const group = findGroup(words, data.groups)
  const taken = new Set(group?.used ?? [])
  // My own name is me, never a stranger.
  const myName = data.friends.find((f) => f.id === me)?.name
  if (myName) {
    for (const part of normalize(myName).split(' ').filter((w) => w.length >= 2)) {
      words.forEach((w, i) => {
        if (!GRAMMAR.has(w) && nameMatch(w, part) >= 2) taken.add(i)
      })
    }
  }
  const friend = findFriend(words, data.friends, me, taken)
  for (const i of friend?.used ?? []) taken.add(i)
  const second = friend ? findFriend(words, data.friends.filter((f) => f.id !== friend.id), me, taken) : null
  for (const i of second?.used ?? []) taken.add(i)

  // A word that names expenses ("hotel", "drinks", "villa") is looked for in titles first; a category word no title has picks the whole category.
  const titles = (data.expenses ?? []).map((e) => e.title)
  let title: string | null = null
  let category: CategoryId | null = null
  let categoryWord: string | null = null
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? ''
    if (taken.has(i)) continue
    const c = CATEGORY_WORDS[w]
    const titleWord = w.length >= 3 && /^\p{L}+$/u.test(w) && !CATEGORY_NAMES.has(w) && (c !== undefined || !GRAMMAR.has(w))
    if (title === null && titleWord && titles.some((tt) => titleHas(tt, w))) {
      title = w
      taken.add(i)
    } else if (c !== undefined && category === null) {
      category = c
      categoryWord = CATEGORY_NAMES.has(w) ? null : w
      taken.add(i)
    }
  }
  const range = findRange(words, taken, data.today)

  const meSaid = has(...ME_WORDS)
  const weSaid = has(...WE_WORDS) || phrase('in all')
  const filters: AskFilters = {
    category,
    groupId: group?.id ?? null,
    friendId: friend?.id ?? null,
    range,
    who: meSaid && !has('we', 'us', 'our', 'humne', 'hamne', 'together') ? 'me' : weSaid || group || title ? 'we' : 'me',
    title,
    categoryWord,
  }
  const read = (intent: AskIntent): Reading => ({ intent, filters })
  const friendAfter = (...marks: string[]): boolean => friend !== null && marks.includes(words[friend.at + 1] ?? '')

  const oweWords = has('owe', 'owes', 'owed', 'owing', 'dena', 'dene', 'deni', 'dega', 'degi', 'dunga', 'dungi', 'lena', 'lene', 'milna', 'milne', 'milega', 'collect', 'udhaar', 'udhar') || phrase('get back', 'pay back', 'pay me back')
  const paidWords = has('paid', 'pay', 'payment', 'diya', 'diye', 'bheja', 'bheje', 'transferred', 'sent', 'gave')

  /* ---- not a question: a command ---- */
  const command = findCommand(words)
  if (command) return { ...read('command'), command }

  /* ---- a name or a group nobody has: say so rather than guess ---- */
  const personTalk = oweWords || paidWords || has('with', 'balance', 'hisaab', 'hisab', 'stand', 'square')
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? ''
    if (taken.has(i) || GRAMMAR.has(w) || !/^\p{L}{2,}$/u.test(w)) continue
    const before = words[i - 1] ?? ''
    const after = words[i + 1] ?? ''
    if (before === 'in' || after === 'mein') return { ...read('unknownGroup'), unknownName: w }
    if (personTalk && (PERSON_BEFORE.has(before) || PERSON_AFTER.has(after) || (oweWords && (after === 'kitna' || after === 'kitni')))) return { ...read('unknownPerson'), unknownName: w }
  }

  /* ---- two people: only your own balances are known ---- */
  if (second) return { ...read(oweWords && !meSaid ? 'otherPair' : 'onePerson'), otherPersonId: second.id }

  const meAt = words.findIndex((w) => ME_WORDS.includes(w))
  const friendIsSubject = friend !== null && (friendAfter('ne') || meAt < 0 || meAt > friend.at)
  const howMuch = phrase('how much') || has('kitna', 'kitni', 'kitne', 'total')

  /* ---- the last time someone paid ---- */
  if (paidWords && (has('last', 'kab', 'latest', 'recent', 'recently') || (has('when') && !has('much')))) {
    const iPaid = phrase('i paid', 'did i', 'have i', 'i last', 'i sent', 'maine', 'my last')
    return read(iPaid ? 'lastPaidToFriend' : 'lastPaidByFriend')
  }

  /* ---- the last expense ---- */
  if (range === null && has('last', 'latest', 'recent', 'newest', 'aakhri', 'akhri', 'pichla') && has('expense', 'expenses', 'bill', 'bills', 'kharcha', 'kharch', 'entry', 'split', 'splits', 'spend', 'spent')) return read('lastExpense')

  /* ---- who paid the most ---- */
  if (has('who', 'kisne', 'kaun', 'whose') && has('most', 'zyada', 'jyada', 'sabse', 'max', 'maximum', 'highest') && !oweWords) return read('topPayer')

  /* ---- what one person paid, or their share ---- */
  if (friendIsSubject && paidWords && !oweWords && (howMuch || has('what'))) return read('friendPaid')
  if (friendIsSubject && friend !== null && !weSaid && words[friend.at - 1] !== 'with' && !oweWords && has('spend', 'spent', 'spending', 'spends', 'kharch', 'kharcha', 'kharche', 'share')) return read('friendShare')

  /* ---- what's owed ---- */
  if (oweWords || (friend !== null && has('balance', 'stand', 'square', 'hisaab', 'hisab', 'settle', 'settled'))) {
    const giveWords = has('dena', 'dene', 'deni', 'dega', 'degi', 'dunga', 'dungi')
    const toMe =
      phrase('owe me', 'owes me', 'owed to me', 'am i owed', 'i am owed', 'im owed', 'get back', 'pay me', 'pay me back', 'to collect', 'i collect') ||
      has('collect', 'lena', 'lene', 'milna', 'milne', 'milega') ||
      (giveWords && (has('kisne', 'kis') || friendAfter('ne'))) ||
      // "Sam kitna dega": Sam will give, so Sam owes me ("dunga" would be me giving).
      (has('dega', 'degi') && !friendAfter('ko')) ||
      (has('owes', 'owe', 'owed', 'owing') && !phrase('i owe', 'do i owe', 'i owed', 'should i', 'i have to', 'i need to', 'am i owing', 'i am owing', 'my debts'))
    const iOwe = !toMe && (giveWords || phrase('i owe', 'do i owe', 'i owed', 'i have to pay', 'i need to pay', 'should i pay', 'pay back', 'my debts', 'am i owing', 'i am owing'))
    if (friend !== null) return read(iOwe ? 'iOweFriend' : 'friendOwesMe')
    if (iOwe) return read('iOwe')
    if (toMe) return read('owedToMe')
  }

  /* ---- a breakdown ---- */
  const by: AskBy | null =
    phrase('by category', 'by categories', 'per category', 'each category', 'category wise') || has('categorywise')
      ? 'category'
      : phrase('by group', 'by groups', 'per group', 'each group', 'group wise') || has('groupwise')
        ? 'group'
        : phrase('by month', 'by months', 'per month', 'each month', 'every month', 'month wise', 'har mahine') || has('monthwise', 'monthly')
          ? 'month'
          : null
  if (by) return { ...read('breakdown'), by }

  /* ---- per day ---- */
  if (phrase('per day', 'a day', 'each day', 'every day', 'per din', 'har din', 'ek din') || has('daily', 'perday', 'roz', 'rozana', 'everyday', 'avg', 'average')) return read('perDay')

  /* ---- the biggest ---- */
  if (has('biggest', 'largest', 'costliest', 'priciest', 'highest', 'expensive', 'bada', 'badi', 'sabse', 'max', 'maximum', 'top')) return read('biggest')

  /* ---- how many ---- */
  if (phrase('how many', 'number of') || has('count') || (has('kitne', 'kitni') && has('expenses', 'expense', 'bills', 'bill', 'splits', 'split', 'kharche', 'entries', 'baar'))) return read('count')

  /* ---- how much was spent ---- */
  if (has('spend', 'spent', 'spending', 'spends', 'expense', 'expenses', 'kharch', 'kharcha', 'kharche', 'cost', 'costs', 'total', 'splurged', 'blew') || ((group || category || range || title) && (howMuch || has('what')))) return read('spent')

  /* ---- just a name: where we stand ---- */
  if (friend !== null && !group && !category && !range && !title) return read('friendOwesMe')

  return read('unknown')
}

/* ------------------------------------------------------------------ answering */

const dayOf = (ms: number): string => toIsoDate(new Date(ms))

const newestFirst = (a: { date: string | null; key: string }, b: { date: string | null; key: string }): number => (a.date === b.date ? (a.key < b.key ? -1 : 1) : (a.date ?? '') < (b.date ?? '') ? 1 : -1)

const byTotal = (value: (e: Expense) => Minor) => (a: Expense, b: Expense): number => value(b) - value(a) || (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1)

function monthLabel(yearMonth: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${yearMonth}-01T00:00:00Z`))
  } catch {
    return yearMonth
  }
}

/** Intents that answer nothing: the screen says why and offers questions it does follow. */
export const NOT_ANSWERED: ReadonlySet<AskIntent> = new Set<AskIntent>(['unknown', 'command', 'unknownPerson', 'unknownGroup', 'otherPair', 'onePerson'])

export function ask(question: string, data: AskData): AskAnswer {
  const me = data.me ?? ME_ID
  const nameOf = data.nameOf ?? ((id: string) => data.friends.find((f) => f.id === id)?.name ?? id)
  const reading = readQuestion(question, data)
  const { intent, filters } = reading
  const group = filters.groupId ? (data.groups.find((g) => g.id === filters.groupId) ?? null) : null
  const currency = group?.currency ?? data.currency
  const extra: Partial<AskAnswer> = {
    ...(reading.by ? { by: reading.by } : {}),
    ...(reading.command ? { command: reading.command } : {}),
    ...(reading.unknownName ? { unknownName: reading.unknownName } : {}),
    ...(reading.otherPersonId ? { otherPersonId: reading.otherPersonId, personId: filters.friendId ?? undefined } : {}),
  }
  const answer = (patch: Partial<AskAnswer>): AskAnswer => ({ intent, filters, amount: null, currency, count: 0, rows: [], leftOut: [], ...extra, ...patch })

  if (NOT_ANSWERED.has(intent)) return answer({})

  // A group in the question scopes everything, balances too.
  const scopeGroups = group ? [group] : data.groups
  const scopeExpenses = group ? data.expenses.filter((e) => e.groupId === group.id) : data.expenses
  const r = filters.range
  const inRange = (day: string): boolean => !r || (day >= r.from && day <= r.to)
  /** Group balances that are simplified (3 or more people with money open), in a group I'm in (with the friend, when there's one). */
  const simplifiedFor = (friendId: string | null, code: string): boolean =>
    scopeGroups.some((g) => {
      if (g.currency !== code || !g.memberIds.includes(me) || (friendId !== null && !g.memberIds.includes(friendId))) return false
      return Object.values(groupBalances(g, data.expenses)).filter((v) => v !== 0).length >= 3
    })

  /* ---- owed ---- */
  if (intent === 'owedToMe' || intent === 'iOwe') {
    const summary = overallSummary(scopeExpenses, scopeGroups, me, currency)
    const wantOwed = intent === 'owedToMe'
    const people = Object.entries(summary.byFriend)
      .filter(([, v]) => (wantOwed ? v > 0 : v < 0))
      .map(([id, v]) => ({ id, amount: Math.abs(v), name: nameOf(id) }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    const leftOut = Object.entries(summary.otherCurrencies)
      .filter(([, t]) => (wantOwed ? t.owedToMe : t.iOwe) > 0)
      .map(([code]) => code)
    return answer({
      amount: wantOwed ? summary.owedToMe : summary.iOwe,
      count: people.length,
      rows: people.slice(0, MAX_LIST).map((p) => ({ key: p.id, title: p.name, amount: p.amount, currency, date: null, path: friendPath(p.id) })),
      leftOut,
      simplified: simplifiedFor(null, currency),
    })
  }

  if (intent === 'friendOwesMe' || intent === 'iOweFriend') {
    const id = filters.friendId
    if (!id) return answer({ intent: 'unknown' })
    const balance = friendBalance(id, scopeExpenses, scopeGroups, currency, me)
    const net = balance.totals.find((t) => t.currency === currency)?.amount ?? 0
    const rows: AskRow[] = balance.sources
      .filter((s) => s.currency === currency && s.amount !== 0)
      .map((s) =>
        s.kind === 'group'
          ? { key: s.key, title: s.group.name, amount: s.amount, currency: s.currency, date: null, path: groupPath(s.group.id) }
          : { key: s.key, title: s.titles.slice(0, 3).join(', '), amount: s.amount, currency: s.currency, date: null, path: friendPath(id) },
      )
    return answer({ amount: net, count: rows.length, rows: rows.slice(0, MAX_LIST), leftOut: balance.totals.filter((t) => t.currency !== currency).map((t) => t.currency), personId: id, simplified: simplifiedFor(id, currency) })
  }

  /* ---- payments ---- */
  if (intent === 'lastPaidByFriend' || intent === 'lastPaidToFriend') {
    const mine = intent === 'lastPaidToFriend'
    const other = filters.friendId
    const payments: Array<AskRow & { personId: string }> = []
    for (const e of scopeExpenses) {
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
    for (const g of scopeGroups) {
      for (const s of g.settlements) {
        const match = mine ? s.fromId === me && (!other || s.toId === other) : s.toId === me && (!other || s.fromId === other)
        if (match && s.fromId !== s.toId) payments.push({ key: s.id, title: g.name, amount: s.amount, currency: g.currency, date: s.date, path: groupPath(g.id), personId: mine ? s.toId : s.fromId })
      }
    }
    const sorted = payments.filter((p) => p.date !== null && p.date <= data.today && inRange(p.date)).sort(newestFirst)
    const last = sorted[0]
    return answer({
      currency: last?.currency ?? data.currency,
      amount: last ? last.amount : null,
      count: sorted.length,
      rows: sorted.slice(0, MAX_LIST).map(({ personId: _p, ...row }) => row),
      ...(last ? { date: last.date ?? undefined, personId: last.personId } : other ? { personId: other } : {}),
    })
  }

  /* ---- spending ---- */
  const involved = (e: Expense): boolean => e.payerId === me || (e.shares[me] ?? 0) > 0
  const inFilters = (e: Expense): boolean => {
    if (e.kind === 'loan' || e.date > data.today || !inRange(e.date)) return false
    if (filters.category && e.category !== filters.category) return false
    if (filters.title && !titleHas(e.title, filters.title)) return false
    if (group && e.groupId !== group.id) return false
    if (filters.friendId && !(e.payerId === filters.friendId || (e.shares[filters.friendId] ?? 0) > 0)) return false
    return true
  }
  const expenseRow = (e: Expense, amount: Minor = e.total): AskRow => ({ key: e.id, title: e.title, amount, currency: e.currency, date: e.date, path: expensePath(e.id) })
  const leftOutOf = (list: readonly Expense[]): string[] => [...new Set(list.filter((e) => e.currency !== currency).map((e) => e.currency))].sort()

  /* ---- what one person paid: the bills they paid, and their settle-up payments apart ---- */
  if (intent === 'friendPaid' && filters.friendId) {
    const who = filters.friendId
    const bills = data.expenses.filter((e) => e.payerId === who && inFilters(e))
    const inCurrency = bills.filter((e) => e.currency === currency)
    let payments = 0
    // Payments have no category or title, so they only count when the question has neither.
    if (!filters.category && !filters.title) {
      for (const g of scopeGroups) {
        if (g.currency !== currency) continue
        for (const s of g.settlements) if (s.fromId === who && s.toId !== who && Number.isFinite(s.amount) && s.date <= data.today && inRange(s.date)) payments += s.amount
      }
      if (!group) {
        for (const e of data.expenses) {
          const at = e.paidBack[who]
          if (e.currency !== currency || e.payerId === who || at === undefined || !Number.isFinite(at) || isSettledInGroup(e, data.groups)) continue
          const day = dayOf(at)
          if (day <= data.today && inRange(day)) payments += e.shares[who] ?? 0
        }
      }
    }
    return answer({
      amount: inCurrency.reduce((sum, e) => sum + e.total, 0),
      count: inCurrency.length,
      rows: [...inCurrency].sort(byTotal((e) => e.total)).slice(0, MAX_LIST).map((e) => expenseRow(e)),
      leftOut: leftOutOf(bills),
      personId: who,
      payments,
    })
  }

  /* ---- one person's share ---- */
  if (intent === 'friendShare' && filters.friendId) {
    const who = filters.friendId
    const shareOf = (e: Expense): Minor => e.shares[who] ?? 0
    const list = data.expenses.filter((e) => inFilters(e) && shareOf(e) > 0)
    const inCurrency = list.filter((e) => e.currency === currency)
    return answer({
      amount: inCurrency.reduce((sum, e) => sum + shareOf(e), 0),
      count: inCurrency.length,
      rows: [...inCurrency].sort(byTotal(shareOf)).slice(0, MAX_LIST).map((e) => expenseRow(e, shareOf(e))),
      leftOut: leftOutOf(list),
      personId: who,
    })
  }

  const matching = data.expenses.filter((e) => inFilters(e) && (group !== null || involved(e)))

  if (intent === 'lastExpense') {
    const sorted = [...matching].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1)))
    const top = sorted[0]
    const share = top ? (top.shares[me] ?? 0) : 0
    return answer({
      amount: top?.total ?? null,
      currency: top?.currency ?? currency,
      count: sorted.length,
      rows: sorted.slice(0, MAX_LIST).map((e) => expenseRow(e)),
      ...(top ? { date: top.date, title: top.title } : {}),
      ...(top && share > 0 && share !== top.total ? { share } : {}),
    })
  }

  if (intent === 'count') {
    const counted = filters.who === 'me' && !group ? matching.filter(involved) : matching
    return answer({
      amount: null,
      count: counted.length,
      rows: [...counted]
        .sort((a, b) => newestFirst({ date: a.date, key: a.id }, { date: b.date, key: b.id }))
        .slice(0, MAX_LIST)
        .map((e) => expenseRow(e)),
    })
  }

  const inCurrency = matching.filter((e) => e.currency === currency)
  const leftOut = leftOutOf(matching)

  if (intent === 'topPayer') {
    const byPayer = new Map<string, Minor>()
    for (const e of inCurrency) byPayer.set(e.payerId, (byPayer.get(e.payerId) ?? 0) + e.total)
    const people = [...byPayer.entries()].map(([id, amount]) => ({ id, amount, name: nameOf(id) })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
    const top = people[0]
    return answer({
      amount: top?.amount ?? null,
      count: people.length,
      leftOut,
      rows: people.slice(0, MAX_LIST).map((p) => ({ key: p.id, title: p.name, amount: p.amount, currency, date: null, path: p.id === me ? null : friendPath(p.id) })),
      ...(top ? { personId: top.id } : {}),
    })
  }

  if (intent === 'biggest') {
    const sorted = [...inCurrency].sort(byTotal((e) => e.total))
    const top = sorted[0]
    return answer({
      amount: top?.total ?? null,
      count: sorted.length,
      leftOut,
      rows: sorted.slice(0, MAX_LIST).map((e) => expenseRow(e)),
      ...(top ? { date: top.date, title: top.title } : {}),
    })
  }

  // spent, per day and breakdowns: my share, or the whole bill
  const valueOf = (e: Expense): Minor => (filters.who === 'me' ? (e.shares[me] ?? 0) : e.total)
  const counted = inCurrency.filter((e) => valueOf(e) > 0)
  const total = counted.reduce((sum, e) => sum + valueOf(e), 0)

  if (intent === 'breakdown') {
    const by = reading.by ?? 'category'
    const buckets = new Map<string, AskRow>()
    for (const e of counted) {
      const known = e.groupId !== null ? data.groups.find((g) => g.id === e.groupId) : undefined
      const key = by === 'category' ? e.category : by === 'group' ? (known?.id ?? '') : e.date.slice(0, 7)
      const slot = buckets.get(key) ?? {
        key: `${by}:${key}`,
        title: by === 'category' ? categoryLabel(e.category) : by === 'group' ? (known?.name ?? t('ask.breakdown.noGroup')) : monthLabel(key),
        amount: 0,
        currency,
        date: null,
        path: by === 'group' && known ? groupPath(known.id) : null,
      }
      slot.amount += valueOf(e)
      buckets.set(key, slot)
    }
    const rows = [...buckets.values()].sort((a, b) => (by === 'month' ? (a.key < b.key ? 1 : -1) : b.amount - a.amount || a.title.localeCompare(b.title)))
    return answer({ amount: total, count: rows.length, leftOut, rows: rows.slice(0, MAX_LIST) })
  }

  const rows = [...counted].sort(byTotal(valueOf)).slice(0, MAX_LIST).map((e) => expenseRow(e, valueOf(e)))

  if (intent === 'perDay') {
    if (counted.length === 0) return answer({ amount: null, count: 0, leftOut, days: 0 })
    const dates = counted.map((e) => e.date).sort()
    const from = r ? r.from : (dates[0] ?? data.today)
    const to = r ? (r.to < data.today ? r.to : data.today) : (dates.at(-1) ?? data.today)
    const days = Math.max(1, daysBetween(from, to) + 1)
    return answer({ amount: Math.round(total / days), count: counted.length, leftOut, rows, days })
  }

  // The whole bill in the headline: my part of it underneath.
  const share = filters.who === 'we' ? counted.reduce((sum, e) => sum + (e.shares[me] ?? 0), 0) : null
  return answer({ amount: total, count: counted.length, leftOut, rows, ...(share !== null && counted.length > 0 && share !== total ? { share } : {}) })
}
