/**
 * Claim links: the organiser sends ONE link with the bill's items and the people on it; each friend
 * taps what they had on their own phone and sends back a reply link with their picks. Both travel
 * in the `#fragment` (never sent to a server), compressed like pay links.
 *
 *     https://settle.example/claim#<fragment>             (organiser → friends)
 *     https://settle.example/app/claims/in#<fragment>     (friend → organiser)
 *
 * The claim link carries a random secret; a reply carries a short HMAC of its canonical text under
 * that secret, so a reply cut short, edited by hand (an amount, a pick) or meant for another bill
 * is caught. Both sides normalize the same way, so what's signed is exactly what's checked.
 */
import * as z from 'zod/mini'
import { ME_ID, type ClaimRound, type Expense, type Friend, type Minor, type Profile } from '../domain/types'
import { MAX_MINOR } from '../lib/money'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { bytesToBase64Url } from './base64url'
import { decodeFragment, encodeFragment } from './fragment'
import { macB64u, timingSafeEqual } from './hmac'
import { normalizePhone } from './links'
import { outsideName } from './names'
import { sha256, sha256Hex, utf8 } from './sha256'
import { cleanText, utf8Length } from './text'

export const CLAIM_PATH = '/claim'
export const CLAIM_REPLY_PATH = '/app/claims/in'

export const CLAIM_LIMITS = {
  items: 60,
  people: 30,
  maxDecodedBytes: 16 * 1024,
  name: { graphemes: 24, units: 64 },
  itemName: { graphemes: 40, units: 96 },
  title: { graphemes: 60, units: 160 },
} as const

/** Largest denominator of a pick ("1 of 99"), and largest weight of a sorted item. */
export const CLAIM_MAX_DEN = 99

/** Shown when the organiser never set a name. */
export const ORGANISER_FALLBACK = 'Your friend'

/** One bill line on a claim link: name, line amount, integer units when ≥ 2. */
export interface ClaimLinkItem {
  n: string
  a: Minor
  q?: number
}

/** What the organiser sends. Short keys keep the link small. */
export interface ClaimLinkPayload {
  v: 1
  k: 'claim'
  /** Round id. */
  r: string
  /** Round secret (base64url, 16 bytes) — signs replies. */
  s: string
  /** Title. */
  t: string
  /** Currency. */
  c: string
  /** YYYY-MM-DD or ''. */
  d: string
  /** Organiser: name, UPI ID (null = none), WhatsApp digits (optional). */
  to: { n: string; u: string | null; ph?: string }
  tot: Minor
  /** Items in round order. */
  it: ClaimLinkItem[]
  /** People in round order (organiser first). */
  p: string[]
  /** Items already sorted: [itemIndex, [[personIndex, weight], …]]. */
  fix?: Array<[number, Array<[number, number]>]>
  /** itemsHash() — 12 hex chars. */
  h: string
}

/** What a friend sends back. */
export interface ClaimReplyPayload {
  v: 1
  k: 'reply'
  r: string
  h: string
  /** Index in `p`, or null when they typed their name. */
  w: number | null
  n: string
  /** [itemIndex, num, den] — never a fixed item. */
  x: Array<[number, number, number]>
  /** Had nothing. */
  z?: 1
  /** Paid (minor) when they said so. */
  pd?: Minor
  /** Epoch seconds. */
  at: number
  /** base64url(HMAC-SHA256(secret, replyCanonical(...)).slice(0, 12)) — 16 chars. */
  m: string
}

const L = CLAIM_LIMITS
const ROUND_ID = /^[A-Za-z0-9_-]{1,64}$/
const SECRET = /^[A-Za-z0-9_-]{22}$/
const HASH = /^[0-9a-f]{12}$/
const MAC = /^[A-Za-z0-9_-]{16}$/

/* ------------------------------------------------------------------ canonical strings */

/** First 12 hex chars of SHA-256 of the items as sent (detects a bill edited after the link went out). */
export function itemsHash(currency: string, total: Minor, items: ReadonlyArray<ClaimLinkItem>): string {
  const canon = `${currency}|${total}|${items.map((i) => `${i.n}\t${i.a}\t${i.q ?? 1}`).join('\n')}`
  return sha256Hex(canon).slice(0, 12)
}

/** The text a reply's MAC covers. */
export function replyCanonical(p: Omit<ClaimReplyPayload, 'm' | 'v' | 'k'>): string {
  const picks = p.x.map(([i, a, b]) => `${i}:${a}/${b}`).join(',')
  return `${p.r}|${p.h}|${p.w ?? ''}|${p.n}|${picks}|${p.z ? 1 : ''}|${p.pd ?? ''}|${p.at}`
}

/** A reply's dedupe key: base64url of the first 12 bytes of SHA-256(canonical + '|' + m) — 16 chars. */
export function replyId(p: ClaimReplyPayload): string {
  return bytesToBase64Url(sha256(utf8(`${replyCanonical(p)}|${p.m}`)).slice(0, 12))
}

/* ------------------------------------------------------------------ normalization */

function clampAmount(value: number): Minor {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_MINOR, Math.max(0, Math.round(value)))
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
}

/** Units on a line as a link carries them: an integer 2…99, else none. */
export function linkQuantity(quantity: number): number | undefined {
  return isWhole(quantity, 2, CLAIM_MAX_DEN) ? quantity : undefined
}

function cleanItem(item: ClaimLinkItem): ClaimLinkItem {
  const out: ClaimLinkItem = { n: cleanText(item.n, L.itemName.graphemes, L.itemName.units) || 'Item', a: clampAmount(item.a) }
  const q = item.q === undefined ? undefined : linkQuantity(item.q)
  if (q !== undefined) out.q = q
  return out
}

function cleanName(name: string, fallback: string): string {
  return cleanText(name, L.name.graphemes, L.name.units) || fallback
}

function cleanFix(fix: ClaimLinkPayload['fix'], items: number, people: number): ClaimLinkPayload['fix'] {
  if (!fix) return undefined
  const out: Array<[number, Array<[number, number]>]> = []
  const seen = new Set<number>()
  for (const [index, weights] of fix) {
    if (!isWhole(index, 0, items - 1) || seen.has(index)) continue
    const who = new Set<number>()
    const clean: Array<[number, number]> = []
    for (const [person, weight] of weights) {
      if (!isWhole(person, 0, people - 1) || !isWhole(weight, 1, CLAIM_MAX_DEN) || who.has(person)) continue
      who.add(person)
      clean.push([person, weight])
    }
    if (clean.length === 0) continue
    seen.add(index)
    out.push([index, clean])
  }
  return out.length > 0 ? out : undefined
}

function normalizeLink(raw: ClaimLinkPayload): ClaimLinkPayload {
  const it = raw.it.slice(0, L.items).map(cleanItem)
  const p = raw.p.slice(0, L.people).map((name, i) => cleanName(name, i === 0 ? ORGANISER_FALLBACK : `Person ${i + 1}`))
  const upi = raw.to.u ? normalizeUpiId(raw.to.u) : ''
  const phone = raw.to.ph ? normalizePhone(raw.to.ph) : null
  const currency = raw.c.trim().toUpperCase()
  const payload: ClaimLinkPayload = {
    v: 1,
    k: 'claim',
    r: raw.r,
    s: raw.s,
    t: cleanText(raw.t, L.title.graphemes, L.title.units) || 'Bill',
    c: /^[A-Z]{3}$/.test(currency) ? currency : 'INR',
    d: /^\d{4}-\d{2}-\d{2}$/.test(raw.d) ? raw.d : '',
    to: { n: cleanName(raw.to.n, ORGANISER_FALLBACK), u: upi && isValidUpiId(upi) ? upi : null },
    tot: clampAmount(raw.tot),
    it,
    p,
    h: raw.h,
  }
  if (phone) payload.to.ph = phone
  const fix = cleanFix(raw.fix, it.length, p.length)
  if (fix) payload.fix = fix
  return payload
}

/** Picks as a reply carries them: valid triples, `1 ≤ num ≤ den ≤ 99`, one per item (the first wins). */
function cleanPicks(x: ReadonlyArray<readonly [number, number, number]>): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  const seen = new Set<number>()
  for (const triple of x) {
    const [i, a, b] = triple
    if (!isWhole(i, 0, 10_000) || !isWhole(b, 1, CLAIM_MAX_DEN) || !isWhole(a, 1, b) || seen.has(i)) continue
    seen.add(i)
    out.push([i, a, b])
  }
  return out
}

/**
 * A friend's picks made safe for this link: items that exist and weren't already sorted by the
 * organiser, one pick per item, `1 ≤ num ≤ den ≤ 99`.
 */
export function picksForLink(link: Pick<ClaimLinkPayload, 'it' | 'fix'>, x: ReadonlyArray<readonly [number, number, number]>): Array<[number, number, number]> {
  const fixed = new Set((link.fix ?? []).map(([i]) => i))
  return cleanPicks(x).filter(([i]) => i < link.it.length && !fixed.has(i))
}

function normalizeReply<T extends Omit<ClaimReplyPayload, 'm'>>(raw: T): Omit<ClaimReplyPayload, 'm'> {
  const out: Omit<ClaimReplyPayload, 'm'> = {
    v: 1,
    k: 'reply',
    r: raw.r,
    h: raw.h,
    w: raw.w === null || !isWhole(raw.w, 0, L.people - 1) ? null : raw.w,
    n: cleanName(raw.n, 'Someone'),
    x: raw.z ? [] : cleanPicks(raw.x),
    at: isWhole(raw.at, 0, 1e11) ? raw.at : 0,
  }
  if (raw.z) out.z = 1
  if (raw.pd !== undefined && Number.isFinite(raw.pd)) out.pd = clampAmount(raw.pd)
  return out
}

/* ------------------------------------------------------------------ validation */

const amount = z.int().check(z.minimum(0), z.maximum(MAX_MINOR))

const linkSchema = z.object({
  v: z.literal(1),
  k: z.literal('claim'),
  r: z.string().check(z.regex(ROUND_ID)),
  s: z.string().check(z.regex(SECRET)),
  t: z.string().check(z.maxLength(L.title.units * 2)),
  c: z.string().check(z.maxLength(8)),
  d: z.catch(z.string().check(z.maxLength(10)), ''),
  to: z.object({
    n: z.string().check(z.maxLength(L.name.units * 2)),
    u: z.catch(z.nullable(z.string().check(z.maxLength(330))), null),
    ph: z.optional(z.catch(z.string().check(z.maxLength(32)), '')),
  }),
  tot: amount,
  it: z
    .array(
      z.object({
        n: z.string().check(z.maxLength(L.itemName.units * 2)),
        a: amount,
        q: z.optional(z.number()),
      }),
    )
    .check(z.minLength(1), z.maxLength(L.items)),
  p: z.array(z.string().check(z.maxLength(L.name.units * 2))).check(z.minLength(1), z.maxLength(L.people)),
  fix: z.optional(
    z.array(z.tuple([z.int(), z.array(z.tuple([z.int(), z.int()])).check(z.maxLength(L.people))])).check(z.maxLength(L.items)),
  ),
  h: z.string().check(z.regex(HASH)),
})

const replySchema = z.object({
  v: z.literal(1),
  k: z.literal('reply'),
  r: z.string().check(z.regex(ROUND_ID)),
  h: z.string().check(z.regex(HASH)),
  w: z.nullable(z.int().check(z.minimum(0), z.maximum(L.people - 1))),
  n: z.string().check(z.maxLength(L.name.units * 2)),
  x: z.array(z.tuple([z.int(), z.int(), z.int()])).check(z.maxLength(L.items)),
  z: z.optional(z.literal(1)),
  pd: z.optional(amount),
  at: z.int().check(z.minimum(0)),
  m: z.string().check(z.regex(MAC)),
})

/* ------------------------------------------------------------------ encode / decode */

function defaultOrigin(): string {
  try {
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    return origin && origin !== 'null' ? origin : ''
  } catch {
    return ''
  }
}

function linkJson(p: ClaimLinkPayload): string {
  // Explicit key order keeps links stable for the same payload.
  const { v, k, r, s, t, c, d, to, tot, it, p: people, fix, h } = p
  return JSON.stringify({ v, k, r, s, t, c, d, to, tot, it, p: people, fix, h })
}

function replyJson(p: ClaimReplyPayload): string {
  const { v, k, r, h, w, n, x, z: nothing, pd, at, m } = p
  return JSON.stringify({ v, k, r, h, w, n, x, z: nothing, pd, at, m })
}

/** The claim link for a payload: `${origin}/claim#…`. Never throws. */
export async function encodeClaimLink(p: ClaimLinkPayload, origin?: string): Promise<string> {
  const base = (origin ?? defaultOrigin()).replace(/\/+$/, '')
  return `${base}${CLAIM_PATH}#${await encodeFragment(linkJson(normalizeLink(p)))}`
}

/**
 * A claim link's payload from its `#fragment` (or the whole URL), normalized; null for anything
 * cut short, garbled, oversized (> 16 KB decoded) or not a v1 claim link. Never throws.
 */
export async function decodeClaimLink(hash: string): Promise<ClaimLinkPayload | null> {
  try {
    const json = await decodeFragment(hash, L.maxDecodedBytes)
    if (json === null) return null
    const parsed = linkSchema.safeParse(JSON.parse(json))
    return parsed.success ? normalizeLink(parsed.data as ClaimLinkPayload) : null
  } catch {
    return null
  }
}

/** A friend's reply, normalized and signed with the round's secret. */
export function signReply(secret: string, r: Omit<ClaimReplyPayload, 'm'>): ClaimReplyPayload {
  const clean = normalizeReply(r)
  return { ...clean, m: macB64u(secret, replyCanonical(clean)) }
}

/** The reply link: `${origin}/app/claims/in#…`. Never throws. */
export async function encodeClaimReply(p: ClaimReplyPayload, origin?: string): Promise<string> {
  const base = (origin ?? defaultOrigin()).replace(/\/+$/, '')
  return `${base}${CLAIM_REPLY_PATH}#${await encodeFragment(replyJson(p))}`
}

/**
 * A reply's payload from its `#fragment` (or the whole URL, or a message containing it) — its
 * shape only; `verifyReply` checks it was signed for the round. Null when garbled. Never throws.
 */
export async function decodeClaimReply(hash: string): Promise<ClaimReplyPayload | null> {
  try {
    const json = await decodeFragment(hash, L.maxDecodedBytes)
    if (json === null) return null
    const parsed = replySchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    const data = parsed.data as ClaimReplyPayload
    // Exactly as signed: normalizing must change nothing, or the MAC can't match anyway.
    return { ...normalizeReply(data), m: data.m }
  } catch {
    return null
  }
}

/** True when the reply was signed with `secret` (constant-time compare). */
export function verifyReply(secret: string, p: ClaimReplyPayload): boolean {
  if (typeof p.m !== 'string' || !MAC.test(p.m)) return false
  return timingSafeEqual(macB64u(secret, replyCanonical(p)), p.m)
}

/**
 * The first reply link (or bare fragment) in pasted text — a WhatsApp message with the link in it,
 * the link alone, or just its fragment. Null when there's none.
 */
export function replyFragmentIn(text: string): string | null {
  if (typeof text !== 'string') return null
  const at = text.indexOf(`${CLAIM_REPLY_PATH}#`)
  if (at !== -1) return text.slice(at + CLAIM_REPLY_PATH.length)
  const trimmed = text.trim()
  if (trimmed.startsWith('#')) return trimmed
  if (/^(?:j\.)?[A-Za-z0-9_\-+/]{16,}$/.test(trimmed)) return trimmed
  return null
}

/* ------------------------------------------------------------------ from a round */

/** The bill's items as a claim link carries them (names cleaned, shortened for very long bills). */
export function claimLinkItems(expense: Pick<Expense, 'bill'>, itemIds: readonly string[]): ClaimLinkItem[] {
  const byId = new Map((expense.bill?.items ?? []).map((item) => [item.id, item]))
  const items = itemIds.map((id) => {
    const item = byId.get(id)
    return cleanItem({ n: item?.name ?? 'Item', a: item?.amount ?? 0, q: item ? linkQuantity(item.quantity) : undefined })
  })
  // Long names in a long bill could push the link past its size cap: shorten them all the same way.
  const bytes = items.reduce((sum, item) => sum + utf8Length(item.n), 0)
  if (bytes <= 8 * 1024) return items
  return items.map((item) => ({ ...item, n: cleanText(item.n, 20, 48) || 'Item' }))
}

/** `itemsHash` of the bill as it is now (compare with the round's to see whether it changed). */
export function currentItemsHash(round: Pick<ClaimRound, 'itemIds'>, expense: Pick<Expense, 'bill' | 'currency' | 'total'>): string {
  return itemsHash(expense.currency, clampAmount(expense.total), claimLinkItems(expense, round.itemIds))
}

/** The claim-link payload for a round of an expense. */
export function claimLinkFromRound(
  round: ClaimRound,
  expense: Expense,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
): ClaimLinkPayload {
  const it = claimLinkItems(expense, round.itemIds)
  const people = round.peopleIds.slice(0, L.people)
  const organiser = outsideName(ME_ID, friendsById, profile, ORGANISER_FALLBACK)
  const upi = expense.payerId === ME_ID ? (profile.upiId ?? friendsById[ME_ID]?.upiId ?? null) : (friendsById[expense.payerId]?.upiId ?? null)
  const fixed = new Set(round.fixedItemIds)
  const fix: Array<[number, Array<[number, number]>]> = []
  round.itemIds.forEach((itemId, index) => {
    if (!fixed.has(itemId)) return
    const shares = expense.bill?.assignments[itemId] ?? {}
    const weights: Array<[number, number]> = []
    people.forEach((friendId, person) => {
      const w = Object.hasOwn(shares, friendId) ? Math.floor(shares[friendId] ?? 0) : 0
      if (w > 0) weights.push([person, Math.min(CLAIM_MAX_DEN, w)])
    })
    if (weights.length > 0) fix.push([index, weights])
  })
  const payload: ClaimLinkPayload = {
    v: 1,
    k: 'claim',
    r: round.id,
    s: round.secret,
    t: expense.title,
    c: expense.currency,
    d: expense.date,
    to: { n: organiser, u: upi },
    tot: expense.total,
    it,
    p: people.map((id, i) => (i === 0 ? organiser : outsideName(id, friendsById, profile, `Person ${i + 1}`))),
    h: itemsHash(expense.currency, clampAmount(expense.total), it),
  }
  const phone = friendsById[ME_ID]?.phone
  if (phone) payload.to.ph = phone
  if (fix.length > 0) payload.fix = fix
  return normalizeLink(payload)
}
