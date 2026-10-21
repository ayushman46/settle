/**
 * Turns an AI draft ("Rent 32000 me 40% Aditya 30% Neha 30%") into a new-split prefill: names
 * become friends, rupees become paise, percentages become basis points — everything the split
 * screen needs, nothing saved yet (except new friends, so they can be picked).
 */
import { isCategoryId } from '../../shared/api'
import type { CategoryId, DescribedSplit, Friend, Minor, Participant } from '../domain/types'
import type { SplitPrefill } from '../data/handoff'
import { MAX_TITLE_LENGTH } from '../data/schemas'
import { categoryFromText } from '../engine/categories'
import { isIsoDate, today } from '../engine/dates'
import { isKnownCurrency } from '../lib/currencies'
import { allocate, MAX_MINOR, toMinor } from '../lib/money'
import { graphemes, nameKey, normalizeName } from '../lib/people'

export interface DescribeContext {
  /** Everyone the user knows (ME included). */
  friends: readonly Friend[]
  meId: string
  /** The user's default currency, used when the text named none. */
  currency: string
  /** Adds (or finds) a friend by name — `addFriend` from the data layer. */
  addFriend: (name: string) => Friend
}

export interface ResolvedPerson {
  /** As written, tidied ("Me" for the speaker). */
  name: string
  /** The matching friend (ME for "Me"/"I"/the user's own name), or null for someone new. */
  friendId: string | null
  isMe: boolean
  /** exact → major amount, percent → %, shares → weight, equal → null. */
  value: number | null
}

const BASIS_POINTS = 10_000
/** Biggest share weight we hand on ("pays double" is 2; nobody pays 1000×). */
const MAX_WEIGHT = 1_000

/** How the speaker refers to themself. The server already maps these to "Me"; this is a safety net. */
const SELF_WORDS: ReadonlySet<string> = new Set(['me', 'i', 'myself', 'mine', 'my', 'self', 'me myself', 'myself me'])

/** Case-, accent- and punctuation-insensitive comparison key ("Riya." ≡ "riya", "José" ≡ "jose"). */
function looseKey(name: string): string {
  return nameKey(name)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function firstWord(key: string): string {
  return key.split(' ')[0] ?? ''
}

function makeMatcher(friends: readonly Friend[], meId: string): (name: string) => string | null {
  const others = friends.filter((f) => f.id !== meId)
  const me = friends.find((f) => f.id === meId)
  const meKey = me ? looseKey(me.name) : ''
  return (name) => {
    const key = looseKey(name)
    if (!key) return null
    if (SELF_WORDS.has(key)) return meId
    // A friend with exactly this name beats the user's own name (two Rahuls: the text means the friend).
    const exact = others.find((f) => looseKey(f.name) === key)
    if (exact) return exact.id
    if (meKey && key === meKey) return meId
    // "Riya" for "Riya Sharma" — only when exactly one friend could be meant.
    if (!key.includes(' ')) {
      const byFirst = others.filter((f) => firstWord(looseKey(f.name)) === key)
      if (byFirst.length === 1) return byFirst[0]?.id ?? null
    }
    return null
  }
}

/** Two parts of one person's share ("Riya 300 … Riya Sharma 200") add up; a blank adds nothing. */
function addValues(a: number | null, b: number | null): number | null {
  return a === null ? b : b === null ? a : a + b
}

/**
 * Who the draft means, without changing anything — for the confirm card ("Riya · Sam · +1 new").
 * People who resolve to the same friend are listed once, their parts added up.
 */
export function resolveDescribedPeople(d: DescribedSplit, ctx: Pick<DescribeContext, 'friends' | 'meId'>): ResolvedPerson[] {
  const match = makeMatcher(ctx.friends, ctx.meId)
  const out: ResolvedPerson[] = []
  const byKey = new Map<string, ResolvedPerson>()
  for (const person of d.people) {
    const name = normalizeName(person.name)
    if (!looseKey(name)) continue
    const friendId = match(name)
    const key = friendId ?? `new:${looseKey(name)}`
    const value = typeof person.value === 'number' && Number.isFinite(person.value) ? person.value : null
    const seen = byKey.get(key)
    if (seen) {
      seen.value = addValues(seen.value, value)
      continue
    }
    const resolved: ResolvedPerson = { name, friendId, isMe: friendId === ctx.meId, value }
    byKey.set(key, resolved)
    out.push(resolved)
  }
  return out
}

/** How many more people the text counted than it named ("Netflix 649 for 4" naming only "Me" → 3). */
export function missingPeople(d: DescribedSplit): number {
  const named = new Set(d.people.map((p) => looseKey(p.name)).filter(Boolean)).size
  return typeof d.headcount === 'number' && Number.isInteger(d.headcount) ? Math.max(0, d.headcount - named) : 0
}

/* ------------------------------------------------------------------ amounts */

function clampMinor(value: number): Minor {
  return Math.min(Math.max(0, value), MAX_MINOR)
}

/** Splits `rest` evenly over the empty slots (exact remainder or the leftover percentage). */
function fillEmpty(inputs: Array<number | null>, rest: number): Array<number | null> {
  const empty = inputs.filter((v) => v === null).length
  if (empty === 0 || rest < 0) return inputs
  const parts = allocate(rest, new Array<number>(empty).fill(1))
  let next = 0
  return inputs.map((v) => (v === null ? (parts[next++] ?? 0) : v))
}

function exactInputs(values: Array<number | null>, currency: string, total: Minor | undefined): Array<number | null> {
  const inputs = values.map((v) => (v === null || v < 0 ? null : clampMinor(toMinor(v, currency))))
  if (total === undefined) return inputs
  const known = inputs.reduce<number>((sum, v) => sum + (v ?? 0), 0)
  // "Sam had 600 worth, rest split between me and Riya" → the rest goes to the blanks.
  return fillEmpty(inputs, total - known)
}

function percentInputs(values: Array<number | null>): Array<number | null> {
  const clean = values.map((v) => (v === null || v < 0 || v > 100 ? null : v))
  const known = clean.filter((v): v is number => v !== null)
  const sum = known.reduce((a, b) => a + b, 0)
  if (known.length === clean.length && known.length > 0) {
    // "33% each" or "33.3% each" means thirds; 33.33 + 33.33 + 33.34 is 100% written to 2dp.
    const even = known.every((v) => Math.abs(v - (known[0] ?? 0)) < 1e-9) && Math.abs(sum - 100) <= known.length * 0.5
    if (even || Math.abs(sum - 100) <= 0.01 * known.length + 1e-9) return allocate(BASIS_POINTS, known)
  }
  const bps = clean.map((v) => (v === null ? null : Math.round(v * 100)))
  const assigned = bps.reduce<number>((a, b) => a + (b ?? 0), 0)
  // "Me 40%, the rest between Aditya and Neha" → 30% each.
  return fillEmpty(bps, BASIS_POINTS - assigned)
}

function shareInputs(values: Array<number | null>): number[] {
  const weights = values.map((v) => (v === null || v <= 0 ? 1 : v))
  // "Sam pays 1.5×" → 3 : 2 rather than rounding the half away.
  for (const k of [1, 2, 3, 4, 5, 10, 100]) {
    const scaled = weights.map((w) => w * k)
    if (scaled.every((w) => Math.abs(w - Math.round(w)) < 1e-6)) {
      return scaled.map((w) => Math.min(Math.max(1, Math.round(w)), MAX_WEIGHT))
    }
  }
  return weights.map((w) => Math.min(Math.max(1, Math.round(w)), MAX_WEIGHT))
}

/* ------------------------------------------------------------------ the prefill */

function tidyTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim()
  return graphemes(clean).slice(0, MAX_TITLE_LENGTH).join('').trim()
}

function pickCategory(d: DescribedSplit, title: string): CategoryId | undefined {
  if (isCategoryId(d.category) && d.category !== 'other') return d.category
  return categoryFromText(title) ?? (isCategoryId(d.category) ? d.category : undefined)
}

/**
 * The new-split prefill for an AI draft. Names map to friends (case/accent-insensitive; "Me"/"I"
 * → ME; a lone first name → the one friend it can mean); unknown names are added as friends.
 * Amounts become minor units, percentages basis points (summing to exactly 100% when the text
 * did), share weights whole numbers. Blanks are filled with the rest when the text implies it.
 */
export function describedToPrefill(d: DescribedSplit, ctx: DescribeContext): SplitPrefill {
  const currency = d.currency && isKnownCurrency(d.currency) ? d.currency : ctx.currency
  const mode = d.mode === 'exact' || d.mode === 'percent' || d.mode === 'shares' ? d.mode : 'equal'

  const ids: string[] = []
  const values = new Map<string, number | null>()
  for (const person of resolveDescribedPeople(d, ctx)) {
    let id = person.friendId
    if (id === null) {
      try {
        id = ctx.addFriend(person.name).id
      } catch {
        continue // e.g. the 200-friend limit: they can still be picked by hand
      }
    }
    if (values.has(id)) {
      values.set(id, addValues(values.get(id) ?? null, person.value))
    } else {
      ids.push(id)
      values.set(id, person.value)
    }
  }
  const raw = ids.map((id) => values.get(id) ?? null)

  let total: Minor | undefined =
    typeof d.amount === 'number' && Number.isFinite(d.amount) && d.amount > 0 ? clampMinor(toMinor(d.amount, currency)) : undefined

  let inputs: Array<number | null>
  switch (mode) {
    case 'exact':
      inputs = exactInputs(raw, currency, total)
      if (total === undefined && inputs.length > 0 && inputs.every((v) => v !== null)) {
        const sum = inputs.reduce<number>((a, b) => a + (b ?? 0), 0)
        if (sum > 0) total = clampMinor(sum)
      }
      break
    case 'percent':
      inputs = percentInputs(raw)
      break
    case 'shares':
      inputs = shareInputs(raw)
      break
    default:
      inputs = raw.map(() => null)
  }

  const prefill: SplitPrefill = { source: 'describe', mode }
  // An unknown code would void the whole hand-off; the split screen then uses the profile's.
  if (isKnownCurrency(currency)) prefill.currency = currency
  const title = tidyTitle(d.title)
  if (title) prefill.title = title
  const category = pickCategory(d, title)
  if (category) prefill.category = category
  if (total !== undefined && total > 0) prefill.total = total
  if (typeof d.date === 'string' && isIsoDate(d.date) && d.date <= today()) prefill.date = d.date
  if (ids.length > 0) prefill.participants = ids.map((friendId, i): Participant => ({ friendId, input: inputs[i] ?? null }))

  if (d.payer) {
    const payer = normalizeName(d.payer)
    let payerId = looseKey(payer) ? makeMatcher(ctx.friends, ctx.meId)(payer) : null
    if (payerId === null && looseKey(payer)) {
      // Someone new — possibly just added above as a participant; addFriend finds them by name.
      try {
        payerId = ctx.addFriend(payer).id
      } catch {
        payerId = null
      }
    }
    if (payerId) prefill.payerId = payerId
  }
  return prefill
}
