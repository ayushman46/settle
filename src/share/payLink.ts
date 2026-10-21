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
import { allocate, MAX_MINOR } from '../lib/money'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { base64UrlToBytes, bytesToBase64Url } from './base64url'
import { categoryLabel } from './categories'
import { inflateRaw } from './inflate'
import { outsideName } from './names'
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
  /** The payee — who paid and is collecting — and their UPI ID. */
  to: { n: string; u: string | null }
  /** What was paid in total. */
  tot: Minor
  /** Everyone in the split, in the expense's order (the payee included when they took part). */
  p: PayLinkPerson[]
  /** Index in `p` of the payee, when they took part in the split. Not one of "who's paying". */
  pi?: number
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
const PAYEE_FALLBACK = 'Your friend'
const JSON_PREFIX = 'j.'

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
      n: cleanText(person.n, L.name.graphemes, L.name.units) || `Person ${i + 1}`,
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
      n: cleanText(raw.to.n, L.name.graphemes, L.name.units) || PAYEE_FALLBACK,
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
  const note = raw.note ? cleanText(raw.note, L.note.graphemes, L.note.units) : ''
  if (note) payload.note = note
  const items = cleanItems(raw.items, people.length)
  if (items) payload.items = items
  return payload
}

/* ------------------------------------------------------------------ compression */

interface ByteTransform {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<BufferSource>
}

function noop(): void {}

/** Runs bytes through a (de)compression stream, giving up past `maxOutput` bytes. */
async function pump(bytes: Uint8Array, stream: ByteTransform, maxOutput: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()
  // Not awaited: the readable side must be drained concurrently or the writer stalls.
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(noop)
  writer.close().catch(noop)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxOutput) {
      reader.cancel().catch(noop)
      throw new RangeError('Too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') return null
  try {
    return await pump(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER)
  } catch {
    return null
  }
}

async function inflate(bytes: Uint8Array, maxOutput: number): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'function') {
    try {
      return await pump(bytes, new DecompressionStream('deflate-raw'), maxOutput)
    } catch {
      // Unsupported format (older Safari) or corrupt data — the JS decoder settles which.
    }
  }
  try {
    return inflateRaw(bytes, maxOutput)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ encode / decode */

function serialize(payload: PayLinkPayload): string {
  // Explicit key order keeps links stable for the same payload.
  const { v, t, cat, c, d, to, tot, p, pi, note, items } = payload
  return JSON.stringify({ v, t, cat, c, d, to, tot, p, pi, note, items })
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
  const bytes = new TextEncoder().encode(fittedJson(payload))
  const plain = JSON_PREFIX + bytesToBase64Url(bytes)
  const packed = await deflate(bytes)
  const compact = packed ? bytesToBase64Url(packed) : null
  const fragment = compact !== null && compact.length < plain.length ? compact : plain
  return `${base}${PAY_PATH}#${fragment}`
}

/** The fragment of a hash or URL, without "#", trailing punctuation chat apps glue on, or spaces. */
function fragmentOf(input: string): string | null {
  let text = input.trim()
  const hashAt = text.indexOf('#')
  if (hashAt !== -1) text = text.slice(hashAt + 1)
  if (text.includes('%')) {
    try {
      text = decodeURIComponent(text)
    } catch {
      return null
    }
  }
  text = text.replace(/[^A-Za-z0-9_\-+/=]+$/, '')
  if (!text || text.length > L.maxFragmentLength) return null
  return text
}

/**
 * Reads a pay link's `#fragment` (also accepts the bare fragment or the whole URL). Returns
 * null for anything corrupt, truncated, oversized (> 16 KB decoded) or not a v1 payload.
 * Never throws.
 */
export async function decodePayLink(hash: string): Promise<PayLinkPayload | null> {
  try {
    if (typeof hash !== 'string') return null
    const fragment = fragmentOf(hash)
    if (!fragment) return null
    let bytes: Uint8Array | null
    if (fragment.startsWith(JSON_PREFIX)) {
      bytes = base64UrlToBytes(fragment.slice(JSON_PREFIX.length))
      if (bytes && bytes.length > L.maxDecodedBytes) return null
    } else {
      const packed = base64UrlToBytes(fragment)
      bytes = packed && packed.length > 0 ? await inflate(packed, L.maxDecodedBytes) : null
    }
    if (!bytes || bytes.length === 0) return null
    const parsed = payloadSchema.safeParse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    return parsed.success ? normalizePayload(parsed.data) : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ from an expense */

/**
 * Who goes in a link with more than `PAY_LINK_LIMITS.people` participants: the payer and the
 * people who still owe come first; the original order is kept.
 */
function keptParticipants(e: Expense): string[] {
  const ids: string[] = []
  for (const p of e.participants) if (!ids.includes(p.friendId)) ids.push(p.friendId)
  if (ids.length <= L.people) return ids
  const rank = (id: string) => (id === e.payerId ? 0 : e.paidBack[id] === undefined && (e.shares[id] ?? 0) > 0 ? 1 : 2)
  const keep = new Set([...ids].sort((a, b) => rank(a) - rank(b)).slice(0, L.people))
  return ids.filter((id) => keep.has(id))
}

function billItems(e: Expense, ids: readonly string[]): PayLinkItem[] | undefined {
  const bill = e.bill
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

/**
 * The pay-link payload for an expense. The payer is `to` (UPI ID from their friend record, or
 * the profile when the payer is the owner); everyone in the split is in `p` with their share
 * and paid-back state; bills carry their items (up to 40).
 */
export function payLinkFromExpense(
  e: Expense,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
): PayLinkPayload {
  const ids = keptParticipants(e)
  const p: PayLinkPerson[] = ids.map((id, i) => {
    const fallback = id === ME_ID ? PAYEE_FALLBACK : `Person ${i + 1}`
    const person: PayLinkPerson = { n: outsideName(id, friendsById, profile, fallback), a: e.shares[id] ?? 0 }
    if (id === e.payerId || e.paidBack[id] !== undefined) person.paid = true
    return person
  })
  const upi = e.payerId === ME_ID ? (profile.upiId ?? friendsById[ME_ID]?.upiId ?? null) : (friendsById[e.payerId]?.upiId ?? null)
  const payload: PayLinkPayload = {
    v: 1,
    t: e.title,
    cat: e.category,
    c: e.currency,
    d: e.date,
    to: { n: outsideName(e.payerId, friendsById, profile, PAYEE_FALLBACK), u: upi },
    tot: e.total,
    p,
  }
  const payerIndex = ids.indexOf(e.payerId)
  if (payerIndex !== -1) payload.pi = payerIndex
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
