/**
 * The live check while you speak a split: what Settle has understood so far, worked out on the
 * phone from the words as they come in (no network, a few hundredths of a millisecond per word),
 * so you can see straight away whether it heard you right: the amounts, who paid, the people
 * (matched to your people or new), and how it's split. The AI reads the whole sentence once you
 * stop; this is only the quick look, and it says so.
 */
import { fold, rankNameCandidates, sureMatch, type NamePerson } from '../../../shared/nameMatch'
import { normalizeNumberWords } from '../../../shared/numberWords'
import { repairSpokenText } from '../../../shared/spoken'

export type TokenKind = 'amount' | 'person' | 'maybe' | 'newName' | 'me' | 'word'

export interface LiveToken {
  text: string
  kind: TokenKind
  /** For `person`/`maybe`: who it matched. */
  personId?: string
}

export interface LivePerson {
  /** As said. */
  said: string
  /** A friend id when it surely means one of your people. */
  id: string | null
  /** The friend's name, or what was said. */
  name: string
  /** `sure` one of your people; `maybe` sounds like someone (several, or a guess); `new` nobody like it. */
  match: 'sure' | 'maybe' | 'new' | 'me'
}

export type LiveMode = 'equal' | 'exact' | 'percent' | 'shares'

export interface LivePreview {
  /** The text after number words became digits and recogniser slips were fixed. */
  text: string
  tokens: LiveToken[]
  /** Every amount heard, in order (major units). */
  amounts: number[]
  /** The bill's total as far as can be told: said as a total, else the biggest amount. */
  total: number | null
  /** Who paid, as said ("You" for I/me), or null when not said yet. */
  payer: LivePerson | null
  people: LivePerson[]
  mode: LiveMode
  /** Several bills in one go ("…and then the cab…"). */
  bills: number
}

/** Words that are never names, even capitalised at the start of a sentence. */
const NOT_NAMES = new Set(
  (
    'a an and the with for of to in on at by from paid pay pays paying split splitting between among equally equal evenly each ' +
    'everyone everybody all us we our total bill dinner lunch breakfast cab taxi uber ola auto petrol fuel rent movie tickets ' +
    'drinks food groceries hotel villa flight train bus trip party snacks coffee tea chai rupees rs inr hundred thousand lakh ' +
    'rest remaining then also plus minus but not except without only had has have was is it that this these those my me i ' +
    'myself mine you your he she they them his her their double twice half triple times percent share shares owes owe gave ' +
    'got kept took for, today yesterday tonight last night ka ki ke ko ne se mein me aur sab sabka sabhi barabar diya kiya ' +
    'wala wali hai tha thi bhi toh to yaar bro bhai ok okay so um uh hmm like just'
  ).split(' '),
)
/** A new name is one that comes after these ("with Zubin", "and Zubin")… */
const PERSON_BEFORE = new Set(['with', 'and', 'between', 'among', 'amongst', 'me', 'plus', 'except', 'by', 'aur'])
/** …or before these ("Zubin paid", "Zubin had 400"). */
const PERSON_AFTER = new Set(['paid', 'pays', 'had', 'owes', 'ne', 'covered', 'and'])
const ME_WORDS = new Set(['i', 'me', 'myself', 'mine', 'main', 'maine', 'mujhe', 'mera', 'meri', 'mere'])
const TOTAL_CUE = /\b(?:total|bill|came to|altogether|in all|overall|kul)\b/i
const EQUAL_CUE = /\b(?:equally|equal|evenly|barabar|half half|same each)\b/i
const PERCENT_CUE = /%|\bpercent\b/i
const SHARES_CUE = /\b(?:double|twice|triple|half|\d+(?:\.\d+)?\s*(?:x|times)|shares?)\b/i
const BILL_BREAK = /\b(?:and then|then|also|plus|next|after that|phir|aur phir)\b/gi

/** A word as said: letters, digits (with Indian grouping), or a %/₹ sign. */
const WORD = /[₹$]?\d[\d,]*(?:\.\d+)?%?|[\p{L}\p{M}][\p{L}\p{M}'’.-]*|%/gu

function amountOf(word: string): number | null {
  const digits = word.replace(/[₹$,%]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(digits)) return null
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}

/**
 * The live view of `raw` (what the recogniser has so far). `people` are your people without you;
 * `nicknames` maps a folded nickname to a person's id.
 */
export function livePreview(
  raw: string,
  people: readonly NamePerson[],
  nicknames: Readonly<Record<string, string>> = {},
  currency: string | null = 'INR',
): LivePreview {
  const text = repairSpokenText(normalizeNumberWords(raw), currency)
  const tokens: LiveToken[] = []
  const amounts: number[] = []
  const found: LivePerson[] = []
  const seen = new Set<string>()
  let isPercent = false
  const words = text.match(WORD) ?? []
  let i = 0
  const firstNames = new Map<string, number>()
  for (const p of people) {
    const first = fold(p.name).split(' ')[0] ?? ''
    firstNames.set(first, (firstNames.get(first) ?? 0) + 1)
  }
  while (i < words.length) {
    const word = words[i] ?? ''
    const amount = amountOf(word)
    if (amount !== null) {
      amounts.push(amount)
      if (word.endsWith('%') || /^percent$/i.test(words[i + 1] ?? '')) isPercent = true
      tokens.push({ text: word, kind: 'amount' })
      i++
      continue
    }
    const key = fold(word)
    if (ME_WORDS.has(key)) {
      tokens.push({ text: word, kind: 'me' })
      if (!seen.has('me')) {
        seen.add('me')
        found.push({ said: word, id: null, name: 'You', match: 'me' })
      }
      i++
      continue
    }
    if (!key || NOT_NAMES.has(key) || key.length < 2) {
      tokens.push({ text: word, kind: 'word' })
      i++
      continue
    }
    // Two words that make one saved name ("Riya Sharma") beat one.
    const pair = i + 1 < words.length ? `${word} ${words[i + 1] ?? ''}` : null
    const pairMatch = pair ? sureMatch(rankNameCandidates(pair, people, nicknames, 3)) : null
    if (pair && pairMatch && fold(pairMatch.name) === fold(pair)) {
      tokens.push({ text: pair, kind: 'person', personId: pairMatch.id })
      addPerson(found, seen, { said: pair, id: pairMatch.id, name: pairMatch.name, match: 'sure' })
      i += 2
      continue
    }
    const candidates = rankNameCandidates(word, people, nicknames, 4)
    const sure = sureMatch(candidates)
    const capitalised = /^\p{Lu}/u.test(word)
    if (sure) {
      tokens.push({ text: word, kind: 'person', personId: sure.id })
      addPerson(found, seen, { said: word, id: sure.id, name: sure.name, match: 'sure' })
    } else if (candidates.length > 0 && (capitalised || (candidates[0]?.score ?? 0) >= 62)) {
      tokens.push({ text: word, kind: 'maybe', personId: candidates[0]?.person.id })
      addPerson(found, seen, { said: word, id: null, name: word, match: 'maybe' })
    } else if (capitalised && i > 0 && (PERSON_BEFORE.has(fold(words[i - 1] ?? '')) || PERSON_AFTER.has(fold(words[i + 1] ?? '')))) {
      // A capitalised word mid-sentence that isn't anyone you know: a new name (recognisers capitalise names).
      tokens.push({ text: word, kind: 'newName' })
      addPerson(found, seen, { said: word, id: null, name: word, match: 'new' })
    } else {
      tokens.push({ text: word, kind: 'word' })
    }
    i++
  }

  const payer = payerOf(text, found)
  const bills = Math.max(1, (text.match(BILL_BREAK) ?? []).filter(() => amounts.length > 1).length + 1)
  const totalCue = TOTAL_CUE.exec(text)
  let total: number | null = null
  if (amounts.length > 0) {
    if (totalCue) {
      const after = text.slice(totalCue.index).match(/\d[\d,]*(?:\.\d+)?/)
      total = after ? amountOf(after[0]) : null
    }
    if (total === null) total = bills > 1 ? amounts.reduce((a, b) => a + b, 0) : Math.max(...amounts)
  }

  let mode: LiveMode = 'equal'
  if (isPercent || PERCENT_CUE.test(text)) mode = 'percent'
  else if (SHARES_CUE.test(text) && !EQUAL_CUE.test(text)) mode = 'shares'
  else if (!EQUAL_CUE.test(text) && bills === 1 && amounts.length >= 2 && found.length >= 2) mode = 'exact'

  return { text, tokens, amounts, total, payer, people: found, mode, bills }
}

function addPerson(list: LivePerson[], seen: Set<string>, person: LivePerson): void {
  const key = person.id ?? `said:${fold(person.said)}`
  if (seen.has(key)) return
  seen.add(key)
  list.push(person)
}

/** "Riya paid", "paid by Riya", "I paid", "Riya ne diya": who paid, from the people found. */
function payerOf(text: string, found: readonly LivePerson[]): LivePerson | null {
  const folded = fold(text)
  if (/\b(?:i|me|maine|main)\s+(?:paid|pay kiya|diya|ne diya)\b|\bpaid by me\b/.test(folded)) {
    return found.find((p) => p.match === 'me') ?? { said: 'I', id: null, name: 'You', match: 'me' }
  }
  for (const person of found) {
    if (person.match === 'me') continue
    const said = fold(person.said)
    if (new RegExp(`\\b${escape(said)}\\s+(?:paid|pays|ne (?:diya|pay kiya|bhara)|covered)\\b|\\bpaid by\\s+${escape(said)}\\b`).test(folded)) return person
  }
  return null
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A split that reads as said in full: the pause that ends listening (ms). */
export const DONE_PAUSE_MS = 2_000
/** One that's clearly not finished ("…paid by", no amount yet, nobody named yet): people stop to think. */
export const THINKING_PAUSE_MS = 3_500

/** Words a sentence doesn't end on: more is coming. */
const DANGLING =
  /\b(?:and|with|between|among|amongst|for|by|paid by|split|split it|plus|then|the|a|an|to|of|is|was|were|came to|total|of us|except|but|had|have|me and|aur|ke saath|ne|ka|ki|ke|mein|se|um|uh|hmm)$/i

/**
 * How long a pause should end listening, from what's been heard so far: short once it reads as
 * a whole split (an amount and who was in it, not hanging on "and…"), longer while it doesn't.
 */
export function pauseToEnd(raw: string, people: readonly NamePerson[], nicknames: Readonly<Record<string, string>> = {}, currency: string | null = 'INR'): number {
  const text = raw.trim()
  if (!text) return THINKING_PAUSE_MS
  if (DANGLING.test(fold(text))) return THINKING_PAUSE_MS
  const preview = livePreview(text, people, nicknames, currency)
  if (preview.amounts.length === 0) return THINKING_PAUSE_MS
  const everyone = /\b(?:everyone|everybody|all of us|us all|sab|sabhi|the group|whole group|each|for \d+|of us)\b/i.test(text)
  const others = preview.people.filter((p) => p.match !== 'me').length
  if (others === 0 && !everyone) return THINKING_PAUSE_MS
  return DONE_PAUSE_MS
}
