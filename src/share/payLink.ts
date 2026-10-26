/**
 * Pay links: one URL for the group chat. Everything the pay page needs (who's owed, each
 * person's share, the payee's UPI ID, the bill's items) travels in the `#fragment`, which
 * browsers never send to a server — so there's still no database, and nothing to leak.
 *
 *     https://settle.example/pay#<base64url(deflate-raw(JSON))>
 *     https://settle.example/pay#j.<base64url(JSON)>          (no CompressionStream, or shorter)
 */
import * as z from 'zod/mini'
import { CATEGORY_IDS, ME_ID, type CategoryId, type Expense, type Friend, type Minor, type Profile } from '../domain/types'
import { allocate, formatMoney, MAX_MINOR } from '../lib/money'
import { graphemes } from '../lib/people'
import { buildUpiLink, isValidUpiId, normalizeUpiId } from '../lib/upi'
import { categoryLabel } from './categories'
import { decodeFragment, encodeFragment } from './fragment'
import { outsideName } from './names'
import { friendFallback, personFallback } from './fallbacks'
import { normalizePhone } from './links'
import { cleanText, utf8Length } from './text'

export interface PayLinkPerson {
  /** Name as the group knows them. */
  n: string
  /** Their share of the expense (minor units). */
  a: Minor
  /** Already settled with the payee. Always set on the payee's own entry (see `pi`). */
  paid?: true
}

export interface PayLinkItem {
  /** Item name as printed on the bill. */
  n: string
  /** Line price (minor units). */
  a: Minor
  /** Indexes into `p` of everyone who shared it, in `p` order. */
  who: number[]
  /** Share weights parallel to `who` ("had 2 of 3 beers"); omitted when everyone had one share. */
  w?: number[]
}

export interface PayLinkPayload {
  v: 1
  /** Title ("Dinner at Toit"). */
  t: string
  cat: CategoryId
  /** ISO 4217 currency code. */
  c: string
  /** Local date, YYYY-MM-DD ('' if unknown). */
  d: string
  /**
   * The payee — who paid and is collecting — their UPI ID, and their phone (international digits,
   * only when the link is their own) so "I've paid" goes straight to their chat.
   */
  to: { n: string; u: string | null; ph?: string }
  /** What was paid in total. */
  tot: Minor
  /** Everyone in the split, in the expense's order (the payee included when they took part). */
  p: PayLinkPerson[]
  /** Index in `p` of the payee, when they took part in the split. Not one of "who's paying". */
  pi?: number
  /** A personal copy of the link: index in `p` of the person it was sent to — it opens on their share. */
  f?: number
  /** The expense's id on the payee's phone, so an "I've paid" reply finds it. */
  id?: string
  note?: string
  /** Itemized bills only. */
  items?: PayLinkItem[]
}

export const PAY_PATH = '/pay'

export const PAY_LINK_LIMITS = {
  /** Largest JSON a link may carry once decompressed. */
  maxDecodedBytes: 16 * 1024,
  /** Longest `#fragment` we try to decode. */
  maxFragmentLength: 24 * 1024,
  people: 60,
  items: 40,
  weight: 99,
  title: { graphemes: 60, units: 160 },
  name: { graphemes: 24, units: 64 },
  itemName: { graphemes: 40, units: 96 },
  note: { graphemes: 140, units: 280 },
} as const

/** Shown when the payee's name can't be shared (e.g. the owner never set one). */
export const PAYEE_FALLBACK = 'Your friend'

/* ------------------------------------------------------------------ validation */

const L = PAY_LINK_LIMITS
const amount = z.int().check(z.minimum(0), z.maximum(MAX_MINOR))
const index = z.int().check(z.minimum(0), z.maximum(L.people - 1))

const payloadSchema = z.object({
  v: z.literal(1),
  t: z.string().check(z.maxLength(L.title.units)),
  cat: z.catch(z.enum(CATEGORY_IDS), 'other'),
  c: z.string().check(z.regex(/^[A-Z]{3}$/)),
  d: z.catch(z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)), ''),
  to: z.object({
    n: z.string().check(z.maxLength(L.name.units)),
    u: z.catch(z.nullable(z.string().check(z.maxLength(330))), null),
    ph: z.optional(z.catch(z.string().check(z.maxLength(20)), '')),
  }),
  tot: amount,
  p: z
    .array(
      z.object({
        n: z.string().check(z.maxLength(L.name.units)),
        a: amount,
        paid: z.optional(z.literal(true)),
      }),
    )
    .check(z.maxLength(L.people)),
  pi: z.optional(index),
  f: z.optional(index),
  id: z.optional(z.catch(z.string().check(z.maxLength(64)), '')),
  note: z.optional(z.string().check(z.maxLength(L.note.units))),
  items: z.optional(
    z
      .array(
        z.object({
          n: z.string().check(z.maxLength(L.itemName.units)),
          a: amount,
          who: z.array(index).check(z.maxLength(L.people)),
          w: z.optional(z.array(z.int().check(z.minimum(1), z.maximum(L.weight))).check(z.maxLength(L.people))),
        }),
      )
      .check(z.maxLength(L.items)),
  ),
})

function clampAmount(value: number): Minor {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_MINOR, Math.max(0, Math.round(value)))
}

function cleanItems(items: readonly PayLinkItem[] | undefined, people: number): PayLinkItem[] | undefined {
  if (!items) return undefined
  const out: PayLinkItem[] = []
  for (const item of items.slice(0, L.items)) {
    const weights = item.w && item.w.length === item.who.length ? item.w : null
    const who: number[] = []
    const w: number[] = []
    item.who.forEach((i, k) => {
      if (!Number.isInteger(i) || i < 0 || i >= people || who.includes(i)) return
      who.push(i)
      const weight = weights?.[k] ?? 1
      w.push(Number.isInteger(weight) ? Math.min(L.weight, Math.max(1, weight)) : 1)
    })
    if (who.length === 0) continue
    const clean: PayLinkItem = {
      n: cleanText(item.n, L.itemName.graphemes, L.itemName.units) || 'Item',
      a: clampAmount(item.a),
      who,
    }
    if (w.some((x) => x !== 1)) clean.w = w
    out.push(clean)
  }
  return out.length > 0 ? out : undefined
}

/**
 * Brings any payload into canonical form: clean, capped strings; whole non-negative amounts;
 * valid indexes; a valid UPI ID or null. Both sides of the link run it, so what the sender
 * encodes is exactly what the pay page shows.
 */
function normalizePayload(raw: PayLinkPayload): PayLinkPayload {
  const cat: CategoryId = (CATEGORY_IDS as readonly string[]).includes(raw.cat) ? raw.cat : 'other'
  const people = raw.p.slice(0, L.people).map((person, i) => {
    const out: PayLinkPerson = {
      n: cleanText(person.n, L.name.graphemes, L.name.units) || personFallback(i + 1),
      a: clampAmount(person.a),
    }
    if (person.paid === true) out.paid = true
    return out
  })
  const upi = raw.to.u ? normalizeUpiId(raw.to.u) : ''
  const currency = raw.c.trim().toUpperCase()
  const payload: PayLinkPayload = {
    v: 1,
    t: cleanText(raw.t, L.title.graphemes, L.title.units) || categoryLabel(cat),
    cat,
    c: /^[A-Z]{3}$/.test(currency) ? currency : 'INR',
    d: /^\d{4}-\d{2}-\d{2}$/.test(raw.d) ? raw.d : '',
    to: {
      n: cleanText(raw.to.n, L.name.graphemes, L.name.units) || friendFallback(),
      u: upi && isValidUpiId(upi) ? upi : null,
    },
    tot: clampAmount(raw.tot),
    p: people,
  }
  if (raw.pi !== undefined && Number.isInteger(raw.pi) && raw.pi >= 0 && raw.pi < people.length) {
    payload.pi = raw.pi
    const payee = people[raw.pi]
    if (payee) payee.paid = true
  }
  const phone = normalizePhone(raw.to.ph)
  if (phone) payload.to.ph = phone
  if (raw.id && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id)) payload.id = raw.id
  if (raw.f !== undefined && Number.isInteger(raw.f) && raw.f >= 0 && raw.f < people.length && raw.f !== payload.pi) payload.f = raw.f
  const note = raw.note ? cleanText(raw.note, L.note.graphemes, L.note.units) : ''
  if (note) payload.note = note
  const items = cleanItems(raw.items, people.length)
  if (items) payload.items = items
  return payload
}

/* ------------------------------------------------------------------ encode / decode */

function serialize(payload: PayLinkPayload): string {
  // Explicit key order keeps links stable for the same payload.
  const { v, id, t, cat, c, d, to, tot, p, pi, f, note, items } = payload
  return JSON.stringify({ v, id, t, cat, c, d, to: { n: to.n, u: to.u, ph: to.ph }, tot, p, pi, f, note, items })
}

/** The canonical JSON for a payload, shrunk (items, then the note) until it fits the size cap. */
function fittedJson(payload: PayLinkPayload): string {
  let current = normalizePayload(payload)
  let json = serialize(current)
  if (utf8Length(json) > L.maxDecodedBytes && current.items) {
    current = { ...current, items: undefined }
    json = serialize(current)
  }
  if (utf8Length(json) > L.maxDecodedBytes && current.note) {
    current = { ...current, note: undefined }
    json = serialize(current)
  }
  return json
}

function defaultOrigin(): string {
  try {
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    return origin && origin !== 'null' ? origin : ''
  } catch {
    return ''
  }
}

/**
 * The shareable URL for a payload: `${origin}/pay#…`. Uses deflate-raw when the browser has
 * `CompressionStream`, otherwise (or when it's shorter) plain JSON with a "j." prefix.
 * Never throws.
 */
export async function encodePayLink(payload: PayLinkPayload, origin?: string): Promise<string> {
  const base = (origin ?? defaultOrigin()).replace(/\/+$/, '')
  return `${base}${PAY_PATH}#${await encodeFragment(fittedJson(payload))}`
}

/**
 * Reads a pay link's `#fragment` (also accepts the bare fragment or the whole URL). Returns
 * null for anything corrupt, truncated, oversized (> 16 KB decoded) or not a v1 payload.
 * Never throws.
 */
export async function decodePayLink(hash: string): Promise<PayLinkPayload | null> {
  try {
    const json = await decodeFragment(hash, L.maxDecodedBytes)
    if (json === null) return null
    const parsed = payloadSchema.safeParse(JSON.parse(json))
    return parsed.success ? normalizePayload(parsed.data) : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ from an expense */

/**
 * Who goes in a link with more than `PAY_LINK_LIMITS.people` participants: the payer and the
 * people who still owe come first; the original order is kept. Index `i` in a link's `p` is
 * `payLinkPeopleIds(e)[i]`.
 */
export function payLinkPeopleIds(e: Expense): string[] {
  const ids: string[] = []
  for (const p of e.participants) if (!ids.includes(p.friendId)) ids.push(p.friendId)
  if (ids.length <= L.people) return ids
  const rank = (id: string) => (id === e.payerId ? 0 : e.paidBack[id] === undefined && (e.shares[id] ?? 0) > 0 ? 1 : 2)
  const keep = new Set([...ids].sort((a, b) => rank(a) - rank(b)).slice(0, L.people))
  return ids.filter((id) => keep.has(id))
}

function billItems(e: Expense, ids: readonly string[]): PayLinkItem[] | undefined {
  const bill = e.bill
  // A converted bill's items are priced in what was paid (฿), its shares in the settle currency (₹).
  if (e.fx) return undefined
  if (e.kind !== 'bill' || !bill || bill.items.length === 0 || bill.items.length > L.items) return undefined
  return bill.items.map((item) => {
    const shares = bill.assignments[item.id] ?? {}
    const who: number[] = []
    const w: number[] = []
    ids.forEach((id, i) => {
      const weight = Object.hasOwn(shares, id) ? Math.floor(shares[id] ?? 0) : 0
      if (weight > 0) {
        who.push(i)
        w.push(Math.min(L.weight, weight))
      }
    })
    // Nobody ticked → everyone shares it equally (same rule as the split itself).
    if (who.length === 0) return { n: item.name, a: item.amount, who: ids.map((_, i) => i) }
    return w.some((x) => x !== 1) ? { n: item.name, a: item.amount, who, w } : { n: item.name, a: item.amount, who }
  })
}

/** The title, plus what was paid abroad ("Dinner (฿1,250)") when that still fits the title cap. */
function titleWithPaid(e: Expense): string {
  if (!e.fx) return e.title
  const titled = `${e.title} (${formatMoney(e.fx.amount, e.fx.currency, { trimZeros: true })})`
  return graphemes(titled).length <= L.title.graphemes && titled.length <= L.title.units ? titled : e.title
}

/**
 * A payload a feature builds itself (rent: the landlord collects each flatmate's share), cleaned
 * and capped exactly like an expense's.
 */
export function payLinkFor(raw: PayLinkPayload): PayLinkPayload {
  return normalizePayload(raw)
}

/**
 * The pay-link payload for an expense. The payer is `to` (UPI ID from their friend record, or
 * the profile when the payer is the owner); everyone in the split is in `p` with their share
 * and paid-back state; bills carry their items (up to 40, none when paid in another currency).
 * `forId`: a personal copy for that person, opening straight on their share.
 */
export function payLinkFromExpense(
  e: Expense,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
  forId?: string,
): PayLinkPayload {
  const ids = payLinkPeopleIds(e)
  const p: PayLinkPerson[] = ids.map((id, i) => {
    const fallback = id === ME_ID ? friendFallback() : personFallback(i + 1)
    const person: PayLinkPerson = { n: outsideName(id, friendsById, profile, fallback), a: e.shares[id] ?? 0 }
    if (id === e.payerId || e.paidBack[id] !== undefined) person.paid = true
    return person
  })
  const upi = e.payerId === ME_ID ? (profile.upiId ?? friendsById[ME_ID]?.upiId ?? null) : (friendsById[e.payerId]?.upiId ?? null)
  // Your own number only: a link never hands out someone else's.
  const phone = e.payerId === ME_ID ? (friendsById[ME_ID]?.phone ?? null) : null
  const payload: PayLinkPayload = {
    v: 1,
    t: titleWithPaid(e),
    cat: e.category,
    c: e.currency,
    d: e.date,
    to: { n: outsideName(e.payerId, friendsById, profile, friendFallback()), u: upi, ...(phone ? { ph: phone } : {}) },
    tot: e.total,
    p,
    id: e.id,
  }
  const payerIndex = ids.indexOf(e.payerId)
  if (payerIndex !== -1) payload.pi = payerIndex
  const forIndex = forId === undefined ? -1 : ids.indexOf(forId)
  if (forIndex !== -1) payload.f = forIndex
  if (e.note) payload.note = e.note
  const items = billItems(e, ids)
  if (items) payload.items = items
  return normalizePayload(payload)
}

/* ------------------------------------------------------------------ reading a payload */

export interface PayLinkDebtor {
  /** Index in `payload.p`. */
  index: number
  name: string
  amount: Minor
  paid: boolean
}

/** The same link made personal for the person at `index` (opens on their share); null clears it. */
export function payLinkForPerson(payload: PayLinkPayload, index: number | null): PayLinkPayload {
  const { f: _drop, ...rest } = payload
  return normalizePayload(index === null ? rest : { ...rest, f: index })
}

/** The people who pay the payee back (everyone in `p` except the payee), in order. */
export function payLinkDebtors(payload: PayLinkPayload): PayLinkDebtor[] {
  const out: PayLinkDebtor[] = []
  payload.p.forEach((person, index) => {
    if (index !== payload.pi) out.push({ index, name: person.n, amount: person.a, paid: person.paid === true })
  })
  return out
}

/** "₹1,840 of ₹2,766 collected · 2 of 3 paid", in numbers. People who owe nothing are left out. */
export function payLinkProgress(payload: PayLinkPayload): {
  collected: Minor
  outstanding: Minor
  paidCount: number
  peopleCount: number
} {
  let collected = 0
  let outstanding = 0
  let paidCount = 0
  let peopleCount = 0
  for (const debtor of payLinkDebtors(payload)) {
    if (debtor.amount <= 0) continue
    peopleCount++
    if (debtor.paid) {
      collected += debtor.amount
      paidCount++
    } else {
      outstanding += debtor.amount
    }
  }
  return { collected, outstanding, paidCount, peopleCount }
}

export interface PayLinkItemLine {
  name: string
  /** This person's exact part of the item price. */
  amount: Minor
  /** Their weight on the item, the item's total weight, and how many people shared it. */
  shares: number
  totalShares: number
  sharedWith: number
}

/**
 * One person's item lines on an itemized bill, with exact amounts (largest-remainder, the same
 * rule as the split, so every paisa is accounted for). Tax and charges aren't included — the
 * person's share `a` is the amount to pay.
 */
export function payLinkItemLines(payload: PayLinkPayload, personIndex: number): PayLinkItemLine[] {
  const lines: PayLinkItemLine[] = []
  for (const item of payload.items ?? []) {
    const at = item.who.indexOf(personIndex)
    if (at === -1) continue
    const weights = item.who.map((_, k) => item.w?.[k] ?? 1)
    const parts = allocate(item.a, weights)
    lines.push({
      name: item.n,
      amount: parts[at] ?? 0,
      shares: weights[at] ?? 1,
      totalShares: weights.reduce((a, b) => a + b, 0),
      sharedWith: item.who.length,
    })
  }
  return lines
}

export interface PayLinkUpiRequest {
  /** `upi://pay?…` with the payee, this person's amount and the title as the note. */
  uri: string
  /** The payee's UPI ID, for "copy UPI ID". */
  vpa: string
  amount: Minor
}

/**
 * How one person on a pay link pays by UPI (whether or not they're marked paid — the page says
 * so), or null when UPI can't take it: no valid UPI ID, not rupees, a zero share, or the payee.
 */
export function payLinkUpiRequest(payload: PayLinkPayload, personIndex: number): PayLinkUpiRequest | null {
  const person = payload.p[personIndex]
  const vpa = payload.to.u ? normalizeUpiId(payload.to.u) : ''
  if (!person || personIndex === payload.pi || person.a <= 0 || payload.c !== 'INR' || !isValidUpiId(vpa)) return null
  return { uri: buildUpiLink({ vpa, payeeName: payload.to.n, amountMinor: person.a, note: payload.t }), vpa, amount: person.a }
}
