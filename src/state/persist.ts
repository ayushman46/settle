/**
 * Saving the in-progress split to localStorage so a refresh (or a closed tab) never loses work.
 * Loading is defensive: anything malformed falls back to a fresh session, and small
 * inconsistencies are repaired rather than thrown away.
 */
import * as z from 'zod/mini'
import { isKnownCurrency } from '../lib/currencies'
import { MAX_MINOR } from '../lib/money'
import { MAX_PEOPLE, nextColor, normalizeName } from '../lib/people'
import { AVATAR_COLORS, type BillFee, type BillItem, type BillTaxLine, type Person, type Session } from '../types'
import { createSession, isCategory, isIsoDay, MAX_ITEMS, repairSession, sanitizeItem } from './reducer'
import { clampStep } from './selectors'

export const SESSION_KEY = 'billsplit.session.v1'

const minor = z.int()
const nullableMinor = z.nullable(z.int())

const sessionSchema = z.object({
  v: z.literal(1),
  id: z.string().check(z.minLength(1)),
  createdAt: z.number(),
  step: z.enum(['scan', 'review', 'paid', 'people', 'assign', 'result']),
  source: z.nullable(z.enum(['scan', 'manual', 'sample'])),
  currency: z.string(),
  meta: z.object({
    merchant: z.nullable(z.string()),
    date: z.nullable(z.string()),
    subtotal: nullableMinor,
    tax: nullableMinor,
    serviceCharge: nullableMinor,
    discount: nullableMinor,
    tip: nullableMinor,
    total: nullableMinor,
    // Added in Settle v4 (delivery fees). Checked leniently by repairSession.
    fees: z.optional(z.unknown()),
    // Added with Bill check. Checked leniently by repairSession.
    taxLines: z.optional(z.unknown()),
    billOfSupply: z.optional(z.unknown()),
  }),
  warnings: z.array(z.string()),
  items: z.array(
    z.object({
      id: z.string().check(z.minLength(1)),
      name: z.string(),
      quantity: z.number(),
      amount: minor,
    }),
  ),
  paid: nullableMinor,
  people: z.array(
    z.object({
      id: z.string().check(z.minLength(1)),
      name: z.string(),
      color: z.int(),
    }),
  ),
  assignments: z.record(z.string(), z.record(z.string(), z.number())),
  assignCursor: z.int(),
  // Added after the first release of v1 — older saves don't have it.
  payerId: z.optional(z.nullable(z.string())),
  // Added in Settle v3. Checked leniently: a bad value is dropped, never the whole bill.
  category: z.optional(z.unknown()),
  date: z.optional(z.unknown()),
  groupId: z.optional(z.unknown()),
  expenseId: z.optional(z.unknown()),
  feeSplit: z.optional(z.unknown()),
  checkKept: z.optional(z.unknown()),
})

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function cleanItems(items: readonly BillItem[]): BillItem[] {
  const seen = new Set<string>()
  const out: BillItem[] = []
  for (const item of items) {
    if (seen.has(item.id) || out.length >= MAX_ITEMS) continue
    seen.add(item.id)
    out.push(sanitizeItem(item))
  }
  return out
}

function cleanPeople(people: readonly Person[]): Person[] {
  const seen = new Set<string>()
  const out: Person[] = []
  for (const person of people) {
    const name = normalizeName(person.name)
    if (!name || seen.has(person.id) || out.length >= MAX_PEOPLE) continue
    seen.add(person.id)
    const valid = person.color >= 0 && person.color < AVATAR_COLORS
    out.push({ id: person.id, name, color: valid ? person.color : nextColor(out) })
  }
  return out
}

/** A non-empty string id, else null. */
function cleanId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function cleanAmount(value: number | null): number | null {
  return value === null ? null : Math.min(Math.abs(value), MAX_MINOR)
}

/** Validates and repairs a parsed value; null when it isn't a session at all. */
export function parseSession(value: unknown): Session | null {
  const parsed = sessionSchema.safeParse(value)
  if (!parsed.success) return null
  const data = parsed.data
  const fresh = createSession()
  const { feeSplit, checkKept, ...rest } = data
  const { fees, taxLines, billOfSupply, ...printed } = data.meta
  const session: Session = {
    ...rest,
    currency: isKnownCurrency(data.currency) ? data.currency : fresh.currency,
    createdAt: Number.isFinite(data.createdAt) ? data.createdAt : fresh.createdAt,
    meta: {
      ...printed,
      // Cleaned by repairSession (a list that isn't one is dropped).
      ...(Array.isArray(fees) ? { fees: fees as BillFee[] } : {}),
      ...(Array.isArray(taxLines) ? { taxLines: taxLines as BillTaxLine[] } : {}),
      ...(billOfSupply === true ? { billOfSupply: true } : {}),
      subtotal: cleanAmount(data.meta.subtotal),
      tax: cleanAmount(data.meta.tax),
      serviceCharge: cleanAmount(data.meta.serviceCharge),
      discount: cleanAmount(data.meta.discount),
      tip: cleanAmount(data.meta.tip),
      total: cleanAmount(data.meta.total),
    },
    items: cleanItems(data.items),
    paid: data.paid === null || data.paid < 0 ? null : Math.min(data.paid, MAX_MINOR),
    people: cleanPeople(data.people),
    payerId: data.payerId ?? null,
    category: isCategory(data.category) ? data.category : null,
    date: isIsoDay(data.date) ? data.date : null,
    groupId: cleanId(data.groupId),
    expenseId: cleanId(data.expenseId),
  }
  if (feeSplit === 'equal' || feeSplit === 'proportional') session.feeSplit = feeSplit
  if (Array.isArray(checkKept)) session.checkKept = checkKept as string[]
  const repaired = repairSession(session)
  const step = clampStep(repaired, repaired.step)
  return step === repaired.step ? repaired : { ...repaired, step }
}

/** The saved session, or a fresh one when there is none or it can't be trusted. Never throws. */
export function loadSession(store: Storage | null = storage()): Session {
  try {
    const raw = store?.getItem(SESSION_KEY)
    if (raw) {
      const session = parseSession(JSON.parse(raw))
      if (session) return session
    }
  } catch {
    // Corrupt JSON or blocked storage — start fresh.
  }
  return createSession()
}

/** Saves the session. Returns false when storage is unavailable or full. Never throws. */
export function saveSession(session: Session, store: Storage | null = storage()): boolean {
  if (!store) return false
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}
