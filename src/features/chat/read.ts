/**
 * Finds the money in a chat: "paid 1200 for the cab" is an expense Riya paid for everyone;
 * "sent Sam 500" is a payment between two people. Rules only (no AI, nothing leaves the phone),
 * English and everyday Hinglish, and deliberately careful: a line it isn't sure about comes back
 * marked `sure: false` for the person to tick, and a line that is a question, a request, a plan,
 * a price being discussed, a time, a date or a phone number isn't money that moved at all.
 */
import { MAX_MINOR } from '../../lib/money'
import type { ChatFile, ChatMessage } from './parse'

export type RowKind = 'expense' | 'payment'
/** Why a row needs a look: a bare "Cab 450"; a price, maybe; two amounts; "400 each"; "split 3 ways". */
export type Doubt = 'short' | 'price' | 'amounts' | 'each' | 'people' | 'untitled'

export interface ChatRow {
  /** Stable for the same message, so adding the same chat again adds nothing twice. */
  key: string
  kind: RowKind
  sure: boolean
  doubt: Doubt | null
  date: string
  /** Who paid (an expense) or who sent the money (a payment): one of `members`. */
  payer: string
  /** A payment: who got it. */
  to: string | null
  /** An expense: what it was ("Cab"); empty when the message didn't say. */
  title: string
  /** Paise. */
  amount: number
  /** An expense: who shares it. */
  among: string[]
  /** An expense: shared by the whole chat (nobody was named), so it includes anyone added to the group later. */
  everyone: boolean
  /** The message, as written. */
  quote: string
}

export interface ChatReading {
  /** Everyone in the chat who can be on a split. */
  members: string[]
  rows: ChatRow[]
  /** How many messages were read. */
  messages: number
}

export const MAX_CHAT_MEMBERS = 60
export const MAX_CHAT_ROWS = 800
const MAX_TITLE = 48
const MAX_QUOTE = 160

/* ------------------------------------------------------------------ small tools */

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** FNV-1a, twice with different seeds: a 64-bit key as text. Not a secret, just an address. */
export function rowKey(parts: readonly (string | number)[]): string {
  const text = parts.join('\u0001')
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ (c + i), 0x85ebca6b)
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}

const MONTH = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'

/** Things with digits that are never an amount: blanked (same length) before amounts are looked for. */
const NOT_AMOUNTS: readonly RegExp[] = [
  /https?:\/\/\S+|www\.\S+/gi,
  /\+\d[\d\s-]{8,}\d/g,
  /\b\d{9,}(?![\d,.])/g,
  /\b[6-9]\d{4}\s\d{5}\b/g,
  /@\d+/g,
  /\b\d{1,2}[:.]\d{2}(?::\d{2})?\s?[ap]\.?m\b\.?/gi,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
  /\b\d{1,2}\s?[ap]\.?m\b\.?/gi,
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,
  /\b\d{1,2}(?:st|nd|rd|th)\b/gi,
  new RegExp(String.raw`\b\d{1,2}\s?(?:${MONTH})\b(?:\s?\d{4}\b)?`, 'gi'),
  new RegExp(String.raw`\b(?:${MONTH})\s?\d{1,2}\b(?:,?\s?\d{4}\b)?`, 'gi'),
  new RegExp(String.raw`\b(?:${MONTH}|in|since|year)\s(?:19|20)\d{2}\b`, 'gi'),
  /\d+(?:\.\d+)?\s?(?:%|percent\b)/gi,
]

function blank(text: string): string {
  let out = text
  for (const pattern of NOT_AMOUNTS) out = out.replace(pattern, (m) => ' '.repeat(m.length))
  return out
}

const NUMBER = /(^|[^\p{L}\p{N}])(?:(₹|rs\.?|inr)\s?)?(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?:\s?(k|lakhs?|lacs?)(?![\p{L}\p{N}]))?(?:\s?(\/-|\/=|rs\b\.?|rupees?\b|rupaye\b|rupay\b|₹|bucks\b|inr\b)|(?![\p{L}\p{N}]|[.,]\d))/giu

/** A number followed by one of these counts something, it isn't money. */
const UNIT_AFTER =
  /^\s?(?:people|persons?|pax|ppl|guys|of us|nights?|days?|hrs?|hours?|mins?|minutes?|kms?|kgs?|gms?|grams?|ml|ltrs?|litres?|liters?|beers?|pegs?|pieces?|pcs|plates?|tickets?|seats?|rooms?|bottles?|times|x\b|ways?|members?|heads?|adults?|kids?|weeks?|months?|years?|yrs?|star|bhk|gb|mb|baje|log|logo|din|raat|cups?|glasses|rounds?|shots?|pints?|more\b|others?)\b/i
/** A number right after one of these names something, it isn't money. */
const LABEL_BEFORE = /(?:\botp|\bkms?|\bcode|\bpin|\bpnr|\bflight|\bseat|\broom|\bgate|\bplatform|\bcoach|\bno\.?|\bnumber|#|\btable|\border|\bref|\bid|\butr|\btxn|\ba\/c|\baccount|\bending|\bupi)\s*[:#-]?\s*$/i
const CLOCK_BEFORE = /\b(?:at|by|till|until|before|after|around|baje)\s*$/i

interface Found {
  /** Paise. */
  value: number
  marked: boolean
  start: number
  end: number
}

function amountsIn(text: string): Found[] {
  const clean = blank(text)
  const out: Found[] = []
  for (const m of clean.matchAll(NUMBER)) {
    const [whole, lead = '', before, digits, scale, after] = m
    // A bare number right after a dot or a comma is the tail of another number ("v1.5").
    if (!before && (lead === '.' || lead === ',')) continue
    const body = whole.slice(lead.length)
    const start = m.index + lead.length
    const end = start + body.length
    const number = Number((digits ?? '').replace(/,/g, ''))
    if (!Number.isFinite(number)) continue
    const marked = Boolean(before ?? after)
    const big = scale ? (/^k$/i.test(scale) ? 1000 : 100_000) : 1
    const rupees = number * big
    if (rupees < 1) continue
    if (!marked) {
      if (rupees < 10) continue
      if (UNIT_AFTER.test(clean.slice(end))) continue
      const lead = clean.slice(0, start)
      if (LABEL_BEFORE.test(lead)) continue
      if (rupees <= 24 && CLOCK_BEFORE.test(lead)) continue
    }
    const value = Math.round(rupees * 100)
    if (value <= 0 || value > MAX_MINOR / 100) continue
    out.push({ value, marked, start, end: start + body.trimEnd().length })
  }
  return out
}

/**
 * Where a word pattern really matched. The word patterns here begin with "the start, or a
 * character that isn’t a letter" (Safari before 16.4 has no lookbehind), so a match may
 * carry that one character in front: this steps over it.
 */
function wordAt(pattern: RegExp, text: string): { index: number; text: string } | null {
  const m = pattern.exec(text)
  if (!m) return null
  const lead = /^[^\p{L}]/u.test(m[0]) ? 1 : 0
  return { index: m.index + lead, text: m[0].slice(lead) }
}

/* ------------------------------------------------------------------ people */

const ME_WORDS = /(?:^|[^\p{L}\p{N}])(?:me|i|my|myself|mine|mera|meri|mere|main|mai|maine|mujhe)(?![\p{L}\p{N}])/iu

interface Mention {
  name: string
  start: number
  end: number
}

interface People {
  members: string[]
  /** Every place a member is named in `text` (full name, or a first name only one of them has). */
  find: (text: string) => Mention[]
}

function peopleOf(members: readonly string[]): People {
  const firsts = new Map<string, number>()
  for (const name of members) {
    const first = name.split(/\s+/)[0]?.toLowerCase() ?? ''
    firsts.set(first, (firsts.get(first) ?? 0) + 1)
  }
  const patterns: Array<{ name: string; pattern: RegExp }> = []
  for (const name of members) {
    const forms = [name]
    const first = name.split(/\s+/)[0] ?? ''
    if (first !== name && first.length >= 3 && firsts.get(first.toLowerCase()) === 1 && /^\p{L}+$/u.test(first)) forms.push(first)
    const body = forms.map(escapeRegExp).join('|')
    patterns.push({ name, pattern: new RegExp(`(^|[^\\p{L}\\p{N}])@?(?:${body})(?![\\p{L}\\p{N}])`, 'giu') })
  }
  return {
    members: [...members],
    find: (text) => {
      const out: Mention[] = []
      for (const { name, pattern } of patterns) for (const m of text.matchAll(pattern)) out.push({ name, start: m.index + (m[1]?.length ?? 0), end: m.index + m[0].length })
      // A full name wins over the first name inside it.
      return out.filter((a) => !out.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start)).sort((a, b) => a.start - b.start)
    },
  }
}

/* ------------------------------------------------------------------ what a line is */

/** Not money that moved: questions, requests, plans, what someone owes, a sum of earlier lines. */
const NOT_A_PAYMENT: readonly RegExp[] = [
  /\?\s*$/,
  /^(?:how much|kitn[ae]|did|does|do|who|what|when|where|why|is|are|kya|kisne|kaun|can|could|should|shall|will)\b/i,
  /\b(?:pay me|send me|give me|transfer me|you owe|u owe|owes?|owed|i owe|we owe|baa?ki|udhaa?r|pending|due|remind|will (?:pay|send|give|transfer|book|get)|i'?ll (?:pay|send|give|transfer|book|get)|we'?ll (?:pay|send|give|transfer|book|get)|gonna|going to|have to|has to|need to|needs to|want to|wants to|yet to|to be paid|let'?s|lets|please|pls|plz|kindly|kar ?do|kar ?dena|bhej ?do|bhej ?dena|de ?do|de ?dena|dena hai|bhejna hai|karna hai|chahiye)\b/i,
  /\b(?:not paid|didn'?t pay|did not pay|haven'?t paid|hasn'?t paid|never paid|not yet|nahi? diy[ae]|nhi diy[ae]|nahi? kiy[ae])\b/i,
  /^(?:total|sub ?total|sum|grand total|balance|net)\b/i,
  /\b(?:comes to|works out|adds up|each owes|everyone owes|everyone pays|each pays|share is|share comes|per head comes|in total we)\b/i,
  /\b(?:otp|one[- ]time|debited|credited|a\/c|upi ref|txn id|available balance|avl bal)\b/i,
]

const PAID_VERB =
  /(?:^|[^\p{L}])(?:paid|payed|spent|bought|booked|tipped|recharged|gave|given|payment done|done payment|de ?diy[ae]|diy[ae]|bhar ?diy[ae]|bhar[ae]|kharch[ae]?|le ?liy[ae]|liy[ae]|kar ?diy[ae]|kiy[ae])(?![\p{L}])/iu
const SENT_VERB =
  /(?:^|[^\p{L}])(?:sent|transferred|transfered|gpay(?:ed|'d|d)?|g ?pay(?:ed|'d)|phonepe(?:d|'d)?|paytm(?:ed|'d)?|upi(?:ed|'d)|returned|repaid|paid back|settled|cleared|bhej ?diy[ae]|bhej[ae]|wapas|lauta(?:y[ae]|diy[ae])?|chuka(?:y[ae]|diy[ae])?)(?![\p{L}])/iu
const GOT_VERB = /(?:^|[^\p{L}])(?:received|recieved|recd|rcvd|got|mil[ae]|mil gay[ae])(?![\p{L}])/iu
const PRICE_TALK =
  /\b(?:costs?|price|priced|quote[ds]?|charging|asking|approx|approximately|around|about|estimate[ds]?|budget|per night|per day|a night|a day|rate|fare is|will be|would be|should be|might be|maybe|max|upto|up to|less than|more than|offer|discount|deal|available for|starts? (?:at|from))\b/i
const EACH = /(?:^|[^\p{L}])(?:each|per head|per person|per pax|pp|a head|apiece|\/\s?head|\/\s?person|har ek|each one)(?![\p{L}])/iu
const WAYS = /(?:split|divided?|shared?)\s?(?:equally\s)?(?:in|by|among|between|into)\s?(\d{1,2})(?:\s?(?:ways?|people|persons?|of us|parts?|heads?))?\b|\b(\d{1,2})\s?(?:ways|of us)\b|\/\s?(\d{1,2})(?![\d-])/i
const EXCEPT = /(?:^|[^\p{L}])(?:except|excluding|exclude|without|minus|not including|other than|leaving out|leaving|chh?od ?k[ea]r?|k[ei] bina|bina)(?![\p{L}])/iu
const AMONG_START = /(?:^|[^\p{L}])(?:for|between|among|amongst|b\/w|btw|with|only)(?![\p{L}])/giu
const EVERYONE = /(?:^|[^\p{L}])(?:all of us|everyone|everybody|all|sab|sabka|hum sab)(?![\p{L}])/iu
const CONNECT = /^(?:\s*(?:,|&|\+|(?:and|n|aur)(?![\p{L}]))\s*|\s+)/iu

interface Among {
  names: string[]
  /** Nobody was named: the whole chat. */
  everyone: boolean
  /** What to cut out of the title. */
  spans: Array<[number, number]>
  doubt: boolean
}

function amongOf(text: string, sender: string, actor: string, people: People): Among {
  const mentions = people.find(text)
  const all = people.members
  const spans: Array<[number, number]> = []

  const except = wordAt(EXCEPT, text)
  if (except) {
    const from = except.index
    const after = mentions.filter((m) => m.start >= from)
    // "Sam ko chhod ke": the name comes first.
    const before = after.length === 0 ? mentions.filter((m) => m.end <= from && from - m.end <= 6).slice(-1) : []
    const out = new Set([...after, ...before].map((m) => m.name))
    if (ME_WORDS.test(text.slice(from))) out.add(sender)
    if (out.size > 0 && out.size < all.length) {
      spans.push([before[0]?.start ?? from, text.length])
      return { names: all.filter((n) => !out.has(n)), everyone: false, spans, doubt: false }
    }
  }

  for (const start of text.matchAll(AMONG_START)) {
    const lead = /^[^\p{L}]/u.test(start[0]) ? 1 : 0
    const word = start[0].slice(lead).toLowerCase()
    const from = start.index + lead
    let at = start.index + start[0].length
    const named = new Set<string>()
    let me = false
    for (;;) {
      const gap = CONNECT.exec(text.slice(at))
      const next = at + (gap?.[0].length ?? 0)
      const mention = mentions.find((m) => m.start === next)
      if (mention) {
        named.add(mention.name)
        at = mention.end
        continue
      }
      const self = /^(?:me|myself|i|us)(?![\p{L}\p{N}])/iu.exec(text.slice(next))
      if (self && gap) {
        if (self[0].toLowerCase() !== 'us') me = true
        at = next + self[0].length
        continue
      }
      break
    }
    if (named.size === 0) continue
    if (me) named.add(sender)
    if (word === 'with') named.add(actor)
    // "for Sam" alone is a payment or a gift for Sam, not a split.
    if (named.size < 2 && word !== 'only') continue
    spans.push([from, at])
    return { names: all.filter((n) => named.has(n)), everyone: false, spans, doubt: false }
  }

  const ways = WAYS.exec(text)
  const count = Number(ways?.[1] ?? ways?.[2] ?? ways?.[3] ?? 0)
  if (ways) spans.push([ways.index, ways.index + ways[0].length])
  if (count >= 2 && count !== all.length && !EVERYONE.test(text)) return { names: all, everyone: true, spans, doubt: true }
  return { names: all, everyone: true, spans, doubt: false }
}

/* ------------------------------------------------------------------ titles */

const FILLER =
  /^(?:i|we|he|she|they|have|has|had|just|already|also|paid|payed|spent|gave|given|bought|booked|got|took|did|done|payment|pay|sent|transferred|transfered|for|the|a|an|on|of|at|in|to|total|was|is|it|its|it's|came|cost|costs|maine|humne|ne|ke liye|ke|ka|ki|ko|liya|liye|diya|diye|kiya|kiye|kar|de|bhar|bhara|bhare|hai|hain|tha|the|thi|rs|rupees|only|so|ok|okay|and|then|guys|hey|fyi|btw|update|note|today|yesterday|tonight|now|here|there|my|me|our|us|all|everyone|from|by|with|split|equally|share|shared|each|per head|per person|bill|around|approx|approximately|about|roughly|think|guess|maybe|only|paise|extra)$/i
const EDGE = /^[\s\-–—:;,.()[\]=*_~>|/+&!]+|[\s\-–—:;,.()[\]=*_~>|/+&!]+$/g

function cut(text: string, spans: ReadonlyArray<readonly [number, number]>): string {
  let out = text
  const sorted = [...spans].sort((a, b) => b[0] - a[0])
  for (const [from, to] of sorted) out = out.slice(0, Math.max(0, from)) + ' ' + out.slice(Math.min(out.length, to))
  return out
}

function titleOf(text: string, spans: ReadonlyArray<readonly [number, number]>, people: People): string {
  const whole = cut(text, spans).replace(EACH, ' ').replace(/\s+/g, ' ').trim()
  const purpose = /(?:^|[^\p{L}])for\s+(?:the\s+|a\s+|an\s+|our\s+|my\s+)?(.+)$/iu.exec(whole)
  const names = new Set(people.members.map((n) => n.toLowerCase()))
  const filler = (word: string | undefined): boolean => {
    if (word === undefined) return false
    const bare = word.replace(EDGE, '')
    return bare === '' || /^(?:\d+|[x×*=])$/i.test(bare) || FILLER.test(bare) || names.has(bare.toLowerCase()) || names.has(bare.replace(/^@/, '').toLowerCase())
  }
  const tidy = (from: string): string => {
    let words = (from.split(/[.!\n]/).find((piece) => /\p{L}/u.test(piece)) ?? '').replace(EDGE, '').split(/\s+/).filter(Boolean)
    while (words.length > 0 && filler(words[0])) words = words.slice(1)
    while (words.length > 0 && filler(words[words.length - 1])) words = words.slice(0, -1)
    return words.join(' ').replace(EDGE, '')
  }
  // "paid 500 for the cab" → the cab; "I paid for all" says nothing, so the rest of the line is looked at.
  let title = purpose?.[1] && /\p{L}/u.test(purpose[1]) ? tidy(purpose[1]) : ''
  if (!/\p{L}/u.test(title)) title = tidy(whole)
  if (!/\p{L}/u.test(title)) return ''
  if (title.length > MAX_TITLE) title = title.slice(0, MAX_TITLE).replace(/\s+\S*$/, '').trim()
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/* ------------------------------------------------------------------ one line */

const LINK = /https?:\/\/\S+|www\.\S+/gi

type Draft = Omit<ChatRow, 'key' | 'date' | 'quote'>

/** A line that is just a thing and its price: "Cab 450", "Dinner - ₹2,400", "450 cab". */
function isListLine(line: string): boolean {
  const found = amountsIn(line)
  if (found.length !== 1) return false
  const words = line.trim().split(/\s+/)
  if (words.length > 7) return false
  if (PAID_VERB.test(line) || SENT_VERB.test(line) || GOT_VERB.test(line)) return false
  return /\p{L}{2,}/u.test(cut(line, [[found[0]?.start ?? 0, found[0]?.end ?? 0]]))
}

function readLine(line: string, sender: string, people: People, listed: boolean): Draft | null {
  const raw = line.trim().replace(LINK, (m) => ' '.repeat(m.length))
  const text = raw.replace(/[‘’]/g, "'")
  if (text.trim() === '' || text.length > 280) return null
  if (NOT_A_PAYMENT.some((p) => p.test(text))) return null
  const found = amountsIn(text)
  if (found.length === 0) return null
  const first = found[0]
  if (!first) return null

  const mentions = people.find(text)
  const paid = wordAt(PAID_VERB, text)
  const sent = wordAt(SENT_VERB, text)
  const got = wordAt(GOT_VERB, text)
  const verb = paid ?? sent
  const verbAt = verb?.index ?? -1

  // "Sam paid 800 for lunch", "Sam ne 800 diye": Sam is the one who paid, whoever typed it.
  let actor = sender
  let actorSpan: [number, number] | null = null
  const lead = mentions[0]
  if (lead && lead.start <= 2) {
    const after = text.slice(lead.end)
    if (/^\s+(?:has |have |had |already |just |also )?(?:paid|payed|spent|gave|bought|booked|sent|transferred|returned|repaid)(?![\p{L}])/iu.test(after) || /^\s+ne(?![\p{L}])/iu.test(after)) {
      actor = lead.name
      actorSpan = [lead.start, lead.end]
    }
  }

  // Money between two people.
  const others = mentions.filter((m) => m.name !== actor && !(actorSpan && m.start === actorSpan[0]))
  let to: string | null = null
  let from: string | null = null
  if (got && !paid && !sent) {
    // "got 500 from Sam", "Sam se 500 mile"
    const giver = others.find((m) => /(?:^|[^\p{L}])from\s+@?$/iu.test(text.slice(0, m.start)) || /^\s+se(?![\p{L}])/iu.test(text.slice(m.end)))
    if (giver) {
      from = giver.name
      to = actor
    }
  } else if (verb) {
    const receiver = others.find((m) => {
      const before = text.slice(0, m.start)
      const after = text.slice(m.end)
      if (/^\s+ko(?![\p{L}])(?!\s+chh?od)/iu.test(after)) return true
      if (m.start < verbAt) return false
      if (/(?:^|[^\p{L}])to\s+@?$/iu.test(before)) return true
      return before.slice(verbAt + (verb.text.length)).replace(/\b(?:back|to)\b/gi, '').trim() === '' || before.slice(verbAt + (verb.text.length)).replace(/\b(?:back|to)\b/gi, '').trim() === '@'
    })
    if (receiver) {
      from = actor
      to = receiver.name
    } else if (people.members.length === 2 && /(?:^|[^\p{L}])(?:paid|sent|gave|transferred|returned|repaid|gpay\w*)\s+(?:back\s+)?(?:to\s+)?(?:you|u)(?![\p{L}])/iu.test(text)) {
      from = actor
      to = people.members.find((n) => n !== actor) ?? null
    } else if (actor !== sender && /(?:^|[^\p{L}])(?:paid|sent|gave|transferred|returned|repaid|gpay\w*)\s+(?:back\s+)?(?:to\s+)?me(?![\p{L}])/iu.test(text)) {
      from = actor
      to = sender
    }
  }
  if (from && to && from !== to) {
    return { kind: 'payment', sure: found.length === 1, doubt: found.length === 1 ? null : 'amounts', payer: from, to, title: '', amount: first.value, among: [], everyone: false }
  }
  if (got && !paid && (!/^got$/i.test(got.text) || /(?:^|[^\p{L}])(?:back|refund\w*|cashback|from)(?![\p{L}])/iu.test(text))) return null

  // An expense.
  const among = amongOf(text, sender, actor, people)
  const each = EACH.test(text)
  const plus = found.length > 1 && found.every((f, i) => i === 0 || /^\s*\+\s*$/.test(blank(text).slice(found[i - 1]?.end ?? 0, f.start)))
  const summed = found.length > 1 ? found.find((f) => /=\s*(?:₹|rs\.?|inr)?\s*$/i.test(blank(text).slice(0, f.start)) || /=\s*$/.test(text.slice(0, f.start))) : undefined
  let amount = summed ? summed.value : plus ? found.reduce((sum, f) => sum + f.value, 0) : first.value
  let doubt: Doubt | null = null
  if (found.length > 1 && !plus && !summed) doubt = 'amounts'
  if (each) {
    amount = amount * Math.max(1, among.names.length)
    doubt = doubt ?? 'each'
  }
  if (among.doubt) doubt = doubt ?? 'people'
  if (amount <= 0 || amount > MAX_MINOR / 100) return null

  const spans: Array<[number, number]> = [...found.map((f): [number, number] => [f.start, f.end]), ...among.spans]
  if (actorSpan) spans.push(actorSpan)
  const title = titleOf(raw, spans, people)

  const price = PRICE_TALK.test(text)
  const words = cut(text, spans).split(/\s+/).filter(Boolean).length
  const marked = found.some((f) => f.marked)
  let sure: boolean
  if (paid) sure = true
  else if (listed) sure = true
  else if (marked && title !== '' && !price) sure = true
  else if (title !== '' && words <= 7 && (found.length === 1 || summed !== undefined) && !price) {
    sure = false
    doubt = doubt ?? 'short'
  } else if (price && (marked || words <= 7) && title !== '') {
    sure = false
    doubt = 'price'
  } else return null
  if (price && paid === null) {
    sure = false
    doubt = 'price'
  }
  if (title === '') {
    if (!paid) return null
    sure = false
    doubt = doubt ?? 'untitled'
  }
  if (doubt !== null) sure = false
  return { kind: 'expense', sure, doubt, payer: actor, to: null, title, amount, among: among.names, everyone: among.everyone }
}

/* ------------------------------------------------------------------ a whole chat */

/** Names WhatsApp's own notes can leave behind when they contain a colon. */
const NOT_A_PERSON = /["“”]| (?:added|removed|changed|created|joined using|left)(?: |$)/i

const BULLET = /^\s*(?:[-*\u2022]+|\d{1,2}[.)])\s+(?=\S)/

function partsOf(message: ChatMessage): Array<{ text: string; listed: boolean }> {
  const lines = message.text.split('\n').map((l) => l.replace(BULLET, '').trim()).filter(Boolean)
  const listLines = lines.filter(isListLine).length
  const out: Array<{ text: string; listed: boolean }> = []
  for (const line of lines) {
    const listed = listLines >= 2 && isListLine(line)
    // "cab 450, dinner 2400": one line, two things.
    const pieces = line.split(/\s*[,;]\s+|\s+and\s+/i)
    if (pieces.length > 1 && pieces.length <= 8 && pieces.every(isListLine)) for (const piece of pieces) out.push({ text: piece, listed: true })
    else out.push({ text: line, listed })
  }
  return out
}

interface Told {
  draft: Draft
  date: string
  sender: string
  /** The row it became (a later recap can confirm it). */
  row: ChatRow | null
}

const wordsOf = (title: string): string[] => title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3)
const daysApart = (a: string, b: string): number => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000

/**
 * Money the chat has already told: a line of a list ("Day 1: Homestay 9000, Lunch 1860…") that
 * repeats an expense said earlier, or the other person confirming a payment ("got 2000 from
 * Aditya" after Aditya’s "sent Nikhil 2000").
 */
function repeatOf(draft: Draft, listed: boolean, message: ChatMessage, told: readonly Told[]): Told | null {
  if (draft.kind === 'payment') {
    return told.find((t) => t.draft.kind === 'payment' && t.sender !== message.sender && t.draft.payer === draft.payer && t.draft.to === draft.to && t.draft.amount === draft.amount && daysApart(t.date, message.date) <= 2) ?? null
  }
  if (!listed) return null
  const mine = wordsOf(draft.title)
  const hit = told.find((t) => {
    if (t.draft.kind !== 'expense' || t.draft.amount !== draft.amount || daysApart(t.date, message.date) > 7) return false
    const theirs = wordsOf(t.draft.title)
    return mine.length === 0 || theirs.length === 0 || mine.some((w) => theirs.includes(w))
  })
  return hit ?? null
}

/** Everything in the chat that looks like money, oldest first. */
export function readChat(file: ChatFile): ChatReading {
  const members = file.senders.filter((name) => !NOT_A_PERSON.test(name)).slice(0, MAX_CHAT_MEMBERS)
  const people = peopleOf(members)
  const known = new Set(members)
  const rows: ChatRow[] = []
  const seen = new Map<string, number>()
  const told: Told[] = []
  for (const message of file.messages) {
    if (!known.has(message.sender)) continue
    const parts = partsOf(message)
    for (const [index, part] of parts.entries()) {
      const draft = readLine(part.text, message.sender, people, part.listed)
      if (!draft) continue
      const repeat = repeatOf(draft, part.listed, message, told)
      if (repeat) {
        // Said again in a list: a bare "Beer 1200" that was only offered is now known to be money spent.
        if (repeat.row && repeat.row.kind === 'expense' && repeat.row.doubt === 'short') {
          repeat.row.sure = true
          repeat.row.doubt = null
        }
        continue
      }
      // The same words from the same person in the same minute twice (it happens) are two rows.
      const base = rowKey([message.date, message.minutes, message.sender, message.text, index])
      const nth = seen.get(base) ?? 0
      seen.set(base, nth + 1)
      const row: ChatRow = { ...draft, key: nth === 0 ? base : `${base}.${nth}`, date: message.date, quote: part.text.length > MAX_QUOTE ? `${part.text.slice(0, MAX_QUOTE - 1)}…` : part.text }
      rows.push(row)
      told.push({ draft, date: message.date, sender: message.sender, row })
      if (rows.length >= MAX_CHAT_ROWS) return { members, rows, messages: file.messages.length }
    }
  }
  return { members, rows, messages: file.messages.length }
}
