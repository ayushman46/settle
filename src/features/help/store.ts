/**
 * The people who work at your home, kept on this phone: salary, pay day, who shares the cost,
 * what happened each month and which months are paid. Shared money is never kept here: an
 * advance or a salary that flatmates split becomes a real expense in the app.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { ME_ID } from '../../domain/types'
import { isIsoDate, isPeriod } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { cleanText } from '../../share/text'
import {
  DEFAULT_PAID_LEAVE,
  DEFAULT_PAY_DAY,
  HELP_ENTRY_KINDS,
  HELP_WORKS,
  MAX_PAID_LEAVE,
  MAX_PARTS,
  type HelpEntry,
  type HelpEntryKind,
  type HelpPayment,
  type HelpRaise,
  type HelpSharer,
  type HelpWork,
  type Helper,
} from './engine'

export interface HelpState {
  helpers: Helper[]
}

export const MAX_HELPERS = 40
export const MAX_ENTRIES = 3000
export const MAX_PAYMENTS = 600
export const MAX_RAISES = 60
export const MAX_SHARERS = 20
export const MAX_HELP_NAME = 40
export const MAX_HELP_NOTE = 80

const id = z.string().check(z.minLength(1), z.maxLength(80))
const isoDate = z.string().check(z.refine(isIsoDate))
const period = z.string().check(z.refine(isPeriod))
const money = z.int().check(z.gte(0), z.lte(MAX_MINOR))
const positive = z.int().check(z.gt(0), z.lte(MAX_MINOR))
const stamp = z.int().check(z.gte(0))

const entrySchema = z.object({
  id,
  kind: z.enum(HELP_ENTRY_KINDS),
  date: isoDate,
  amount: money,
  note: z.catch(z.nullable(z.string().check(z.maxLength(MAX_HELP_NOTE * 4))), null),
  byId: z.catch(id, ME_ID),
  expenseId: z.catch(z.nullable(id), null),
  at: stamp,
})

const paymentSchema = z.object({
  period,
  paidOn: isoDate,
  at: stamp,
  payerId: z.catch(id, ME_ID),
  method: z.catch(z.enum(['upi', 'cash']), 'cash'),
  salary: money,
  daysOff: z.catch(z.int().check(z.gte(0), z.lte(31)), 0),
  leaveCut: money,
  extra: money,
  bonus: money,
  advanceCut: money,
  amount: money,
  expenseId: z.catch(z.nullable(id), null),
})

const raiseSchema = z.object({ from: period, salary: positive })
const sharerSchema = z.object({ friendId: id, parts: z.catch(z.int().check(z.gte(1), z.lte(MAX_PARTS)), 1) })

/** Reads each item of a list on its own: one that makes no sense is dropped, never the list. */
function each<T>(schema: z.core.$ZodType<T>, keep: (item: T) => boolean = () => true) {
  return z.pipe(
    z.catch(z.array(z.unknown()), []),
    z.transform((raw: unknown[]) => {
      const out: T[] = []
      for (const value of raw) {
        const parsed = z.safeParse(schema, value)
        if (parsed.success && keep(parsed.data)) out.push(parsed.data)
      }
      return out
    }),
  )
}

const cutsSchema = z.pipe(
  z.catch(z.record(z.string(), z.unknown()), {}),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (isPeriod(key) && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_MINOR) out[key] = value
    }
    return out
  }),
)

const helperSchema = z.object({
  id,
  name: z.string().check(z.minLength(1), z.maxLength(MAX_HELP_NAME * 4)),
  work: z.catch(z.enum(HELP_WORKS), 'other'),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  salary: positive,
  raises: each(raiseSchema),
  payDay: z.catch(z.int().check(z.gte(1), z.lte(31)), DEFAULT_PAY_DAY),
  sharers: each(sharerSchema),
  groupId: z.catch(z.nullable(id), null),
  upi: z.catch(z.nullable(z.string().check(z.minLength(1), z.maxLength(300))), null),
  paidLeave: z.catch(z.int().check(z.gte(0), z.lte(MAX_PAID_LEAVE)), DEFAULT_PAID_LEAVE),
  cutPay: z.catch(z.boolean(), false),
  startedOn: isoDate,
  entries: each(entrySchema),
  payments: each(paymentSchema),
  cuts: cutsSchema,
  createdAt: stamp,
})

function firstOfEach<T>(list: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of list) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** One person, made consistent: one payment a month, one raise a month, each sharer once, somebody always bears the cost. */
function tidy(raw: z.infer<typeof helperSchema>): Helper {
  const sharers = firstOfEach(raw.sharers, (s) => s.friendId).slice(0, MAX_SHARERS)
  const entries = firstOfEach(raw.entries, (e) => e.id)
    // A day off has no amount; anything else needs one.
    .filter((e) => (e.kind === 'dayOff' ? true : e.amount > 0))
    .map((e) => (e.kind === 'dayOff' ? { ...e, amount: 0 } : e))
  return {
    ...raw,
    sharers: sharers.length > 0 ? sharers : [{ friendId: ME_ID, parts: 1 }],
    raises: firstOfEach(raw.raises, (r) => r.from)
      .sort((a, b) => (a.from < b.from ? -1 : 1))
      .slice(-MAX_RAISES),
    entries: entries.length > MAX_ENTRIES ? entries.slice().sort((a, b) => a.at - b.at).slice(-MAX_ENTRIES) : entries,
    payments: firstOfEach(raw.payments, (p) => p.period)
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .slice(-MAX_PAYMENTS),
  }
}

const helpersSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: Helper[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(helperSchema, value)
      if (!parsed.success || seen.has(parsed.data.id)) continue
      seen.add(parsed.data.id)
      read.push(tidy(parsed.data))
    }
    return read.slice(0, MAX_HELPERS)
  }),
)

export const helpSchema = z.object({ helpers: z.catch(helpersSchema, []) })

export const helpStore = createStore<HelpState>({
  key: STORAGE_KEYS.help,
  schema: helpSchema,
  initial: () => ({ helpers: [] }),
  version: 1,
})

export function useHelpers(): Helper[] {
  return useStore(helpStore, (state) => state.helpers)
}

export function useHelper(helperId: string | null | undefined): Helper | null {
  return useStore(helpStore, (state) => (helperId ? (state.helpers.find((h) => h.id === helperId) ?? null) : null))
}

export function helperById(helperId: string): Helper | null {
  return helpStore.get().helpers.find((h) => h.id === helperId) ?? null
}

/* ------------------------------------------------------------------ people */

/** A UPI ID or a mobile number as typed, tidied; null when it is neither. */
export function cleanUpi(value: string | null | undefined): string | null {
  const text = (value ?? '').trim()
  if (!text) return null
  if (isValidUpiId(text)) return normalizeUpiId(text)
  const digits = text.replace(/[\s()+-]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  return /^[6-9]\d{9}$/.test(local) ? local : null
}

export interface HelperInput {
  name: string
  work: HelpWork
  salary: number
  currency: string
  payDay?: number
  sharers?: readonly HelpSharer[]
  groupId?: string | null
  upi?: string | null
  paidLeave?: number
  cutPay?: boolean
}

function cleanSharers(sharers: readonly HelpSharer[] | undefined): HelpSharer[] {
  const list = firstOfEach(sharers ?? [], (s) => s.friendId)
    .filter((s) => s.friendId.length > 0)
    .slice(0, MAX_SHARERS)
    .map((s) => ({ friendId: s.friendId, parts: Number.isInteger(s.parts) && s.parts >= 1 ? Math.min(MAX_PARTS, s.parts) : 1 }))
  return list.length > 0 ? list : [{ friendId: ME_ID, parts: 1 }]
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback
}

/** Adds a person. Null when the name or the salary is missing, or the list is full. */
export function addHelper(input: HelperInput, today: string, now: number = Date.now()): Helper | null {
  const name = cleanText(input.name, MAX_HELP_NAME)
  const state = helpStore.get()
  if (!name || !Number.isSafeInteger(input.salary) || input.salary <= 0 || input.salary > MAX_MINOR) return null
  if (!isIsoDate(today) || state.helpers.length >= MAX_HELPERS) return null
  const sharers = cleanSharers(input.sharers)
  const helper: Helper = {
    id: newId(),
    name,
    work: HELP_WORKS.includes(input.work) ? input.work : 'other',
    currency: /^[A-Z]{3}$/.test(input.currency) ? input.currency : 'INR',
    salary: input.salary,
    raises: [],
    payDay: clampInt(input.payDay, 1, 31, DEFAULT_PAY_DAY),
    sharers,
    groupId: sharers.length > 1 ? (input.groupId ?? null) : null,
    upi: cleanUpi(input.upi),
    paidLeave: clampInt(input.paidLeave, 0, MAX_PAID_LEAVE, DEFAULT_PAID_LEAVE),
    cutPay: input.cutPay === true,
    startedOn: today,
    entries: [],
    payments: [],
    cuts: {},
    createdAt: now,
  }
  helpStore.set({ ...state, helpers: [...state.helpers, helper] })
  return helper
}

export type HelperPatch = Partial<Pick<HelperInput, 'name' | 'work' | 'payDay' | 'sharers' | 'groupId' | 'upi' | 'paidLeave' | 'cutPay'>>

/** Changes a person's details (never the salary: that is a raise). Returns them as they were, for Undo; null when nothing was saved. */
export function updateHelper(helperId: string, patch: HelperPatch): Helper | null {
  const before = helperById(helperId)
  if (!before) return null
  const name = patch.name === undefined ? before.name : cleanText(patch.name, MAX_HELP_NAME)
  if (!name) return null
  const sharers = patch.sharers === undefined ? before.sharers : cleanSharers(patch.sharers)
  const groupId = patch.groupId === undefined ? before.groupId : patch.groupId
  const next: Helper = {
    ...before,
    name,
    work: patch.work !== undefined && HELP_WORKS.includes(patch.work) ? patch.work : before.work,
    payDay: clampInt(patch.payDay, 1, 31, before.payDay),
    sharers,
    groupId: sharers.length > 1 ? groupId : null,
    upi: patch.upi === undefined ? before.upi : cleanUpi(patch.upi),
    paidLeave: clampInt(patch.paidLeave, 0, MAX_PAID_LEAVE, before.paidLeave),
    cutPay: patch.cutPay === undefined ? before.cutPay : patch.cutPay,
  }
  replaceHelper(next)
  return before
}

/** Swaps a person for a changed copy of themselves. Nothing happens when they are no longer there. */
export function replaceHelper(helper: Helper): void {
  const state = helpStore.get()
  if (!state.helpers.some((h) => h.id === helper.id)) return
  helpStore.set({ ...state, helpers: state.helpers.map((h) => (h.id === helper.id ? helper : h)) })
}

/** Removes a person and their months from this list (expenses already made stay). Returns them, for Undo. */
export function removeHelper(helperId: string): Helper | null {
  const state = helpStore.get()
  const helper = state.helpers.find((h) => h.id === helperId) ?? null
  if (!helper) return null
  helpStore.set({ ...state, helpers: state.helpers.filter((h) => h.id !== helperId) })
  return helper
}

/** Puts back a person who was removed, in their old place. */
export function putHelper(helper: Helper): void {
  const parsed = z.safeParse(helperSchema, helper)
  if (!parsed.success) return
  const state = helpStore.get()
  const rest = state.helpers.filter((h) => h.id !== helper.id)
  if (rest.length >= MAX_HELPERS) return
  helpStore.set({ ...state, helpers: [...rest, tidy(parsed.data)].sort((a, b) => a.createdAt - b.createdAt) })
}

/* ------------------------------------------------------------------ through the month */

export interface EntryInput {
  kind: HelpEntryKind
  date: string
  /** Paise; ignored for a day off. */
  amount?: number
  note?: string | null
  /** An advance: who handed it over. Default you. */
  byId?: string
}

export type EntryIssue = 'gone' | 'date' | 'amount' | 'paid' | 'twice'

/** Why an entry cannot be written down, or null when it can. A paid month is closed; a day off is written once. */
export function entryIssue(helper: Helper | null, input: EntryInput): EntryIssue | null {
  if (!helper) return 'gone'
  if (!HELP_ENTRY_KINDS.includes(input.kind) || !isIsoDate(input.date)) return 'date'
  if (helper.payments.some((p) => p.period === input.date.slice(0, 7))) return 'paid'
  if (input.kind === 'dayOff') return helper.entries.some((e) => e.kind === 'dayOff' && e.date === input.date) ? 'twice' : null
  const amount = input.amount ?? 0
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_MINOR ? null : 'amount'
}

/** Writes down an advance, a day off, extra work or a bonus. Null when it cannot be (see `entryIssue`). */
export function addEntry(helperId: string, input: EntryInput, now: number = Date.now()): HelpEntry | null {
  const helper = helperById(helperId)
  if (!helper || entryIssue(helper, input) !== null || helper.entries.length >= MAX_ENTRIES) return null
  const entry: HelpEntry = {
    id: newId(),
    kind: input.kind,
    date: input.date,
    amount: input.kind === 'dayOff' ? 0 : (input.amount ?? 0),
    note: cleanText(input.note ?? '', MAX_HELP_NOTE) || null,
    byId: input.byId || ME_ID,
    expenseId: null,
    at: now,
  }
  replaceHelper({ ...helper, entries: [...helper.entries, entry] })
  return entry
}

/** Takes an entry off. Returns it, for Undo. */
export function removeEntry(helperId: string, entryId: string): HelpEntry | null {
  const helper = helperById(helperId)
  const entry = helper?.entries.find((e) => e.id === entryId) ?? null
  if (!helper || !entry) return null
  replaceHelper({ ...helper, entries: helper.entries.filter((e) => e.id !== entryId) })
  return entry
}

/** Puts an entry back exactly as it was. */
export function putEntry(helperId: string, entry: HelpEntry): void {
  const helper = helperById(helperId)
  if (!helper || helper.entries.some((e) => e.id === entry.id)) return
  replaceHelper({ ...helper, entries: [...helper.entries, entry].sort((a, b) => a.at - b.at) })
}

/** Remembers the expense an advance became (or forgets it). */
export function setEntryExpense(helperId: string, entryId: string, expenseId: string | null): void {
  const helper = helperById(helperId)
  if (!helper) return
  replaceHelper({ ...helper, entries: helper.entries.map((e) => (e.id === entryId ? { ...e, expenseId } : e)) })
}

/* ------------------------------------------------------------------ raises, cuts, payments */

/** A new salary from a month onward (a raise in the same month replaces it). Returns the raises as they were, for Undo. */
export function setRaise(helperId: string, from: string, salary: number): HelpRaise[] | null {
  const helper = helperById(helperId)
  if (!helper || !isPeriod(from) || !Number.isSafeInteger(salary) || salary <= 0 || salary > MAX_MINOR) return null
  const raises = [...helper.raises.filter((r) => r.from !== from), { from, salary }].sort((a, b) => (a.from < b.from ? -1 : 1)).slice(-MAX_RAISES)
  replaceHelper({ ...helper, raises })
  return helper.raises
}

/** Puts the raises back as they were. */
export function putRaises(helperId: string, raises: HelpRaise[]): void {
  const helper = helperById(helperId)
  if (helper) replaceHelper({ ...helper, raises })
}

/** How much of the open advance to cut in a month; null goes back to "as much as the pay covers". Returns the old choice (null = none). */
export function setCut(helperId: string, month: string, amount: number | null): number | null {
  const helper = helperById(helperId)
  if (!helper || !isPeriod(month)) return null
  const cuts = { ...helper.cuts }
  const before = cuts[month] ?? null
  if (amount === null || !Number.isSafeInteger(amount) || amount < 0) delete cuts[month]
  else cuts[month] = Math.min(amount, MAX_MINOR)
  replaceHelper({ ...helper, cuts })
  return before
}

/** Marks a month paid with the numbers it was paid on. False when that month is already paid. */
export function putPayment(helperId: string, payment: HelpPayment): boolean {
  const helper = helperById(helperId)
  if (!helper || helper.payments.some((p) => p.period === payment.period)) return false
  if (!z.safeParse(paymentSchema, payment).success) return false
  replaceHelper({ ...helper, payments: [...helper.payments, payment].sort((a, b) => (a.period < b.period ? -1 : 1)).slice(-MAX_PAYMENTS) })
  return true
}

/** Takes a month's payment off. Returns it, for Undo. */
export function removePayment(helperId: string, month: string): HelpPayment | null {
  const helper = helperById(helperId)
  const payment = helper?.payments.find((p) => p.period === month) ?? null
  if (!helper || !payment) return null
  replaceHelper({ ...helper, payments: helper.payments.filter((p) => p.period !== month) })
  return payment
}

/** Remembers the expense a month's payment became (or forgets it). */
export function setPaymentExpense(helperId: string, month: string, expenseId: string | null): void {
  const helper = helperById(helperId)
  if (!helper) return
  replaceHelper({ ...helper, payments: helper.payments.map((p) => (p.period === month ? { ...p, expenseId } : p)) })
}
