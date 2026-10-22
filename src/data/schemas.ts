/**
 * What may be loaded from storage or a backup file. Shapes are checked with zod, then each
 * record is repaired (names tidied, invalid UPI IDs dropped, shares recomputed if they don't add
 * up). Lists drop bad records one at a time — one corrupt expense never costs you the rest.
 */
import * as z from 'zod/mini'
import {
  CATEGORY_IDS,
  ME_ID,
  type BillSnapshot,
  type CategoryId,
  type Expense,
  type ExpenseSource,
  type Friend,
  type Group,
  type GroupKind,
  type Participant,
  type Profile,
  type RecurringTemplate,
  type Settlement,
} from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import { isIsoDate, isPeriod, toIsoDate, today } from '../engine/dates'
import { expenseShares, isValidTotal, uniqueParticipants } from '../engine/split'
import { defaultCurrency, isKnownCurrency } from '../lib/currencies'
import { MAX_MINOR } from '../lib/money'
import { graphemes, normalizeName } from '../lib/people'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import { AVATAR_COLORS, type BillItem, type BillMeta } from '../types'
import type { ZodType } from './store'

/* ------------------------------------------------------------------ limits */

export const MAX_FRIENDS = 200
export const MAX_TITLE_LENGTH = 80
export const MAX_NOTE_LENGTH = 500
export const MAX_GROUP_NAME_LENGTH = 40
export const MAX_PARTICIPANTS = 100
export const MAX_GROUP_MEMBERS = 100

export const GROUP_KINDS: readonly GroupKind[] = ['trip', 'home', 'couple', 'event', 'other']
export const EXPENSE_SOURCES: readonly ExpenseSource[] = ['manual', 'scan', 'describe', 'sample', 'recurring']
export const DEFAULT_GROUP_EMOJI = '👥'

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
  }
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

const billMetaShape: ZodType<BillMeta> = z.object({
  merchant: nullableText,
  date: nullableText,
  subtotal: nullableMinor,
  tax: nullableMinor,
  serviceCharge: nullableMinor,
  discount: nullableMinor,
  tip: nullableMinor,
  total: nullableMinor,
})

const billShape: ZodType<BillSnapshot> = z.object({
  meta: billMetaShape,
  items: z.array(billItemShape),
  assignments: z.record(z.string(), z.record(z.string(), z.number())),
  warnings: z.catch(z.array(z.string()), []),
})

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
  kind: z.catch(z.enum(['split', 'bill']), 'split'),
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
  return {
    id: e.id,
    kind: e.bill ? e.kind : 'split',
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
const PARTICIPANT_KEYS: readonly (keyof Participant)[] = ['friendId', 'input']
const CATEGORY_SET: ReadonlySet<unknown> = new Set(CATEGORY_IDS)
const SOURCE_SET: ReadonlySet<unknown> = new Set(EXPENSE_SOURCES)
const MODE_SET: ReadonlySet<unknown> = new Set(['equal', 'exact', 'percent', 'shares', 'items'])
const CURRENCY_CODE = /^[A-Z]{3}$/

type Plain = Record<string, unknown>

/** A plain object (as JSON.parse makes them) with no `__proto__` key. */
function isPlain(value: unknown): value is Plain {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return (proto === Object.prototype || proto === null) && !Object.hasOwn(value, '__proto__')
}

/** A plain object with exactly `keys` (no more, none missing). */
function hasExactly(value: unknown, keys: readonly string[]): value is Plain {
  if (!isPlain(value)) return false
  if (Object.keys(value).length !== keys.length) return false
  for (const key of keys) if (!Object.hasOwn(value, key)) return false
  return true
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
  if (!hasExactly(value, BILL_KEYS)) return false
  const { meta, items, assignments, warnings } = value
  if (!hasExactly(meta, META_KEYS)) return false
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
  if (!hasExactly(raw, EXPENSE_KEYS)) return false
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

  // Bills: `kind` is "split" without a snapshot, and item-by-item needs one.
  if (e.bill !== null && !isCanonicalBill(e.bill)) return false
  if (e.kind !== 'split' && !(e.kind === 'bill' && e.bill !== null)) return false
  if (e.mode === 'items' && e.bill === null) return false

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
})

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
