/**
 * "I've paid" replies to a pay link. The friend who paid sends one back from the pay page (on
 * WhatsApp, straight to the payee when the link carries their number); the payee opens it in
 * Settle and ticks them off in one tap. Nobody asks "did you pay?" and nobody digs through UPI
 * history. Travels in the `#fragment` on the shared codec — never sent to a server.
 *
 *     https://settle.example/app/paid#<fragment>
 *
 * Unsigned on purpose: anyone holding the pay link could say they paid anyway, so the payee
 * always confirms (and sees the UPI reference to check against their bank app).
 */
import * as z from 'zod/mini'
import type { Minor } from '../domain/types'
import { MAX_MINOR } from '../lib/money'
import { asciiDigits } from './links'
import { decodeFragment, encodeFragment } from './fragment'
import { PAY_LINK_LIMITS, type PayLinkPayload } from './payLink'
import { cleanText } from './text'

export const PAID_REPLY_PATH = '/app/paid'

export type PaidHow = 'upi' | 'cash'

export interface PaidReplyPayload {
  v: 1
  k: 'paid'
  /** The expense's id on the payee's phone. */
  e: string
  /** Who paid: their index in the link's `p`, and their name there. */
  i: number
  n: string
  /** What they paid (their share), its currency, and what it was for. */
  a: Minor
  c: string
  t: string
  /** By UPI or in cash. */
  h: PaidHow
  /** The UPI reference (UTR, 12 digits), when they added it. */
  r?: string
}

const L = PAY_LINK_LIMITS
const ID = /^[A-Za-z0-9_-]{1,64}$/
const UTR = /^\d{12}$/

const replySchema = z.object({
  v: z.literal(1),
  k: z.literal('paid'),
  e: z.string().check(z.regex(ID)),
  i: z.int().check(z.minimum(0), z.maximum(L.people - 1)),
  n: z.string().check(z.maxLength(L.name.units)),
  a: z.int().check(z.minimum(1), z.maximum(MAX_MINOR)),
  c: z.string().check(z.regex(/^[A-Z]{3}$/)),
  t: z.string().check(z.maxLength(L.title.units)),
  h: z.enum(['upi', 'cash']),
  r: z.optional(z.string().check(z.regex(UTR))),
})

/** A UPI reference (UTR) as typed — "4321 5678 9012" → "432156789012" — or null unless it's 12 digits. */
export function cleanUtr(text: string): string | null {
  const digits = asciiDigits(text).replace(/[\s-]/g, '')
  return UTR.test(digits) ? digits : null
}

/** "4321 5678 9012" — easier to compare against a bank app. */
export function formatUtr(utr: string): string {
  return utr.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/**
 * The reply for `payload`'s person at `index`, or null when the link can't take one (no expense
 * id: links from older versions, or ones a feature builds itself), the index is the payee's or
 * out of range, or their share is zero.
 */
export function paidReplyFor(payload: PayLinkPayload, index: number, how: PaidHow, utr: string | null = null): PaidReplyPayload | null {
  const person = payload.p[index]
  if (!payload.id || !person || index === payload.pi || person.a <= 0) return null
  const reply: PaidReplyPayload = { v: 1, k: 'paid', e: payload.id, i: index, n: person.n, a: person.a, c: payload.c, t: payload.t, h: how }
  const ref = how === 'upi' && utr ? cleanUtr(utr) : null
  if (ref) reply.r = ref
  return reply
}

function serialize(p: PaidReplyPayload): string {
  const { v, k, e, i, n, a, c, t, h, r } = p
  return JSON.stringify({ v, k, e, i, n, a, c, t, h, r })
}

function base(origin?: string): string {
  try {
    const fallback = typeof window === 'undefined' ? '' : window.location.origin
    return (origin ?? (fallback && fallback !== 'null' ? fallback : '')).replace(/\/+$/, '')
  } catch {
    return ''
  }
}

/** `${origin}/app/paid#…`. Never throws. */
export async function encodePaidReply(p: PaidReplyPayload, origin?: string): Promise<string> {
  return `${base(origin)}${PAID_REPLY_PATH}#${await encodeFragment(serialize(p))}`
}

/** Reads a reply (fragment, `#…` or whole URL, also chat text that contains one), or null. Never throws. */
export async function decodePaidReply(hash: string): Promise<PaidReplyPayload | null> {
  try {
    const json = await decodeFragment(hash, 4 * 1024)
    if (json === null) return null
    const parsed = replySchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    const d = parsed.data
    const reply: PaidReplyPayload = {
      v: 1,
      k: 'paid',
      e: d.e,
      i: d.i,
      n: cleanText(d.n, L.name.graphemes, L.name.units) || 'Someone',
      a: d.a,
      c: d.c,
      t: cleanText(d.t, L.title.graphemes, L.title.units),
      h: d.h,
    }
    if (d.r && d.h === 'upi') reply.r = d.r
    return reply
  } catch {
    return null
  }
}
