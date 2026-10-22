/**
 * What may be loaded from storage or a backup file. Shapes are checked with zod, then each
 * record is repaired (names tidied, invalid UPI IDs dropped, shares recomputed if they don't add
 * up). Lists drop bad records one at a time — one corrupt expense never costs you the rest.
 */
import * as z from 'zod/mini'
import {
  CATEGORY_IDS,
  FX_SOURCES,
  LANGUAGE_CODES,
  ME_ID,
  POOL_OCCASIONS,
  type BillSnapshot,
  type CategoryId,
  type ClaimDecision,
  type ClaimPick,
  type ClaimReply,
  type ClaimRound,
  type Contribution,
  type Expense,
  type ExpenseKind,
  type ExpenseSource,
  type Friend,
  type FxSnapshot,
  type Group,
  type GroupKind,
  type LanguageCode,
  type Participant,
  type Pool,
  type PoolOccasion,
  type Profile,
  type RecurringTemplate,
  type Settlement,
} from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import { isIsoDate, isPeriod, toIsoDate, today } from '../engine/dates'
import { isValidRate } from '../engine/fx'
import { expenseShares, isValidTotal, uniqueParticipants } from '../engine/split'
import { defaultCurrency, isKnownCurrency } from '../lib/currencies'
import { randomB64u } from '../lib/ids'
import { MAX_MINOR } from '../lib/money'
import { graphemes, normalizeName } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { AVATAR_COLORS, BILL_FEE_KINDS, type BillFee, type BillFeeKind, type BillItem, type BillMeta, type FeeSplit } from '../types'
import type { ZodType } from './store'

/* ------------------------------------------------------------------ limits */

export const MAX_FRIENDS = 200
export const MAX_TITLE_LENGTH = 80
export const MAX_NOTE_LENGTH = 500
export const MAX_GROUP_NAME_LENGTH = 40
export const MAX_PARTICIPANTS = 100
export const MAX_GROUP_MEMBERS = 100

export const GROUP_KINDS: readonly GroupKind[] = ['trip', 'home', 'couple', 'event', 'other']
export const EXPENSE_SOURCES: readonly ExpenseSource[] = ['manual', 'scan', 'describe', 'sample', 'recurring', 'sms', 'voice']
export const EXPENSE_KINDS: readonly ExpenseKind[] = ['split', 'bill', 'loan']
export const FEE_SPLITS: readonly FeeSplit[] = ['proportional', 'equal']
export const DEFAULT_GROUP_EMOJI = '👥'

/** Delivery-app fees kept on one bill, and the longest fee label. */
export const MAX_BILL_FEES = 15
export const MAX_FEE_LABEL_LENGTH = 40

/** Claim rounds kept, and replies kept per round. */
export const MAX_CLAIM_ROUNDS = 200
export const MAX_CLAIM_REPLIES = 100
/** Largest denominator (and assign weight) in a claim: "1 of 99". */
export const MAX_CLAIM_DEN = 99

/** Collections kept, people per collection, contributions per collection. */
export const MAX_POOLS = 200
export const MAX_POOL_MEMBERS = 200
export const MAX_POOL_CONTRIBUTIONS = 500
export const MAX_POOL_TITLE_LENGTH = 60
export const MAX_POOL_NOTE_LENGTH = 140
export const MAX_CONTRIBUTOR_NAME_LENGTH = 40

/** A 22-character base64url secret (16 random bytes) that signs replies to a shared link. */
export const LINK_SECRET_PATTERN = /^[A-Za-z0-9_-]{22}$/
const ITEMS_HASH_PATTERN = /^[0-9a-f]{12}$/

/** Each occasion's emoji and the title used when none was typed. */
export const POOL_OCCASION_DEFAULTS: Readonly<Record<PoolOccasion, { emoji: string; title: string }>> = {
  birthday: { emoji: '🎂', title: 'Birthday gift' },
  farewell: { emoji: '👋', title: 'Farewell' },
  diwali: { emoji: '🪔', title: 'Diwali party' },
  shagun: { emoji: '💍', title: 'Wedding shagun' },
  office: { emoji: '🏢', title: 'Office collection' },
  puja: { emoji: '🙏', title: 'Puja chanda' },
  trip: { emoji: '✈️', title: 'Trip advance' },
  party: { emoji: '🎉', title: 'Party' },
  sports: { emoji: '🏏', title: 'Turf or sports' },
  other: { emoji: '✨', title: 'Collection' },
}

/* ------------------------------------------------------------------ cleaners (shared with actions) */

/** Zero-width joiner: glues emoji sequences (👩‍💻), so it survives the control-character clean-up. */
const ZWJ = '\u200d'

function stripControls(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === ZWJ ? c : ''))
}

function capGraphemes(value: string, max: number): string {
  // A string never has more characters than UTF-16 units: short text needs no segmenting (the
  // common case, and it keeps loading thousands of saved records fast).
  if (value.length <= max) return value
  const chars = graphemes(value)
  return chars.length <= max ? value : chars.slice(0, max).join('').trim()
}

/** NFC, single spaces, no control characters, at most `max` user-perceived characters. */
export function cleanText(value: string, max: number): string {
  return capGraphemes(stripControls(value.normalize('NFC').replace(/\s+/g, ' ')).trim(), max)
}

/** Like `cleanText` but keeps line breaks (at most one blank line in a row) — for notes. */
export function cleanMultiline(value: string, max: number): string {
  const lines = value
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => stripControls(line.replace(/\s+/g, ' ')).trim())
  return capGraphemes(lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), max)
}

/** A valid, normalized UPI ID or null. */
export function cleanUpiId(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  return isValidUpiId(value) ? normalizeUpiId(value) : null
}

/** Digits with an optional leading "+", 7–15 digits long ("+91 98765-43210" → "+919876543210"), else null. */
export function cleanPhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

/** The first emoji (or character) of `value`, or the default group emoji. */
export function cleanEmoji(value: string | null | undefined): string {
  if (typeof value !== 'string') return DEFAULT_GROUP_EMOJI
  const first = graphemes(value.trim())[0]
  return first && /\S/u.test(first) ? first : DEFAULT_GROUP_EMOJI
}

export function cleanCurrency(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' && isKnownCurrency(value) ? value : fallback
}

function cleanColor(value: number): number {
  return Number.isInteger(value) && value >= 0 && value < AVATAR_COLORS ? value : Math.abs(Math.trunc(value) || 0) % AVATAR_COLORS
}

function cleanTimestamp(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

function cleanDate(value: string, createdAt: number): string {
  if (isIsoDate(value)) return value
  return createdAt > 0 ? toIsoDate(new Date(createdAt)) : today()
}

/** A default title when none was typed: the category's label ("Transport"). */
export function fallbackTitle(category: CategoryId): string {
  return category === 'other' ? 'Expense' : CATEGORY_META[category].label
}

/* ------------------------------------------------------------------ list helper */

/**
 * A list schema that keeps every item `item` accepts and silently drops the rest (and repeats
 * of an id already seen), up to `max` items. `isCanonical` (optional) recognises a record that
 * `item` would hand back unchanged; those skip the schema (the fast path for what the app saved).
 */
export function records<T>(
  item: ZodType<T>,
  idOf: (value: T) => string,
  max = Number.POSITIVE_INFINITY,
  isCanonical?: (raw: unknown) => raw is T,
): ZodType<T[]> {
  return z.pipe(
    z.array(z.unknown()),
    z.transform((items: unknown[]) => {
      const seen = new Set<string>()
      const out: T[] = []
      for (const raw of items) {
        if (out.length >= max) break
        let value: T
        if (isCanonical?.(raw)) {
          value = raw
        } else {
          const parsed = z.safeParse(item, raw)
          if (!parsed.success) continue
          value = parsed.data
        }
        const id = idOf(value)
        if (seen.has(id)) continue
        seen.add(id)
        out.push(value)
      }
      return out
    }),
  )
}

/** Turns a repair function into a schema step: null → the record is rejected. */
function repaired<I, O>(shape: ZodType<I>, repair: (value: I) => O | null): ZodType<O> {
  return z.pipe(
    shape,
    z.transform((value: I, ctx) => {
      const out = repair(value)
      if (out === null) {
        ctx.issues.push({ code: 'custom', message: 'Unusable record', input: value })
        return z.NEVER
      }
      return out
    }),
  )
}

/* ------------------------------------------------------------------ primitives */

const id = z.string().check(z.minLength(1), z.maxLength(200))
const timestamp = z.catch(z.number(), 0)
const nullableText = z.catch(z.nullable(z.string()), null)
const nullableMinor = z.catch(z.nullable(z.int()), null)
const category = z.catch(z.enum(CATEGORY_IDS as readonly CategoryId[]), 'other')

/* ------------------------------------------------------------------ profile */

const profileShape = z.object({
  name: z.catch(z.string(), ''),
  upiId: nullableText,
  currency: z.catch(z.string(), ''),
  theme: z.catch(z.enum(['system', 'light', 'dark']), 'system'),
  accent: z.catch(z.enum(['lime', 'mint', 'sky', 'violet', 'coral']), 'lime'),
  haptics: z.catch(z.boolean(), true),
  onboarded: z.catch(z.boolean(), false),
  createdAt: timestamp,
  language: z.catch(z.nullable(z.enum(LANGUAGE_CODES as readonly LanguageCode[])), null),
})

export function defaultProfile(): Profile {
  return {
    name: '',
    upiId: null,
    currency: defaultCurrency(),
    theme: 'system',
    accent: 'lime',
    haptics: true,
    onboarded: false,
    createdAt: Date.now(),
    language: null,
  }
}

/** A language code, or null (automatic) for anything else. */
export function cleanLanguage(value: unknown): LanguageCode | null {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value) ? (value as LanguageCode) : null
}

export const profileSchema: ZodType<Profile> = repaired(profileShape, (p) => ({
  name: normalizeName(p.name),
  upiId: cleanUpiId(p.upiId),
  currency: cleanCurrency(p.currency, defaultCurrency()),
  theme: p.theme,
  accent: p.accent,
  haptics: p.haptics,
  onboarded: p.onboarded,
  createdAt: cleanTimestamp(p.createdAt) || Date.now(),
  language: p.language,
}))

/* ------------------------------------------------------------------ friends */

const friendShape = z.object({
  id,
  name: z.string(),
  color: z.catch(z.int(), 0),
  upiId: nullableText,
  phone: nullableText,
  createdAt: timestamp,
  lastUsedAt: timestamp,
})

/** The device owner's own entry ("You" in the UI). */
export function meFriend(name: string, now = Date.now()): Friend {
  return {
    id: ME_ID,
    name: normalizeName(name) || 'Me',
    color: 0,
    upiId: null,
    phone: null,
    createdAt: now,
    lastUsedAt: now,
  }
}

export const friendSchema: ZodType<Friend> = repaired(friendShape, (f) => {
  const name = normalizeName(f.name)
  if (!name) return null
  return {
    id: f.id,
    name,
    color: cleanColor(f.color),
    upiId: cleanUpiId(f.upiId),
    phone: cleanPhone(f.phone),
    createdAt: cleanTimestamp(f.createdAt),
    lastUsedAt: cleanTimestamp(f.lastUsedAt),
  }
})

/** Puts the owner first, adding them if missing. */
export function withMe(friends: readonly Friend[]): Friend[] {
  const me = friends.find((f) => f.id === ME_ID)
  const others = friends.filter((f) => f.id !== ME_ID)
  return [me ?? meFriend('Me', 0), ...others]
}

export const friendsSchema: ZodType<Friend[]> = z.pipe(
  records(friendSchema, (f) => f.id, MAX_FRIENDS + 1),
  z.transform((friends: Friend[]) => withMe(friends)),
)

/* ------------------------------------------------------------------ expenses */

const participantShape = z.object({
  friendId: id,
  input: z.catch(z.nullable(z.number()), null),
})

const billItemShape: ZodType<BillItem> = z.object({
  id,
  name: z.string(),
  quantity: z.number(),
  amount: z.int(),
})

const billMetaShape = z.object({
  merchant: nullableText,
  date: nullableText,
  subtotal: nullableMinor,
  tax: nullableMinor,
  serviceCharge: nullableMinor,
  discount: nullableMinor,
  tip: nullableMinor,
  total: nullableMinor,
  fees: z.optional(z.unknown()),
})

const BILL_FEE_KIND_SET: ReadonlySet<unknown> = new Set(BILL_FEE_KINDS)

/**
 * A bill's delivery-app fees, cleaned: at most 15, unique ids, labels tidied to 40 characters
 * (blank → "Fee"), amounts whole and 1…MAX_MINOR, unknown kinds → 'other'. Bad entries are dropped.
 */
export function cleanBillFees(raw: unknown): BillFee[] {
  if (!Array.isArray(raw)) return []
  const out: BillFee[] = []
  const seen = new Set<string>()
  for (const fee of raw as unknown[]) {
    if (out.length >= MAX_BILL_FEES) break
    if (typeof fee !== 'object' || fee === null) continue
    const f = fee as Record<string, unknown>
    if (!isIdText(f.id) || seen.has(f.id)) continue
    if (!Number.isSafeInteger(f.amount) || (f.amount as number) < 1 || (f.amount as number) > MAX_MINOR) continue
    seen.add(f.id)
    out.push({
      id: f.id,
      kind: BILL_FEE_KIND_SET.has(f.kind) ? (f.kind as BillFeeKind) : 'other',
      label: (typeof f.label === 'string' ? cleanText(f.label, MAX_FEE_LABEL_LENGTH) : '') || 'Fee',
      amount: f.amount as number,
    })
  }
  return out
}

/** `'proportional' | 'equal'`, or undefined for anything else (older bills have none). */
function cleanFeeSplit(value: unknown): FeeSplit | undefined {
  return value === 'proportional' || value === 'equal' ? value : undefined
}

const billShape: ZodType<BillSnapshot> = z.pipe(
  z.object({
    meta: billMetaShape,
    items: z.array(billItemShape),
    assignments: z.record(z.string(), z.record(z.string(), z.number())),
    warnings: z.catch(z.array(z.string()), []),
    feeSplit: z.optional(z.unknown()),
  }),
  z.transform((b): BillSnapshot => {
    const { fees: rawFees, ...printed } = b.meta
    const fees = cleanBillFees(rawFees)
    const meta: BillMeta = fees.length > 0 ? { ...printed, fees } : printed
    const feeSplit = cleanFeeSplit(b.feeSplit)
    const bill: BillSnapshot = { meta, items: b.items, assignments: b.assignments, warnings: b.warnings }
    if (feeSplit !== undefined) bill.feeSplit = feeSplit
    return bill
  }),
)

/* ------------------------------------------------------------------ trip currency */

/**
 * A usable `fx` snapshot for an expense in `currency`, or null: the paid currency must be known
 * and differ from the expense's, the amount a valid total, the rate a positive decimal string
 * (`RATE_PATTERN`) and the source known. A malformed rate date becomes null.
 */
export function cleanFx(raw: unknown, currency: string): FxSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const fx = raw as Record<string, unknown>
  if (typeof fx.currency !== 'string' || !CURRENCY_CODE.test(fx.currency) || !isKnownCurrency(fx.currency) || fx.currency === currency) return null
  if (!isValidTotal(fx.amount) || !isValidRate(fx.rate) || !FX_SOURCE_SET.has(fx.source)) return null
  return {
    amount: fx.amount,
    currency: fx.currency,
    rate: fx.rate,
    rateDate: isIsoDate(fx.rateDate) ? fx.rateDate : null,
    source: fx.source as FxSnapshot['source'],
  }
}

/** Exactly one participant, and it isn't the payer: a 1:1 entry ("I lent Riya", "Sam paid my auto"). */
export function isOneToOne(e: Pick<Expense, 'participants' | 'payerId'>): boolean {
  const people = uniqueParticipants(e.participants)
  return people.length === 1 && people[0]?.friendId !== e.payerId
}

/**
 * The stored kind: 'loan' only for a 1:1 entry without a bill; 'bill' only with a snapshot;
 * anything else is a plain split (how older versions read a loan — balances stay right).
 */
export function cleanExpenseKind(kind: unknown, e: Pick<Expense, 'participants' | 'payerId' | 'bill'>): ExpenseKind {
  if (kind === 'loan') return !e.bill && isOneToOne(e) ? 'loan' : 'split'
  return kind === 'bill' && e.bill ? 'bill' : 'split'
}

function cleanParticipants(list: readonly Participant[]): Participant[] {
  return uniqueParticipants(list)
    .slice(0, MAX_PARTICIPANTS)
    .map((p) => ({ friendId: p.friendId, input: typeof p.input === 'number' && Number.isFinite(p.input) ? p.input : null }))
}

/** True when stored shares are whole, non-negative and add up to the total. */
function sharesAddUp(shares: Readonly<Record<string, number>>, total: number): boolean {
  let sum = 0
  for (const v of Object.values(shares)) {
    if (!Number.isSafeInteger(v) || v < 0) return false
    sum += v
  }
  return sum === total
}

/** Shares that are guaranteed to add up; falls back to an equal split when the inputs don't. */
export function settledShares(e: Pick<Expense, 'total' | 'currency' | 'mode' | 'participants' | 'payerId' | 'roundedToWhole' | 'bill'>): {
  shares: Record<string, number>
  mode: Expense['mode']
} {
  const shares = expenseShares(e)
  if (sharesAddUp(shares, e.total)) return { shares, mode: e.mode }
  return { shares: expenseShares({ ...e, mode: 'equal' }), mode: 'equal' }
}

const expenseShape = z.object({
  id,
  kind: z.catch(z.enum(EXPENSE_KINDS as readonly ExpenseKind[]), 'split'),
  title: z.catch(z.string(), ''),
  category,
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  total: z.int(),
  date: z.catch(z.string(), ''),
  createdAt: timestamp,
  updatedAt: timestamp,
  payerId: id,
  mode: z.enum(['equal', 'exact', 'percent', 'shares', 'items']),
  participants: z.array(participantShape),
  shares: z.catch(z.record(z.string(), z.number()), {}),
  roundedToWhole: z.catch(z.boolean(), false),
  note: nullableText,
  groupId: z.catch(z.nullable(id), null),
  bill: z.catch(z.nullable(billShape), null),
  paidBack: z.catch(z.record(z.string(), z.number()), {}),
  recurringId: z.catch(z.nullable(id), null),
  source: z.catch(z.enum(EXPENSE_SOURCES as readonly ExpenseSource[]), 'manual'),
  fx: z.optional(z.unknown()),
})

export const expenseSchema: ZodType<Expense> = repaired(expenseShape, (e) => {
  if (!isValidTotal(e.total)) return null
  const participants = cleanParticipants(e.participants)
  if (participants.length === 0) return null
  const createdAt = cleanTimestamp(e.createdAt)
  const mode = e.mode === 'items' && !e.bill ? 'equal' : e.mode
  const base = {
    total: e.total,
    currency: e.currency,
    mode,
    participants,
    payerId: e.payerId,
    roundedToWhole: e.roundedToWhole,
    bill: e.bill,
  }
  const fixed = sharesAddUp(e.shares, e.total) ? { shares: e.shares, mode } : settledShares(base)
  const paidBack: Record<string, number> = {}
  for (const [friendId, at] of Object.entries(e.paidBack)) {
    if (friendId !== e.payerId && (fixed.shares[friendId] ?? 0) > 0 && Number.isFinite(at)) paidBack[friendId] = at
  }
  const title = cleanText(e.title, MAX_TITLE_LENGTH)
  const note = e.note === null ? null : cleanMultiline(e.note, MAX_NOTE_LENGTH) || null
  const fx = cleanFx(e.fx, e.currency)
  const out: Expense = {
    id: e.id,
    kind: cleanExpenseKind(e.kind, { participants, payerId: e.payerId, bill: e.bill }),
    title: title || fallbackTitle(e.category),
    category: e.category,
    currency: e.currency,
    total: e.total,
    date: cleanDate(e.date, createdAt),
    createdAt,
    updatedAt: Math.max(cleanTimestamp(e.updatedAt), createdAt),
    payerId: e.payerId,
    mode: fixed.mode,
    participants,
    shares: { ...fixed.shares },
    roundedToWhole: e.roundedToWhole,
    note,
    groupId: e.groupId,
    bill: e.bill,
    paidBack,
    recurringId: e.recurringId,
    source: e.source,
  }
  // Stored only when set, so plain expenses (and everything saved before trip currency) keep their shape.
  if (fx) out.fx = fx
  return out
})

/* ------------------------------------------------------------------ expenses: the fast path */

// Checking 1,500 saved expenses with the schema above costs seconds on a budget phone. Records
// the app saved itself are already in the exact form the schema produces, so a direct check of
// that form lets them skip it; anything else (older formats, hand edits, damage) still goes
// through the schema and gets repaired or dropped. `isCanonicalExpense` must only ever say yes
// when `expenseSchema` would return an equal record — src/data/canonical.test.ts checks it.

const EXPENSE_KEYS: readonly (keyof Expense)[] = [
  'id',
  'kind',
  'title',
  'category',
  'currency',
  'total',
  'date',
  'createdAt',
  'updatedAt',
  'payerId',
  'mode',
  'participants',
  'shares',
  'roundedToWhole',
  'note',
  'groupId',
  'bill',
  'paidBack',
  'recurringId',
  'source',
]
const BILL_KEYS: readonly (keyof BillSnapshot)[] = ['meta', 'items', 'assignments', 'warnings']
const META_KEYS: readonly (keyof BillMeta)[] = ['merchant', 'date', 'subtotal', 'tax', 'serviceCharge', 'discount', 'tip', 'total']
const ITEM_KEYS: readonly (keyof BillItem)[] = ['id', 'name', 'quantity', 'amount']
const FEE_KEYS: readonly (keyof BillFee)[] = ['id', 'kind', 'label', 'amount']
const FX_KEYS: readonly (keyof FxSnapshot)[] = ['amount', 'currency', 'rate', 'rateDate', 'source']
const PARTICIPANT_KEYS: readonly (keyof Participant)[] = ['friendId', 'input']
const CATEGORY_SET: ReadonlySet<unknown> = new Set(CATEGORY_IDS)
const SOURCE_SET: ReadonlySet<unknown> = new Set(EXPENSE_SOURCES)
const FX_SOURCE_SET: ReadonlySet<unknown> = new Set(FX_SOURCES)
const MODE_SET: ReadonlySet<unknown> = new Set(['equal', 'exact', 'percent', 'shares', 'items'])
const CURRENCY_CODE = /^[A-Z]{3}$/

type Plain = Record<string, unknown>

/** A plain object (as JSON.parse makes them) with no `__proto__` key. */
function isPlain(value: unknown): value is Plain {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return (proto === Object.prototype || proto === null) && !Object.hasOwn(value, '__proto__')
}

/** A plain object with exactly `keys` (no more, none missing), plus `optional` when present. */
function hasExactly(value: unknown, keys: readonly string[], optional?: string): value is Plain {
  if (!isPlain(value)) return false
  const extra = optional !== undefined && Object.hasOwn(value, optional) ? 1 : 0
  if (Object.keys(value).length !== keys.length + extra) return false
  for (const key of keys) if (!Object.hasOwn(value, key)) return false
  return true
}

/** Fees exactly as `cleanBillFees` leaves them, and at least one (none is stored as no `fees` key). */
function isCanonicalFees(value: unknown): value is BillFee[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BILL_FEES) return false
  const seen = new Set<string>()
  for (const fee of value as unknown[]) {
    if (!hasExactly(fee, FEE_KEYS) || !isIdText(fee.id) || seen.has(fee.id)) return false
    seen.add(fee.id)
    if (!BILL_FEE_KIND_SET.has(fee.kind)) return false
    if (typeof fee.label !== 'string' || fee.label === '' || cleanText(fee.label, MAX_FEE_LABEL_LENGTH) !== fee.label) return false
    if (!Number.isSafeInteger(fee.amount) || (fee.amount as number) < 1 || (fee.amount as number) > MAX_MINOR) return false
  }
  return true
}

/** An `fx` snapshot exactly as `cleanFx` returns it for an expense in `currency`. */
function isCanonicalFx(value: unknown, currency: string): value is FxSnapshot {
  if (!hasExactly(value, FX_KEYS)) return false
  if (typeof value.currency !== 'string' || !CURRENCY_CODE.test(value.currency) || !isKnownCurrency(value.currency) || value.currency === currency) return false
  if (!isValidTotal(value.amount) || !isValidRate(value.rate) || !FX_SOURCE_SET.has(value.source)) return false
  return value.rateDate === null || isIsoDate(value.rateDate)
}

function isIdText(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 200
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** What `cleanTimestamp` keeps as it is: +0 or a positive whole number. */
function isCleanTimestamp(value: unknown): value is number {
  return typeof value === 'number' && (Object.is(value, 0) || (Number.isInteger(value) && value > 0))
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isPlain(value)) return false
  for (const key of Object.keys(value)) if (!isFiniteNumber(value[key])) return false
  return true
}

function isCanonicalBill(value: unknown): value is BillSnapshot {
  if (!hasExactly(value, BILL_KEYS, 'feeSplit')) return false
  const { meta, items, assignments, warnings } = value
  if (Object.hasOwn(value, 'feeSplit') && cleanFeeSplit(value.feeSplit) === undefined) return false
  if (!hasExactly(meta, META_KEYS, 'fees')) return false
  if (Object.hasOwn(meta, 'fees') && !isCanonicalFees(meta.fees)) return false
  for (const key of META_KEYS) {
    const v = meta[key]
    if (v === null) continue
    if (key === 'merchant' || key === 'date' ? typeof v !== 'string' : !Number.isSafeInteger(v)) return false
  }
  if (!Array.isArray(items)) return false
  for (const it of items) {
    if (!hasExactly(it, ITEM_KEYS)) return false
    if (!isIdText(it.id) || typeof it.name !== 'string' || !isFiniteNumber(it.quantity) || !Number.isSafeInteger(it.amount)) return false
  }
  if (!isPlain(assignments)) return false
  for (const key of Object.keys(assignments)) if (!isNumberRecord(assignments[key])) return false
  if (!Array.isArray(warnings)) return false
  for (const w of warnings) if (typeof w !== 'string') return false
  return true
}

/** True when `raw` is exactly what `expenseSchema` would return for it (so it can skip the schema). */
export function isCanonicalExpense(raw: unknown): raw is Expense {
  if (!hasExactly(raw, EXPENSE_KEYS, 'fx')) return false
  const e = raw
  if (!isIdText(e.id) || !isIdText(e.payerId)) return false
  if (typeof e.currency !== 'string' || !CURRENCY_CODE.test(e.currency)) return false
  if (!isValidTotal(e.total)) return false
  if (!CATEGORY_SET.has(e.category) || !SOURCE_SET.has(e.source) || !MODE_SET.has(e.mode)) return false
  if (typeof e.roundedToWhole !== 'boolean') return false
  if (e.groupId !== null && !isIdText(e.groupId)) return false
  if (e.recurringId !== null && !isIdText(e.recurringId)) return false
  if (!isCleanTimestamp(e.createdAt) || !isCleanTimestamp(e.updatedAt) || e.updatedAt < e.createdAt) return false
  if (!isIsoDate(e.date)) return false

  // Bills: `kind` is "split" without a snapshot, and item-by-item needs one. Trip currency: `fx`
  // is only stored when set.
  if (e.bill !== null && !isCanonicalBill(e.bill)) return false
  if (e.mode === 'items' && e.bill === null) return false
  if (Object.hasOwn(e, 'fx') && !isCanonicalFx(e.fx, e.currency)) return false

  // Text exactly as the cleaners leave it.
  if (typeof e.title !== 'string' || e.title === '' || cleanText(e.title, MAX_TITLE_LENGTH) !== e.title) return false
  if (e.note !== null && (typeof e.note !== 'string' || e.note === '' || cleanMultiline(e.note, MAX_NOTE_LENGTH) !== e.note)) return false

  // Participants: 1–100 different people, each input null or a finite number.
  const participants = e.participants
  if (!Array.isArray(participants) || participants.length === 0 || participants.length > MAX_PARTICIPANTS) return false
  const seen = new Set<string>()
  for (const p of participants) {
    if (!hasExactly(p, PARTICIPANT_KEYS) || !isIdText(p.friendId) || seen.has(p.friendId)) return false
    if (p.input !== null && !isFiniteNumber(p.input)) return false
    seen.add(p.friendId)
  }

  // Kind: a loan is 1:1 with no bill; a bill needs its snapshot.
  if (e.kind === 'loan') {
    if (e.bill !== null || participants.length !== 1 || (participants[0] as Plain).friendId === e.payerId) return false
  } else if (e.kind !== 'split' && !(e.kind === 'bill' && e.bill !== null)) return false

  // Shares that add up (so they're kept as they are), and paid-back ticks the schema keeps.
  const shares = e.shares
  if (!isNumberRecord(shares) || !sharesAddUp(shares, e.total)) return false
  if (!isNumberRecord(e.paidBack)) return false
  for (const friendId of Object.keys(e.paidBack)) {
    if (friendId === e.payerId || !((shares[friendId] ?? 0) > 0)) return false
  }
  return true
}

export const expensesSchema: ZodType<Expense[]> = records(expenseSchema, (e) => e.id, Number.POSITIVE_INFINITY, isCanonicalExpense)

/* ------------------------------------------------------------------ groups */

const settlementShape = z.object({
  id,
  fromId: id,
  toId: id,
  amount: z.int(),
  date: z.catch(z.string(), ''),
  createdAt: timestamp,
  method: z.catch(z.enum(['upi', 'cash', 'other']), 'other'),
})

export const settlementSchema: ZodType<Settlement> = repaired(settlementShape, (s) => {
  if (s.fromId === s.toId || s.amount <= 0 || s.amount > MAX_MINOR) return null
  const createdAt = cleanTimestamp(s.createdAt)
  return { ...s, createdAt, date: cleanDate(s.date, createdAt) }
})

/** Unique, non-empty ids with the owner first. */
export function cleanMemberIds(ids: readonly string[]): string[] {
  const out: string[] = [ME_ID]
  for (const memberId of ids) {
    if (typeof memberId !== 'string' || memberId === '' || out.includes(memberId)) continue
    out.push(memberId)
    if (out.length >= MAX_GROUP_MEMBERS) break
  }
  return out
}

const groupShape = z.object({
  id,
  name: z.catch(z.string(), ''),
  emoji: z.catch(z.string(), DEFAULT_GROUP_EMOJI),
  kind: z.catch(z.enum(GROUP_KINDS as readonly GroupKind[]), 'other'),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  memberIds: z.catch(z.array(z.string()), []),
  settlements: z.catch(records(settlementSchema, (s) => s.id), []),
  createdAt: timestamp,
  updatedAt: timestamp,
  archived: z.catch(z.boolean(), false),
  travelCurrency: nullableText,
  roundSize: nullableMinor,
})

/** A known currency other than the group's own, else null ("Spending in" the group's currency is no trip currency). */
export function cleanTravelCurrency(value: unknown, currency: string): string | null {
  return typeof value === 'string' && CURRENCY_CODE.test(value) && isKnownCurrency(value) && value !== currency ? value : null
}

export const groupSchema: ZodType<Group> = repaired(groupShape, (g) => {
  const createdAt = cleanTimestamp(g.createdAt)
  return {
    id: g.id,
    name: cleanText(g.name, MAX_GROUP_NAME_LENGTH) || 'Group',
    emoji: cleanEmoji(g.emoji),
    kind: g.kind,
    currency: g.currency,
    memberIds: cleanMemberIds(g.memberIds),
    settlements: g.settlements,
    createdAt,
    updatedAt: Math.max(cleanTimestamp(g.updatedAt), createdAt),
    archived: g.archived,
    travelCurrency: cleanTravelCurrency(g.travelCurrency, g.currency),
    roundSize: isValidTotal(g.roundSize) ? g.roundSize : null,
  }
})

export const groupsSchema: ZodType<Group[]> = records(groupSchema, (g) => g.id)

/* ------------------------------------------------------------------ recurring */

/** Due days run 1..28 so every month has one. */
export function cleanDayOfMonth(value: number): number {
  return Number.isFinite(value) ? Math.min(28, Math.max(1, Math.trunc(value))) : 1
}

const recurringShape = z.object({
  id,
  title: z.catch(z.string(), ''),
  category,
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  total: z.int(),
  payerId: id,
  mode: z.enum(['equal', 'exact', 'percent', 'shares']),
  participants: z.array(participantShape),
  dayOfMonth: z.catch(z.number(), 1),
  groupId: z.catch(z.nullable(id), null),
  lastCreatedPeriod: z.catch(z.nullable(z.string()), null),
  active: z.catch(z.boolean(), true),
  createdAt: timestamp,
})

export const recurringSchema: ZodType<RecurringTemplate> = repaired(recurringShape, (r) => {
  if (!isValidTotal(r.total)) return null
  const participants = cleanParticipants(r.participants)
  if (participants.length === 0) return null
  const title = cleanText(r.title, MAX_TITLE_LENGTH)
  return {
    ...r,
    title: title || fallbackTitle(r.category),
    participants,
    dayOfMonth: cleanDayOfMonth(r.dayOfMonth),
    lastCreatedPeriod: isPeriod(r.lastCreatedPeriod) ? r.lastCreatedPeriod : null,
    createdAt: cleanTimestamp(r.createdAt),
  }
})

export const recurringListSchema: ZodType<RecurringTemplate[]> = records(recurringSchema, (r) => r.id)

/* ------------------------------------------------------------------ claims (claim your items) */

function isWholeIn(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
}

/**
 * Claim picks: `item` an index below `itemCount`, `1 ≤ num ≤ den ≤ 99`; one pick per item (the
 * first wins). Anything else is dropped.
 */
export function cleanClaimPicks(raw: unknown, itemCount: number): ClaimPick[] {
  if (!Array.isArray(raw)) return []
  const out: ClaimPick[] = []
  const seen = new Set<number>()
  for (const pick of raw as unknown[]) {
    if (typeof pick !== 'object' || pick === null) continue
    const { item, num, den } = pick as Record<string, unknown>
    if (!isWholeIn(item, 0, itemCount - 1) || !isWholeIn(den, 1, MAX_CLAIM_DEN) || !isWholeIn(num, 1, den) || seen.has(item)) continue
    seen.add(item)
    out.push({ item, num, den })
  }
  return out
}

/** A decision the organiser can have made; null when it's malformed (or an `assign` with no valid weights). */
export function cleanClaimDecision(raw: unknown): ClaimDecision | null {
  if (typeof raw !== 'object' || raw === null) return null
  const d = raw as Record<string, unknown>
  if (d.kind === 'as_claimed' || d.kind === 'scale_up' || d.kind === 'rest_everyone') return { kind: d.kind }
  if (d.kind !== 'assign' || typeof d.shares !== 'object' || d.shares === null || Array.isArray(d.shares)) return null
  const shares: Record<string, number> = {}
  for (const [friendId, weight] of Object.entries(d.shares as Record<string, unknown>)) {
    if (isIdText(friendId) && isWholeIn(weight, 1, MAX_CLAIM_DEN)) shares[friendId] = weight
  }
  return Object.keys(shares).length > 0 ? { kind: 'assign', shares } : null
}

const claimReplyShape = z.object({
  id,
  personIndex: z.catch(z.nullable(z.int()), null),
  name: z.catch(z.string(), ''),
  friendId: id,
  picks: z.catch(z.array(z.unknown()), []),
  nothing: z.catch(z.boolean(), false),
  paid: nullableMinor,
  sentAt: timestamp,
  receivedAt: timestamp,
  state: z.catch(z.enum(['active', 'replaced']), 'active'),
})

/** Unique, non-empty id strings, at most `max` (`skip` left out). */
function cleanIdList(raw: readonly unknown[], max: number, skip?: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (out.length >= max) break
    if (!isIdText(value) || value === skip || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

const claimRoundShape = z.object({
  id,
  secret: z.string().check(z.regex(LINK_SECRET_PATTERN)),
  expenseId: id,
  itemIds: z.array(z.unknown()),
  itemsHash: z.string().check(z.regex(ITEMS_HASH_PATTERN)),
  peopleIds: z.array(z.unknown()),
  fixedItemIds: z.catch(z.array(z.unknown()), []),
  ownPicks: z.catch(z.array(z.unknown()), []),
  replies: z.catch(z.array(z.unknown()), []),
  decisions: z.catch(z.record(z.string(), z.unknown()), {}),
  createdAt: timestamp,
  updatedAt: timestamp,
  appliedAt: z.catch(z.nullable(z.number()), null),
})

/** Bill items one claim link can carry. */
export const MAX_CLAIM_ITEMS = 500

export const claimRoundSchema: ZodType<ClaimRound> = repaired(claimRoundShape, (r) => {
  // Picks point into `itemIds` and `peopleIds` by position, so a damaged list can't be repaired.
  const itemIds = cleanIdList(r.itemIds, MAX_CLAIM_ITEMS)
  const peopleIds = cleanIdList(r.peopleIds, MAX_PARTICIPANTS)
  if (itemIds.length === 0 || itemIds.length !== r.itemIds.length) return null
  if (peopleIds.length === 0 || peopleIds.length !== r.peopleIds.length) return null
  const items = new Set(itemIds)
  const replies: ClaimReply[] = []
  const seen = new Set<string>()
  for (const raw of r.replies) {
    if (replies.length >= MAX_CLAIM_REPLIES) break
    const parsed = z.safeParse(claimReplyShape, raw)
    if (!parsed.success || seen.has(parsed.data.id)) continue
    const reply = parsed.data
    seen.add(reply.id)
    replies.push({
      id: reply.id,
      personIndex: isWholeIn(reply.personIndex, 0, peopleIds.length - 1) ? reply.personIndex : null,
      name: normalizeName(reply.name) || 'Someone',
      friendId: reply.friendId,
      picks: cleanClaimPicks(reply.picks, itemIds.length),
      nothing: reply.nothing,
      paid: isValidTotal(reply.paid) ? reply.paid : null,
      sentAt: cleanTimestamp(reply.sentAt),
      receivedAt: cleanTimestamp(reply.receivedAt),
      state: reply.state,
    })
  }
  const decisions: Record<string, ClaimDecision> = {}
  for (const [itemId, raw] of Object.entries(r.decisions)) {
    const decision = items.has(itemId) ? cleanClaimDecision(raw) : null
    if (decision) decisions[itemId] = decision
  }
  const createdAt = cleanTimestamp(r.createdAt)
  return {
    id: r.id,
    secret: r.secret,
    expenseId: r.expenseId,
    itemIds,
    itemsHash: r.itemsHash,
    peopleIds,
    fixedItemIds: cleanIdList(r.fixedItemIds, MAX_CLAIM_ITEMS).filter((itemId) => items.has(itemId)),
    ownPicks: cleanClaimPicks(r.ownPicks, itemIds.length),
    replies,
    decisions,
    createdAt,
    updatedAt: Math.max(cleanTimestamp(r.updatedAt), createdAt),
    appliedAt: r.appliedAt === null ? null : cleanTimestamp(r.appliedAt) || null,
  }
})

export const claimRoundsSchema: ZodType<ClaimRound[]> = records(claimRoundSchema, (r) => r.id, MAX_CLAIM_ROUNDS)

/* ------------------------------------------------------------------ pools (collections) */

const contributionShape = z.object({
  id,
  friendId: z.catch(z.nullable(id), null),
  name: z.catch(z.string(), ''),
  amount: z.int(),
  date: z.catch(z.string(), ''),
  method: z.catch(z.enum(['upi', 'cash', 'other']), 'other'),
  via: z.catch(z.enum(['tick', 'reply']), 'tick'),
  replyId: z.catch(z.nullable(id), null),
  createdAt: timestamp,
})

export const contributionSchema: ZodType<Contribution> = repaired(contributionShape, (c) => {
  if (!isValidTotal(c.amount)) return null
  const createdAt = cleanTimestamp(c.createdAt)
  return {
    id: c.id,
    friendId: c.friendId === ME_ID ? null : c.friendId,
    name: cleanText(c.name, MAX_CONTRIBUTOR_NAME_LENGTH) || 'Someone',
    amount: c.amount,
    date: cleanDate(c.date, createdAt),
    method: c.method,
    via: c.via,
    replyId: c.via === 'reply' ? c.replyId : null,
    createdAt,
  }
})

/** A pool's emoji: the first character typed, else the occasion's. */
function cleanPoolEmoji(value: string, occasion: PoolOccasion): string {
  const first = graphemes(value.trim())[0]
  return first && /\S/u.test(first) ? first : POOL_OCCASION_DEFAULTS[occasion].emoji
}

const poolShape = z.object({
  id,
  title: z.catch(z.string(), ''),
  occasion: z.catch(z.enum(POOL_OCCASIONS as readonly PoolOccasion[]), 'other'),
  emoji: z.catch(z.string(), ''),
  currency: z.catch(z.string(), ''),
  mode: z.catch(z.enum(['fixed', 'target']), 'target'),
  perPerson: nullableMinor,
  target: nullableMinor,
  memberIds: z.catch(z.array(z.unknown()), []),
  expectedCount: z.catch(z.nullable(z.number()), null),
  deadline: nullableText,
  note: nullableText,
  showAmounts: z.catch(z.nullable(z.boolean()), null),
  contributions: z.catch(records(contributionSchema, (c) => c.id, MAX_POOL_CONTRIBUTIONS), []),
  secret: z.catch(z.string(), ''),
  createdAt: timestamp,
  updatedAt: timestamp,
  closedAt: z.catch(z.nullable(z.number()), null),
})

export const poolSchema: ZodType<Pool> = repaired(poolShape, (p) => {
  // "Same for everyone" needs an amount; without one the pool becomes "pay what you want".
  const fixed = p.mode === 'fixed' && isValidTotal(p.perPerson)
  const createdAt = cleanTimestamp(p.createdAt)
  return {
    id: p.id,
    title: cleanText(p.title, MAX_POOL_TITLE_LENGTH) || POOL_OCCASION_DEFAULTS[p.occasion].title,
    occasion: p.occasion,
    emoji: cleanPoolEmoji(p.emoji, p.occasion),
    currency: cleanCurrency(p.currency, defaultCurrency()),
    mode: fixed ? 'fixed' : 'target',
    perPerson: fixed ? p.perPerson : null,
    target: !fixed && isValidTotal(p.target) ? p.target : null,
    memberIds: cleanIdList(p.memberIds, MAX_POOL_MEMBERS, ME_ID),
    expectedCount: isWholeIn(p.expectedCount, 2, 500) ? p.expectedCount : null,
    deadline: isIsoDate(p.deadline) ? p.deadline : null,
    note: p.note === null ? null : cleanText(p.note, MAX_POOL_NOTE_LENGTH) || null,
    // Amounts given freely stay private unless the organiser says otherwise.
    showAmounts: p.showAmounts ?? fixed,
    contributions: p.contributions,
    secret: LINK_SECRET_PATTERN.test(p.secret) ? p.secret : randomB64u(16),
    createdAt,
    updatedAt: Math.max(cleanTimestamp(p.updatedAt), createdAt),
    closedAt: p.closedAt === null ? null : cleanTimestamp(p.closedAt) || null,
  }
})

export const poolsSchema: ZodType<Pool[]> = records(poolSchema, (p) => p.id, MAX_POOLS)
