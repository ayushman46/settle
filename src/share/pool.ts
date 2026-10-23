/**
 * Collection links (chanda / pools): one URL with the live goal for the group chat, and the signed
 * "I've chipped in" reply that comes back to the organiser. Both travel in the `#fragment` (never
 * sent to a server), on the shared fragment codec; replies carry a short HMAC under the pool's
 * secret so a garbled, edited or mixed-up reply is caught.
 *
 *     https://settle.example/pool#<fragment>            (what everyone opens)
 *     https://settle.example/app/pools/in#<fragment>    (the reply the organiser opens)
 */
import * as z from 'zod/mini'
import { ME_ID, POOL_OCCASIONS, type Friend, type Minor, type Pool, type PoolMode, type PoolOccasion, type Profile } from '../domain/types'
import { contributorKey, expectedCount, isIn, paidBy } from '../engine/pools'
import { MAX_MINOR } from '../lib/money'
import { graphemes, nameKey } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { bytesToBase64Url } from './base64url'
import { decodeFragment, encodeFragment } from './fragment'
import { macB64u, timingSafeEqual } from './hmac'
import { normalizePhone } from './links'
import { outsideName } from './names'
import { sha256, utf8 } from './sha256'
import { cleanText, utf8Length } from './text'

export const POOL_PATH = '/pool'
export const POOL_REPLY_PATH = '/app/pools/in'

export interface PoolLinkPerson {
  n: string
  /** Counted "in" (paid their part, or gave anything when it's pay-what-you-want). */
  ok?: 1
  /** What they gave — only when the organiser shows amounts. */
  a?: Minor
}

export interface PoolLinkPayload {
  v: 1
  k: 'pool'
  /** The pool's id. */
  id: string
  /** The secret replies are signed with. */
  s: string
  /** Title, emoji, occasion, currency. */
  t: string
  e: string
  o: PoolOccasion
  c: string
  /** The organiser: name, UPI ID, phone (international digits, for "Tell …" on WhatsApp). */
  to: { n: string; u: string | null; ph?: string }
  m: PoolMode
  /** perPerson (fixed). */
  pp?: Minor
  /** target (pay what you want), when there's a goal. */
  tg?: Minor
  /** Deadline, YYYY-MM-DD. */
  dl?: string
  /** Note ≤ 140. */
  no?: string
  /** Expected + contributors (max 60, unpaid first): name, paid flag, amount when showAmounts. */
  p: PoolLinkPerson[]
  /** Names beyond 60. */
  more?: number
  /** How many people the organiser expects (listed people, else "about how many"); absent when unknown. */
  ex?: number
  /** Collected so far. */
  col: Minor
  /** How many people have chipped in. */
  cnt: number
  /** updatedAt, epoch seconds. */
  at: number
}

export interface PoolReplyPayload {
  v: 1
  k: 'chip'
  id: string
  /** Index of the picked name in the link's `p`, or null for "I'm not on the list". */
  w: number | null
  n: string
  a: Minor
  at: number
  /** MAC: HMAC-SHA256(secret, canonical)[0..12], base64url. */
  m: string
}

export const POOL_LINK_LIMITS = {
  maxDecodedBytes: 16 * 1024,
  people: 60,
  title: { graphemes: 60, units: 160 },
  name: { graphemes: 24, units: 64 },
  note: { graphemes: 140, units: 280 },
  emoji: { graphemes: 1, units: 16 },
} as const

/** Shown when the organiser's name can't be shared. */
export const ORGANISER_FALLBACK = 'Your friend'

const L = POOL_LINK_LIMITS
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAC_PATTERN = /^[A-Za-z0-9_-]{16}$/
const SECRET_PATTERN = /^[A-Za-z0-9_-]{22}$/

/* ------------------------------------------------------------------ validation */

const minor = z.number()
const linkSchema = z.object({
  v: z.literal(1),
  k: z.literal('pool'),
  id: z.string().check(z.minLength(1), z.maxLength(200)),
  s: z.string().check(z.regex(SECRET_PATTERN)),
  t: z.string().check(z.maxLength(L.title.units * 2)),
  e: z.catch(z.string(), ''),
  o: z.catch(z.string(), 'other'),
  c: z.catch(z.string(), 'INR'),
  to: z.object({
    n: z.catch(z.string(), ''),
    u: z.catch(z.nullable(z.string().check(z.maxLength(330))), null),
    ph: z.optional(z.catch(z.string(), '')),
  }),
  m: z.catch(z.enum(['fixed', 'target']), 'target'),
  pp: z.optional(minor),
  tg: z.optional(minor),
  dl: z.optional(z.catch(z.string(), '')),
  no: z.optional(z.catch(z.string(), '')),
  p: z.array(
    z.object({
      n: z.catch(z.string(), ''),
      ok: z.optional(z.catch(z.number(), 0)),
      a: z.optional(z.catch(z.number(), 0)),
    }),
  ),
  more: z.optional(z.catch(z.number(), 0)),
  ex: z.optional(z.catch(z.number(), 0)),
  col: z.catch(minor, 0),
  cnt: z.catch(z.number(), 0),
  at: z.catch(z.number(), 0),
})

const replySchema = z.object({
  v: z.literal(1),
  k: z.literal('chip'),
  id: z.string().check(z.minLength(1), z.maxLength(200)),
  w: z.nullable(z.number()),
  n: z.string().check(z.maxLength(L.name.units * 2)),
  a: z.number(),
  at: z.number(),
  m: z.string().check(z.regex(MAC_PATTERN)),
})

function clampAmount(value: number | undefined): Minor {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(MAX_MINOR, Math.max(0, Math.round(value)))
}

function wholeIn(value: number | undefined, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null
}

function cleanName(value: string): string {
  return cleanText(value, L.name.graphemes, L.name.units)
}

function cleanEmojiChar(value: string, occasionFallback: string): string {
  const first = graphemes(cleanText(value, 4, L.emoji.units))[0] ?? ''
  return first && first.length <= L.emoji.units ? first : occasionFallback
}

const OCCASION_EMOJI: Readonly<Record<PoolOccasion, string>> = {
  birthday: '🎂',
  farewell: '👋',
  diwali: '🪔',
  shagun: '💍',
  office: '🏢',
  puja: '🙏',
  trip: '✈️',
  party: '🎉',
  sports: '🏏',
  other: '✨',
}

/** Brings any link payload into canonical form (both sides run it, so what's encoded is what's shown). */
export function normalizePoolLink(raw: PoolLinkPayload): PoolLinkPayload {
  const occasion: PoolOccasion = (POOL_OCCASIONS as readonly string[]).includes(raw.o) ? raw.o : 'other'
  const currency = typeof raw.c === 'string' && /^[A-Z]{3}$/.test(raw.c.trim().toUpperCase()) ? raw.c.trim().toUpperCase() : 'INR'
  const upi = raw.to.u ? normalizeUpiId(raw.to.u) : ''
  const phone = raw.to.ph ? normalizePhone(raw.to.ph) : null
  const perPerson = clampAmount(raw.pp)
  const mode: PoolMode = raw.m === 'fixed' && perPerson > 0 ? 'fixed' : 'target'
  const people = raw.p.slice(0, L.people).map((person, i) => {
    const out: PoolLinkPerson = { n: cleanName(person.n) || `Person ${i + 1}` }
    if (person.ok) out.ok = 1
    const amount = clampAmount(person.a)
    if (amount > 0) out.a = amount
    return out
  })
  const dropped = Math.max(0, raw.p.length - people.length)
  const payload: PoolLinkPayload = {
    v: 1,
    k: 'pool',
    id: raw.id,
    s: raw.s,
    t: cleanText(raw.t, L.title.graphemes, L.title.units) || 'Collection',
    e: cleanEmojiChar(raw.e, OCCASION_EMOJI[occasion]),
    o: occasion,
    c: currency,
    to: { n: cleanName(raw.to.n) || ORGANISER_FALLBACK, u: upi && isValidUpiId(upi) ? upi : null },
    m: mode,
    p: people,
    col: clampAmount(raw.col),
    cnt: wholeIn(Math.round(raw.cnt), 0, 100_000) ?? 0,
    at: wholeIn(Math.round(raw.at), 0, 32_503_680_000) ?? 0,
  }
  if (phone) payload.to.ph = phone
  if (mode === 'fixed') payload.pp = perPerson
  const target = clampAmount(raw.tg)
  if (mode === 'target' && target > 0) payload.tg = target
  if (raw.dl && ISO_DATE.test(raw.dl)) payload.dl = raw.dl
  const note = raw.no ? cleanText(raw.no, L.note.graphemes, L.note.units) : ''
  if (note) payload.no = note
  const more = (wholeIn(raw.more, 0, 100_000) ?? 0) + dropped
  if (more > 0) payload.more = more
  const ex = wholeIn(raw.ex, 1, 500)
  if (ex !== null) payload.ex = ex
  return payload
}

function serializeLink(p: PoolLinkPayload): string {
  // Explicit key order keeps links stable for the same payload.
  const { v, k, id, s, t, e, o, c, to, m, pp, tg, dl, no, p: people, more, ex, col, cnt, at } = p
  return JSON.stringify({ v, k, id, s, t, e, o, c, to, m, pp, tg, dl, no, p: people, more, ex, col, cnt, at })
}

/** The canonical JSON, shrunk (the note, then names from the end) until it fits the size cap. */
function fittedLinkJson(payload: PoolLinkPayload): string {
  let current = normalizePoolLink(payload)
  let json = serializeLink(current)
  if (utf8Length(json) > L.maxDecodedBytes && current.no) {
    current = { ...current, no: undefined }
    json = serializeLink(current)
  }
  while (utf8Length(json) > L.maxDecodedBytes && current.p.length > 0) {
    current = { ...current, p: current.p.slice(0, -1), more: (current.more ?? 0) + 1 }
    json = serializeLink(current)
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

function base(origin: string | undefined): string {
  return (origin ?? defaultOrigin()).replace(/\/+$/, '')
}

/** `${origin}/pool#…` for a payload. Never throws. */
export async function encodePoolLink(p: PoolLinkPayload, origin?: string): Promise<string> {
  return `${base(origin)}${POOL_PATH}#${await encodeFragment(fittedLinkJson(p))}`
}

/** Reads a collection link (fragment, `#…` or whole URL): null for anything corrupt, oversized or not a pool link. */
export async function decodePoolLink(hash: string): Promise<PoolLinkPayload | null> {
  try {
    const json = await decodeFragment(hash, L.maxDecodedBytes)
    if (json === null) return null
    const parsed = linkSchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    const d = parsed.data
    return normalizePoolLink({
      ...d,
      v: 1,
      k: 'pool',
      o: d.o as PoolOccasion,
      to: { n: d.to.n, u: d.to.u, ...(d.to.ph ? { ph: d.to.ph } : {}) },
      p: d.p.map((x) => ({ n: x.n, ...(x.ok ? { ok: 1 as const } : {}), ...(x.a ? { a: x.a } : {}) })),
    })
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ replies */

/** The text the MAC covers: `${id}|${w ?? ''}|${n}|${a}|${at}`. */
export function poolReplyCanonical(r: Pick<PoolReplyPayload, 'id' | 'w' | 'n' | 'a' | 'at'>): string {
  return `${r.id}|${r.w ?? ''}|${r.n}|${r.a}|${r.at}`
}

function normalizeReplyFields(r: Omit<PoolReplyPayload, 'm'>): Omit<PoolReplyPayload, 'm'> {
  return {
    v: 1,
    k: 'chip',
    id: r.id,
    w: wholeIn(r.w ?? undefined, 0, L.people - 1),
    n: cleanName(r.n) || 'Someone',
    a: clampAmount(r.a),
    at: wholeIn(Math.round(r.at), 0, 32_503_680_000) ?? 0,
  }
}

/** A reply with its MAC under the pool's secret (fields normalized first, so the MAC survives the round trip). */
export function signPoolReply(secret: string, r: Omit<PoolReplyPayload, 'm'>): PoolReplyPayload {
  const clean = normalizeReplyFields(r)
  return { ...clean, m: macB64u(secret, poolReplyCanonical(clean)) }
}

/** True when the reply's MAC matches the pool's secret. */
export function verifyPoolReply(secret: string, p: PoolReplyPayload): boolean {
  if (!MAC_PATTERN.test(p.m)) return false
  return timingSafeEqual(macB64u(secret, poolReplyCanonical(p)), p.m)
}

/** A stable id for a reply (dedupe): the first 12 bytes of SHA-256(canonical + '|' + m), base64url. */
export function poolReplyId(p: PoolReplyPayload): string {
  return bytesToBase64Url(sha256(utf8(`${poolReplyCanonical(p)}|${p.m}`)).slice(0, 12))
}

function serializeReply(p: PoolReplyPayload): string {
  const { v, k, id, w, n, a, at, m } = p
  return JSON.stringify({ v, k, id, w, n, a, at, m })
}

/** `${origin}/app/pools/in#…`. Never throws. */
export async function encodePoolReply(p: PoolReplyPayload, origin?: string): Promise<string> {
  return `${base(origin)}${POOL_REPLY_PATH}#${await encodeFragment(serializeReply(p))}`
}

/**
 * Reads a reply link (fragment, `#…` or whole URL, also pasted chat text that contains one), or
 * null. The fields come back exactly as signed — a changed character fails `verifyPoolReply`.
 */
export async function decodePoolReply(hash: string): Promise<PoolReplyPayload | null> {
  try {
    const json = await decodeFragment(hash, 4 * 1024)
    if (json === null) return null
    const parsed = replySchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    const d = parsed.data
    if (d.a <= 0 || !Number.isInteger(d.a) || d.a > MAX_MINOR) return null
    if (d.w !== null && wholeIn(d.w, 0, L.people - 1) === null) return null
    if (!Number.isInteger(d.at) || d.at < 0) return null
    return { v: 1, k: 'chip', id: d.id, w: d.w, n: d.n, a: d.a, at: d.at, m: d.m }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ from a pool */

interface Row {
  name: string
  paid: Minor
  ok: boolean
}

/**
 * The people a link lists: everyone expected (in the organiser's order), then anyone else who
 * chipped in — each with what they've given and whether they're "in".
 */
export function poolPeopleRows(pool: Pool, friendsById: Readonly<Record<string, Friend>>, profile: Pick<Profile, 'name'>): Row[] {
  const paid = paidBy(pool)
  const rows: Row[] = []
  const seen = new Set<string>()
  const stored = new Map<string, string>()
  for (const c of pool.contributions) if (!stored.has(contributorKey(c))) stored.set(contributorKey(c), c.name)
  for (const id of pool.memberIds) {
    if (id === ME_ID || seen.has(id)) continue
    seen.add(id)
    const amount = paid.get(id) ?? 0
    rows.push({ name: outsideName(id, friendsById, profile, stored.get(id) ?? 'Someone'), paid: amount, ok: isIn(pool, amount) })
  }
  for (const [key, amount] of paid) {
    if (seen.has(key)) continue
    seen.add(key)
    const friend = friendsById[key]
    const name = friend && key !== ME_ID ? outsideName(key, friendsById, profile, stored.get(key) ?? 'Someone') : (stored.get(key) ?? 'Someone')
    rows.push({ name, paid: amount, ok: isIn(pool, amount) })
  }
  return rows
}

/** The link payload for a pool, as of now. */
export function poolLinkFromPool(pool: Pool, friendsById: Readonly<Record<string, Friend>>, profile: Profile): PoolLinkPayload {
  const rows = poolPeopleRows(pool, friendsById, profile)
  // Unpaid first (they're who the link is for), each group in order.
  const ordered = [...rows.filter((r) => !r.ok), ...rows.filter((r) => r.ok)]
  const kept = ordered.slice(0, L.people)
  let collected = 0
  let contributors = 0
  for (const r of rows) {
    collected += r.paid
    if (r.paid > 0) contributors++
  }
  const upi = profile.upiId ?? friendsById[ME_ID]?.upiId ?? null
  const phone = friendsById[ME_ID]?.phone ?? null
  const payload: PoolLinkPayload = {
    v: 1,
    k: 'pool',
    id: pool.id,
    s: pool.secret,
    t: pool.title,
    e: pool.emoji,
    o: pool.occasion,
    c: pool.currency,
    to: { n: outsideName(ME_ID, friendsById, profile, ORGANISER_FALLBACK), u: upi, ...(phone ? { ph: phone } : {}) },
    m: pool.mode,
    p: kept.map((r) => ({ n: r.name, ...(r.ok ? { ok: 1 as const } : {}), ...(pool.showAmounts && r.paid > 0 ? { a: r.paid } : {}) })),
    col: collected,
    cnt: contributors,
    at: Math.floor(pool.updatedAt / 1000),
  }
  if (pool.mode === 'fixed' && pool.perPerson !== null) payload.pp = pool.perPerson
  if (pool.mode === 'target' && pool.target !== null) payload.tg = pool.target
  if (pool.deadline) payload.dl = pool.deadline
  if (pool.note) payload.no = pool.note
  if (ordered.length > kept.length) payload.more = ordered.length - kept.length
  const expected = expectedCount(pool)
  if (expected !== null) payload.ex = expected
  return normalizePoolLink(payload)
}

/* ------------------------------------------------------------------ reading a link */

/** How many people the organiser expects, as of the link, or null. */
export function poolLinkExpected(p: PoolLinkPayload): number | null {
  return p.ex ?? null
}

/** The link's goal (fixed → per person × people expected; target → the goal), or null. */
export function poolLinkGoal(p: PoolLinkPayload): Minor | null {
  if (p.m === 'fixed') return p.pp !== undefined && p.ex !== undefined ? p.pp * p.ex : null
  return p.tg ?? null
}

/** How many expected people haven't chipped in yet, as far as the link knows (for the suggestion). */
export function poolLinkPeopleLeft(p: PoolLinkPayload): number {
  if (p.ex === undefined) return 0
  const inCount = p.m === 'fixed' ? p.p.filter((x) => x.ok).length : p.cnt
  return Math.max(0, p.ex - inCount)
}

/** Matches a reply's name to one of `candidates` by name (case/accent-insensitive), when exactly one matches. */
export function matchByName<T extends { name: string }>(name: string, candidates: readonly T[]): T | null {
  const key = nameKey(name)
  if (!key) return null
  const hits = candidates.filter((c) => nameKey(c.name) === key)
  return hits.length === 1 ? (hits[0] ?? null) : null
}
