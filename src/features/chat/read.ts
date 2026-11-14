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
/** Why a row needs a look: a bare "Cab 450"; a price, maybe; two amounts; "400 each"; "split 3 ways"; a question; said before; two people share the name. */
export type Doubt = 'short' | 'price' | 'amounts' | 'each' | 'people' | 'untitled' | 'asked' | 'repeat' | 'who'

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
  // Other money: "USD 20", "$20", "20 dollars" are not rupees.
  /(?:\busd|\beur|\baed|\bgbp|\bsgd|\bthb|[$€£])\s?\d[\d,.]*/gi,
  /\d[\d,.]*\s?(?:usd|dollars?|euros?|eur|aed|dirhams?|gbp|pounds?|sgd|baht|thb)\b/gi,
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
const LABEL_BEFORE = /(?:\botp|\bkms?|\bcode|\bpin|\bpincode|\bpnr|\bflight|\bseat|\broom|\bgate|\bplatform|\bcoach|\bno\.?|\bnumber|#|\btable|\bref|\bid|\butr|\btxn|\ba\/c|\baccount|\bending|\bupi|\bscore|\bage)(?:\s+(?:is|was|no\.?|number))?\s*[:#-]?\s*$/i
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
  /** Is someone named by a first name that two or more members share ("Rahul" with two Rahuls)? */
  unclear: (text: string) => boolean
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
  const shared = [...firsts.entries()].filter(([first, count]) => count > 1 && first.length >= 3 && /^\p{L}+$/u.test(first) && !members.some((m) => m.toLowerCase() === first)).map(([first]) => first)
  const sharedPattern = shared.length > 0 ? new RegExp(`(^|[^\\p{L}\\p{N}])@?(?:${shared.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null
  return {
    members: [...members],
    unclear: (text) => {
      if (!sharedPattern) return false
      const full = patterns.flatMap(({ pattern }) => [...text.matchAll(pattern)].map((m) => [m.index, m.index + m[0].length] as const))
      for (const m of text.matchAll(sharedPattern)) {
        const at = m.index + (m[1]?.length ?? 0)
        // "Rahul Mehta" in full is clear; a bare "Rahul" is not.
        if (!full.some(([from, to]) => from <= at && to >= m.index + m[0].length && to - from > m[0].length)) return true
      }
      return false
    },
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
  /\b(?:pay me|send me|give me|transfer me|you owe|u owe|owes?|owed|i owe|we owe|baa?ki|udhaa?r(?!\s+(?:de\s?)?diy[ae])|pending|due|remind|will (?:pay|send|give|transfer|book|get)|i'?ll (?:pay|send|give|transfer|book|get)|we'?ll (?:pay|send|give|transfer|book|get)|gonna|going to|have to|has to|need to|needs to|want to|wants to|yet to|to be paid|let'?s|lets|please|pls|plz|kindly|kar ?do|kar ?dena|bhej ?do|bhej ?dena|de ?do|de ?dena|dena hai|bhejna hai|karna hai|chahiye)\b/i,
  /\b(?:not paid|didn'?t pay|did not pay|haven'?t paid|hasn'?t paid|never paid|not yet|nahi? diy[ae]|nhi diy[ae]|nahi? kiy[ae])\b/i,
  /^(?:sub ?total|sum|grand total|balance|net)\b/i,
  // Money that did not move.
  /\b(?:failed|fail ho|declined|unsuccessful|bounced|reversed|cancell?ed|refund(?:ed)?|didn'?t go through|did not go through|nahi? hu[ai])\b/i,
  /\b(?:comes to|works out|adds up|each owes|everyone owes|everyone pays|each pays|share is|share comes|per head comes|in total we)\b/i,
  /\b(?:otp|one[- ]time|available balance|avl bal)\b/i,
]
/** A recap line: skipped unless it says who paid ("total 1450 paid by me"). */
const TOTAL_LINE = /^total\b/i
/** What a bank or an app writes. Not a person saying they paid, unless they add that themselves ("UPI ref 4123… paid 900 for chai"). */
const BANK_TALK = /\b(?:debited|credited|a\/c|upi ref|txn|transaction|successful(?:ly)?)\b/i
/** Asked, not told. */
const ASKED = /\?/

const PAID_VERB =
  /(?:^|[^\p{L}])(?:paid|payed|spent|bought|booked|tipped|recharged|gave|given|payment done|done payment|de ?diy[ae]|diy[ae]|bhar ?diy[ae]|bhar[ae]|le ?liy[ae]|liy[ae]|kar ?diy[ae]|kiy[ae]|le ?aay[aei]|laa?y[aei]|mangw?a(?:y[aei]|liy[ae])|kharid[aei]|khareed[aei]|dalwa(?:y[aei]| ?diy[ae])?)(?![\p{L}])/iu
const SENT_VERB =
  /(?:^|[^\p{L}])(?:sent|lent|loaned|transferred|transfered|transfer(?: kar)? ?(?:kiy[ae]|diy[ae])|gpay(?:ed|'d|d)?|g ?pay(?:ed|'d)|phonepe(?:d|'d)?|paytm(?:ed|'d)?|upi(?:ed|'d)|returned|repaid|paid back|settled|cleared|bhej ?diy[ae]|bhej[ae]|wapas|lauta(?:y[ae]|diy[ae])?|chuka(?:y[ae]|diy[ae])?)(?![\p{L}])/iu
const GOT_VERB = /(?:^|[^\p{L}])(?:received|recieved|recd|rcvd|got|mil[ae]|mil gay[ae])(?![\p{L}])/iu
const PRICE_TALK =
  /\b(?:costs?|price|priced|quote[ds]?|charging|asking|approx|approximately|around|about|estimate[ds]?|budget|per night|per day|a night|a day|rate|fare is|will be|would be|should be|might be|maybe|max|upto|up to|less than|more than|offer|discount|deal|available for|starts? (?:at|from))\b/i
const EACH = /(?:^|[^\p{L}])(?:each|per head|per person|per pax|pp|a head|apiece|\/\s?head|\/\s?person|har ek|each one)(?![\p{L}])/iu
const WAYS = /(?:split|divided?|shared?)\s?(?:equally\s)?(?:in|by|among|between|into)\s?(\d{1,2})(?:\s?(?:ways?|people|persons?|of us|parts?|heads?))?\b|\b(\d{1,2})\s?(?:ways|of us|log|logo|logon|jan[ae])\b|\/\s?(\d{1,2})(?![\d-])|\bsplit\s(\d{1,2})(?![\d,.])/i
const EXCEPT = /(?:^|[^\p{L}])(?:except|excluding|exclude|without|minus|not including|other than|leaving out|leaving|chh?od ?k[ea]r?|k[ei] bina|bina)(?![\p{L}])/iu
const AMONG_START = /(?:^|[^\p{L}])(?:for|between|among|amongst|b\/w|btw|with|only|sirf|bas)(?![\p{L}])/giu
/** "Neha aur Aman ke saath", "Rohit ke beech": the names come first. */
const SAATH = /(?:^|[^\p{L}])(?:ke|k)\s?(?:saa?th|bee?ch|bich)(?![\p{L}])/iu
const JOINED = /^\s*(?:,|&|\+|and|n|aur)?\s*$/i
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

function amongOf(text: string, sender: string, actor: string, people: People, skip: readonly [number, number] | null = null): Among {
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

  const saath = wordAt(SAATH, text)
  if (saath) {
    const named: Mention[] = []
    let edge = saath.index
    for (const m of [...mentions].reverse()) {
      if (m.end > edge || !JOINED.test(text.slice(m.end, edge))) continue
      named.unshift(m)
      edge = m.start
    }
    const first = named[0]
    if (first) {
      const only = /(?:^|[^p{L}])(?:sirf|only|bas)s*$/iu.exec(text.slice(0, first.start))
      spans.push([only ? first.start - only[0].trimStart().length : first.start, saath.index + saath.text.length])
      const set = new Set([...named.map((m) => m.name), actor])
      if (set.size < all.length) return { names: all.filter((n) => set.has(n)), everyone: false, spans, doubt: false }
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
    if (named.size < 2 && word !== 'only' && word !== 'sirf' && word !== 'bas') continue
    spans.push([from, at])
    return { names: all.filter((n) => named.has(n)), everyone: false, spans, doubt: false }
  }

  // Dates are blanked first: "on 12/11" is not "split 11 ways".
  const ways = WAYS.exec(blank(text))
  const count = Number(ways?.[1] ?? ways?.[2] ?? ways?.[3] ?? ways?.[4] ?? 0)
  if (ways) spans.push([ways.index, ways.index + ways[0].length])
  if (count >= 2 && count !== all.length && !EVERYONE.test(text)) {
    // "split 3 (Aman, Neha, Sid)", "3 log baant lena Aman Neha": the count and the names agree.
    const listed = mentions.filter((m) => !(skip && m.start === skip[0]))
    const named = new Set(listed.map((m) => m.name))
    if (named.size === count - 1 && !named.has(actor)) named.add(actor)
    if (named.size === count) {
      for (const m of listed) spans.push([m.start, m.end])
      return { names: all.filter((n) => named.has(n)), everyone: false, spans, doubt: false }
    }
    return { names: all, everyone: true, spans, doubt: true }
  }
  return { names: all, everyone: true, spans, doubt: false }
}

/* ------------------------------------------------------------------ titles */

const FILLER =
  /^(?:i|we|he|she|they|have|has|had|just|already|also|paid|payed|spent|gave|given|bought|booked|got|took|did|done|payment|pay|sent|transferred|transfered|for|the|a|an|on|of|at|in|to|total|was|is|it|its|it's|came|cost|costs|maine|humne|ne|ke liye|ke|ka|ki|ko|liya|liye|diya|diye|kiya|kiye|kar|de|bhar|bhara|bhare|hai|hain|tha|the|thi|rs|rupees|only|so|ok|okay|and|then|guys|hey|fyi|btw|update|note|today|yesterday|tonight|now|here|there|my|me|our|us|all|everyone|from|by|with|split|equally|share|shared|each|per head|per person|bill|around|approx|approximately|about|roughly|think|guess|maybe|only|paise|extra|bhai|yaar|bro|lol|haha|hehe|expense|sabke|sab|mene|mera|meri|mere|hua|hue|hui|aaj|kal|abhi|se|pe|par|mein|wapas|bhej|bheje|bheja|bhi|tu|le|sirf|bas)$/i
/** A verb in the middle of a title is not part of the name of the thing ("Dinner paid at Fisherman"). */
const TITLE_VERB = /^(?:paid|payed|spent|bought|booked)$/i
/** Everyday Hinglish: what follows one of these is talk, not the name of the thing ("Zomato maine order kiya sabke"). */
const TITLE_BREAK = /^(?:maine|mene|humne|ko|ne|bhai|yaar|sabke|lol|aaya|aaye|aya|laya|laaye|laye|mangaya|mangwaya|diya|diye|kiya|kiye|liya|liye|kar|dalwa|dalwaya|hua|hai|tha|thi)$/i
const COUNTED = /^(?:day|night|part|round|din|week|phase)$/i
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
    return bare === '' || !/[\p{L}\p{N}]/u.test(bare) || /^(?:\d+|[x×*=])$/i.test(bare) || FILLER.test(bare) || names.has(bare.toLowerCase()) || names.has(bare.replace(/^@/, '').toLowerCase())
  }
  const tidy = (from: string): string => {
    let piece = from.split(/[.!?\n]/).find((part) => /\p{L}/u.test(part)) ?? ''
    // "Cab, bhai Rohit tu bhi aaya": what follows the comma is talk.
    const comma = piece.indexOf(',')
    if (comma > 0 && /\p{L}/u.test(piece.slice(0, comma))) {
      const next = piece.slice(comma + 1).trim().split(/\s+/)[0]
      if (next === undefined || next === '' || filler(next) || TITLE_BREAK.test(next.replace(EDGE, ''))) piece = piece.slice(0, comma)
    }
    let words = piece.replace(EDGE, '').split(/\s+/).filter(Boolean)
    while (words.length > 0 && filler(words[0])) words = words.slice(1)
    words = words.filter((word, index) => index === 0 || !TITLE_VERB.test(word.replace(EDGE, '')))
    const stop = words.findIndex((word, index) => index > 0 && TITLE_BREAK.test(word.replace(EDGE, '')))
    if (stop > 0) words = words.slice(0, stop)
    // "Lunch day 2" keeps its number.
    const counted = (): boolean => words.length >= 2 && /^\d{1,2}$/.test(words[words.length - 1] ?? '') && COUNTED.test(words[words.length - 2] ?? '')
    while (words.length > 0 && !counted() && filler(words[words.length - 1])) words = words.slice(0, -1)
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

const ME_OBJECT = /(?:^|[^\p{L}])(?:mujhe|mujhko|mujh ko|mereko|mere ko|mere account)(?![\p{L}])/iu
const YOU_OBJECT = /(?:^|[^\p{L}])(?:tujhe|tujhko|tumhe|tumhein|tumko|aapko|aap ko|tereko|tere ko|tere account)(?![\p{L}])/iu

function readLine(line: string, sender: string, people: People, listed: boolean, hint = ''): Draft | null {
  const raw = line.trim().replace(LINK, (m) => ' '.repeat(m.length))
  const text = raw.replace(/[‘’]/g, "'")
  if (text.trim() === '' || text.length > 280) return null
  if (NOT_A_PAYMENT.some((p) => p.test(text))) return null
  const claims = PAID_VERB.test(text) || SENT_VERB.test(text)
  if (TOTAL_LINE.test(text) && !PAID_VERB.test(text)) return null
  if (BANK_TALK.test(text) && !claims) return null
  // "paid? 300", "1500 de diye the maine?? ya Rohit ne": asked, so it is only ever offered.
  const asked = ASKED.test(text)
  if (asked && !claims) return null
  const unclear = people.unclear(text)
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
  // "Sid ne 400 diye mujhe" (to whoever typed it); "Neha 3k transfer kiya tujhe" (to the one it names).
  if (!from && verb) {
    if (actor !== sender && ME_OBJECT.test(text)) {
      from = actor
      to = sender
    } else if (actor === sender && YOU_OBJECT.test(text)) {
      const named = [...new Set(others.map((m) => m.name))]
      if (named.length === 1) to = named[0] ?? null
      else if (people.members.length === 2) to = people.members.find((n) => n !== sender) ?? null
      // Sent to "you", and nothing says who that is.
      else return null
      from = sender
    }
  }
  /** The amount a verb points at ("paid 600"), when a message has other numbers in it too. */
  const pointed = verb ? found.find((f) => f.start >= verbAt && /^[\s:]*$/.test(text.slice(verbAt + verb.text.length, f.start))) : undefined
  const marks = found.filter((f) => f.marked)
  const best = pointed ?? (marks.length === 1 ? marks[0] : undefined) ?? first
  if (from && to && from !== to) {
    const doubt: Doubt | null = asked ? 'asked' : unclear ? 'who' : found.length === 1 ? null : 'amounts'
    return { kind: 'payment', sure: doubt === null, doubt, payer: from, to, title: '', amount: best.value, among: [], everyone: false }
  }
  if (got && !paid && (!/^got$/i.test(got.text) || /(?:^|[^\p{L}])(?:back|refund\w*|cashback|from)(?![\p{L}])/iu.test(text))) return null

  // An expense.
  const among = amongOf(text, sender, actor, people, actorSpan)
  const each = EACH.test(text)
  const plus = found.length > 1 && found.every((f, i) => i === 0 || /^\s*\+\s*$/.test(blank(text).slice(found[i - 1]?.end ?? 0, f.start)))
  const summed = found.length > 1 ? found.find((f) => /=\s*(?:₹|rs\.?|inr)?\s*$/i.test(blank(text).slice(0, f.start)) || /=\s*$/.test(text.slice(0, f.start))) : undefined
  let amount = summed ? summed.value : plus ? found.reduce((sum, f) => sum + f.value, 0) : best.value
  let doubt: Doubt | null = null
  if (found.length > 1 && !plus && !summed) doubt = 'amounts'
  if (each) {
    const eachAt = wordAt(EACH, text)?.index ?? text.length
    const per = [...found].reverse().find((f) => f.end <= eachAt) ?? first
    const rest = found.filter((f) => f !== per)
    const total = rest.length === 1 ? rest[0] : undefined
    const many = /(?:^|\s)(\d{1,2})\s+(?:x\s+)?\p{L}[\p{L}\s]*$/u.exec(blank(text).slice(0, per.start))
    if (total && total.value > per.value) {
      // "rent 32000 total, 8000 each": the total is the bill.
      amount = total.value
      const heads = total.value / per.value
      doubt = !Number.isInteger(heads) ? 'amounts' : among.everyone && heads !== among.names.length ? 'people' : null
    } else if (many && Number(many[1]) >= 2 && rest.length === 0) {
      // "2 chai 40 each": two of them.
      amount = per.value * Number(many[1])
      doubt = 'each'
    } else {
      amount = per.value * Math.max(1, among.names.length)
      doubt = doubt ?? 'each'
    }
  }
  if (among.doubt) doubt = doubt ?? 'people'
  if (amount <= 0 || amount > MAX_MINOR / 100) return null

  const spans: Array<[number, number]> = [...found.map((f): [number, number] => [f.start, f.end]), ...among.spans]
  if (actorSpan) spans.push(actorSpan)
  let title = titleOf(raw, spans, people)
  // "Groceries" on one line, "total 1450 paid by me" on the next.
  if (title === '' && hint !== '') title = titleOf(hint, [], people)

  const price = PRICE_TALK.test(text)
  const words = cut(text, spans).split(/\s+/).filter(Boolean).length
  const marked = found.some((f) => f.marked)
  let sure: boolean
  if (paid) sure = true
  else if (listed) sure = true
  else if (marked && title !== '' && !price) sure = true
  // A year on its own ("trip 2026") is not money.
  else if (!first.marked && found.length === 1 && first.value >= 201_500 && first.value <= 203_500) return null
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
  if (unclear) doubt = 'who'
  if (asked) doubt = 'asked'
  if (doubt !== null) sure = false
  return { kind: 'expense', sure, doubt, payer: actor, to: null, title, amount, among: among.names, everyone: among.everyone }
}

/* ------------------------------------------------------------------ a whole chat */

/** Names WhatsApp's own notes can leave behind when they contain a colon. */
const NOT_A_PERSON = /["“”]| (?:added|removed|changed|created|joined using|left)(?: |$)/i

const BULLET = /^\s*(?:[-*\u2022]+|\d{1,2}[.)])\s+(?=\S)/

interface Part {
  text: string
  listed: boolean
  /** The line above, when it is only words ("Groceries"): a title for a line that has none. */
  hint: string
}

function partsOf(message: ChatMessage): Part[] {
  const lines = message.text.split('\n').map((l) => l.replace(BULLET, '').trim()).filter(Boolean)
  const listLines = lines.filter(isListLine).length
  const out: Part[] = []
  let above = ''
  for (const line of lines) {
    const listed = listLines >= 2 && isListLine(line)
    // "cab 450, dinner 2400": one line, two things.
    const pieces = line.split(/\s*[,;]\s+|\s+and\s+/i)
    if (pieces.length > 1 && pieces.length <= 8 && pieces.every(isListLine)) for (const piece of pieces) out.push({ text: piece, listed: true, hint: '' })
    else out.push({ text: line, listed, hint: above })
    above = amountsIn(line).length === 0 && /\p{L}{3,}/u.test(line) && line.split(/\s+/).length <= 5 ? line : ''
  }
  return out
}

interface Told {
  draft: Draft
  date: string
  minutes: number
  sender: string
  text: string
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

/**
 * Said again the same day in other words ("bijli 2400 bhar diya" then "₹2,400 bijli 👍", or "maid 3000 maine
 * diya" from one and "I paid 3,000 for Maid" from another): most likely the same money, so the later one is
 * only offered. The very same words twice are two things (two autos at ₹50).
 */
function saidBefore(draft: Draft, part: string, message: ChatMessage, told: readonly Told[]): boolean {
  const same = (t: Told): boolean => t.date === message.date && t.draft.amount === draft.amount && t.row !== null && t.row.sure && t.text.trim().toLowerCase() !== part.trim().toLowerCase()
  if (draft.kind === 'payment') return told.some((t) => same(t) && t.draft.kind === 'payment' && t.sender === message.sender && t.draft.payer === draft.payer && t.draft.to === draft.to)
  const mine = wordsOf(draft.title)
  return told.some((t) => same(t) && t.draft.kind === 'expense' && mine.some((w) => wordsOf(t.draft.title).includes(w)))
}

const SPLIT_NOTE = /(?:^|[^\p{L}])(?:split|baa?nt\w*|share|divide|sirf|only|saa?th|bee?ch)(?![\p{L}])/iu

/**
 * "paid 1200 for cleaning supplies", and then, in the next message: "sirf Neha aur Aman ke saath split
 * karna". The second message has no money in it; it says who shares the first.
 */
function splitNote(message: ChatMessage, people: People, told: readonly Told[]): void {
  const last = told[told.length - 1]
  if (!last || !last.row || last.row.kind !== 'expense' || !last.row.everyone) return
  if (last.sender !== message.sender || last.date !== message.date || message.minutes < last.minutes || message.minutes - last.minutes > 15) return
  const text = message.text.trim()
  if (text.includes('\n') || text.split(/\s+/).length > 14 || !SPLIT_NOTE.test(text) || amountsIn(text).length > 0 || people.unclear(text)) return
  const among = amongOf(text, message.sender, last.row.payer, people)
  if (among.everyone || among.doubt || among.names.length === 0) return
  last.row.among = among.names
  last.row.everyone = false
  last.draft.among = among.names
  last.draft.everyone = false
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
    let any = false
    for (const [index, part] of parts.entries()) {
      const draft = readLine(part.text, message.sender, people, part.listed, part.hint)
      if (!draft) continue
      any = true
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
      if (row.sure && saidBefore(draft, part.text, message, told)) {
        row.sure = false
        row.doubt = 'repeat'
      }
      rows.push(row)
      told.push({ draft, date: message.date, minutes: message.minutes, sender: message.sender, text: part.text, row })
      if (rows.length >= MAX_CHAT_ROWS) return { members, rows, messages: file.messages.length }
    }
    if (!any) splitNote(message, people, told)
  }
  return { members, rows, messages: file.messages.length }
}
