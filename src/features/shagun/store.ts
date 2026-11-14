/**
 * The shagun book, kept on this phone: the functions (yours and other people's) and every envelope
 * written down at them. Names are tidied and kept in the spelling first used, so "sharma ji " joins
 * "Sharma ji". A big wedding is 500+ envelopes: adding is one append, and the book holds 10,000.
 */
import * as z from 'zod/mini'
import { cleanText, records } from '../../data/schemas'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import { nameKey, tidyName } from './engine'
import {
  MAX_FUNCTION_NAME,
  MAX_SHAGUN_GIFT,
  MAX_SHAGUN_NAME,
  MAX_SHAGUN_NOTE,
  SHAGUN_KINDS,
  type ShagunDirection,
  type ShagunEntry,
  type ShagunFunction,
  type ShagunKind,
} from './types'

export interface ShagunState {
  functions: ShagunFunction[]
  /** In the order written down. */
  entries: ShagunEntry[]
}

export const MAX_SHAGUN_FUNCTIONS = 300
export const MAX_SHAGUN_ENTRIES = 10_000

const isoDate = z.string().check(z.refine((value) => isIsoDate(value)))
const amount = z.int().check(z.minimum(0), z.maximum(MAX_MINOR))

const functionSchema: ZodType<ShagunFunction> = z.pipe(
  z.object({
    id: z.string().check(z.minLength(1), z.maxLength(200)),
    name: z.string(),
    kind: z.catch(z.enum(SHAGUN_KINDS as readonly ShagunKind[]), 'other'),
    date: isoDate,
    mine: z.catch(z.boolean(), false),
    at: z.catch(z.number(), 0),
  }),
  z.transform((fn, ctx) => {
    const name = cleanText(fn.name, MAX_FUNCTION_NAME)
    if (!name) {
      ctx.issues.push({ code: 'custom', message: 'No name', input: fn })
      return z.NEVER
    }
    return { ...fn, name }
  }),
)

const optionalText = (max: number) =>
  z.pipe(
    z.catch(z.nullable(z.string()), null),
    z.transform((value: string | null) => {
      const text = value === null ? '' : cleanText(value, max)
      return text ? text : null
    }),
  )

const entrySchema: ZodType<ShagunEntry> = z.pipe(
  z.object({
    id: z.string().check(z.minLength(1), z.maxLength(200)),
    name: z.string(),
    direction: z.enum(['received', 'given']),
    amount,
    gift: optionalText(MAX_SHAGUN_GIFT),
    functionId: z.catch(z.nullable(z.string()), null),
    date: isoDate,
    note: optionalText(MAX_SHAGUN_NOTE),
    at: z.catch(z.number(), 0),
  }),
  z.transform((entry, ctx) => {
    const name = tidyName(entry.name)
    if (!name || (entry.amount === 0 && entry.gift === null)) {
      ctx.issues.push({ code: 'custom', message: 'Unusable envelope', input: entry })
      return z.NEVER
    }
    return { ...entry, name }
  }),
)

/** What the app itself saved (skips the schema when loading thousands of envelopes). */
function isCanonicalEntry(raw: unknown): raw is ShagunEntry {
  if (typeof raw !== 'object' || raw === null) return false
  const e = raw as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    e.id.length > 0 &&
    e.id.length <= 200 &&
    typeof e.name === 'string' &&
    e.name.length > 0 &&
    e.name.length <= MAX_SHAGUN_NAME &&
    e.name === e.name.trim() &&
    !/\s{2}|[\p{Cc}\p{Cf}]/u.test(e.name) &&
    (e.direction === 'received' || e.direction === 'given') &&
    Number.isSafeInteger(e.amount) &&
    (e.amount as number) >= 0 &&
    (e.amount as number) <= MAX_MINOR &&
    (e.gift === null || (typeof e.gift === 'string' && e.gift.length > 0 && e.gift.length <= MAX_SHAGUN_GIFT && e.gift === cleanText(e.gift, MAX_SHAGUN_GIFT))) &&
    ((e.amount as number) > 0 || e.gift !== null) &&
    (e.functionId === null || typeof e.functionId === 'string') &&
    isIsoDate(e.date) &&
    (e.note === null || (typeof e.note === 'string' && e.note.length > 0 && e.note === cleanText(e.note, MAX_SHAGUN_NOTE))) &&
    typeof e.at === 'number' &&
    Number.isFinite(e.at) &&
    Object.keys(e).length === 9
  )
}

export const shagunSchema = z.object({
  functions: z.catch(
    records(functionSchema, (fn) => fn.id, MAX_SHAGUN_FUNCTIONS),
    [],
  ),
  entries: z.catch(
    records(entrySchema, (e) => e.id, MAX_SHAGUN_ENTRIES, isCanonicalEntry),
    [],
  ),
})

export const shagunStore = createStore<ShagunState>({
  key: STORAGE_KEYS.shagun,
  schema: shagunSchema,
  initial: () => ({ functions: [], entries: [] }),
  version: 1,
})

/* ------------------------------------------------------------------ reading */

export function useShagunBook(): ShagunState {
  return useStore(shagunStore, (state) => state)
}

/* ------------------------------------------------------------------ functions */

export interface FunctionInput {
  name: string
  kind: ShagunKind
  date: string
  mine: boolean
}

/** Adds a function; null when the name is empty, the date isn't one, or the book has 300 already. */
export function addFunction(input: FunctionInput, now: number = Date.now()): ShagunFunction | null {
  const name = cleanText(input.name, MAX_FUNCTION_NAME)
  if (!name || !isIsoDate(input.date)) return null
  const state = shagunStore.get()
  if (state.functions.length >= MAX_SHAGUN_FUNCTIONS) return null
  const fn: ShagunFunction = { id: newId(), name, kind: SHAGUN_KINDS.includes(input.kind) ? input.kind : 'other', date: input.date, mine: input.mine, at: now }
  shagunStore.set({ ...state, functions: [...state.functions, fn] })
  return fn
}

/** Changes a function's name, kind, date or whose it is. False when nothing usable changed. */
export function updateFunction(id: string, patch: Partial<FunctionInput>): boolean {
  const state = shagunStore.get()
  const fn = state.functions.find((f) => f.id === id)
  if (!fn) return false
  const name = patch.name === undefined ? fn.name : cleanText(patch.name, MAX_FUNCTION_NAME)
  const date = patch.date === undefined ? fn.date : patch.date
  if (!name || !isIsoDate(date)) return false
  const next: ShagunFunction = {
    ...fn,
    name,
    date,
    kind: patch.kind && SHAGUN_KINDS.includes(patch.kind) ? patch.kind : fn.kind,
    mine: patch.mine ?? fn.mine,
  }
  shagunStore.set({ ...state, functions: state.functions.map((f) => (f.id === id ? next : f)) })
  return true
}

/**
 * Takes a function out of the book, with every envelope written down at it. Returns what was
 * removed (for Undo with `restoreFunction`), or null.
 */
export function deleteFunction(id: string): { fn: ShagunFunction; entries: ShagunEntry[] } | null {
  const state = shagunStore.get()
  const fn = state.functions.find((f) => f.id === id)
  if (!fn) return null
  const entries = state.entries.filter((e) => e.functionId === id)
  shagunStore.set({ functions: state.functions.filter((f) => f.id !== id), entries: state.entries.filter((e) => e.functionId !== id) })
  return { fn, entries }
}

/** Puts a deleted function (and its envelopes) back. */
export function restoreFunction(removed: { fn: ShagunFunction; entries: readonly ShagunEntry[] }): void {
  const state = shagunStore.get()
  const functions = state.functions.some((f) => f.id === removed.fn.id) ? state.functions : [...state.functions, removed.fn]
  shagunStore.set({ functions, entries: mergeEntries(state.entries, removed.entries) })
}

/* ------------------------------------------------------------------ entries */

export interface EntryInput {
  name: string
  direction: ShagunDirection
  /** Paise. */
  amount: number
  gift?: string | null
  functionId?: string | null
  date: string
  note?: string | null
}

/** The spelling already in the book for this name (first written wins), or the tidied name. */
export function bookSpelling(entries: readonly ShagunEntry[], raw: string): string {
  const name = tidyName(raw)
  const key = name.toLowerCase()
  for (const e of entries) if (nameKey(e.name) === key) return e.name
  return name
}

function cleanEntry(input: EntryInput, entries: readonly ShagunEntry[]): Omit<ShagunEntry, 'id' | 'at'> | null {
  const name = bookSpelling(entries, input.name)
  const amountOk = Number.isSafeInteger(input.amount) && input.amount >= 0 && input.amount <= MAX_MINOR
  const gift = input.gift ? cleanText(input.gift, MAX_SHAGUN_GIFT) || null : null
  const note = input.note ? cleanText(input.note, MAX_SHAGUN_NOTE) || null : null
  if (!name || !amountOk || !isIsoDate(input.date)) return null
  if (input.amount === 0 && gift === null) return null
  if (input.direction !== 'received' && input.direction !== 'given') return null
  return { name, direction: input.direction, amount: input.amount, gift, functionId: input.functionId ?? null, date: input.date, note }
}

/** Writes an envelope down; null when there's no name, no money or gift, or the book is full. */
export function addEntry(input: EntryInput, now: number = Date.now()): ShagunEntry | null {
  const state = shagunStore.get()
  if (state.entries.length >= MAX_SHAGUN_ENTRIES) return null
  const clean = cleanEntry(input, state.entries)
  if (!clean) return null
  const entry: ShagunEntry = { id: newId(), ...clean, at: now }
  shagunStore.set({ ...state, entries: [...state.entries, entry] })
  return entry
}

/** Changes an envelope. False when it's gone or the change isn't usable. */
export function updateEntry(id: string, input: EntryInput): boolean {
  const state = shagunStore.get()
  const old = state.entries.find((e) => e.id === id)
  if (!old) return false
  const clean = cleanEntry(
    input,
    state.entries.filter((e) => e.id !== id),
  )
  if (!clean) return false
  shagunStore.set({ ...state, entries: state.entries.map((e) => (e.id === id ? { ...old, ...clean } : e)) })
  return true
}

/** Adds `amount` paise to an envelope already written down ("add to the earlier ₹501"). Returns the old amount, or null. */
export function addToEntry(id: string, amount: number): number | null {
  const state = shagunStore.get()
  const old = state.entries.find((e) => e.id === id)
  if (!old || !Number.isSafeInteger(amount) || amount <= 0 || old.amount + amount > MAX_MINOR) return null
  shagunStore.set({ ...state, entries: state.entries.map((e) => (e.id === id ? { ...e, amount: e.amount + amount } : e)) })
  return old.amount
}

/** Sets an envelope's amount back (Undo of `addToEntry`). */
export function setEntryAmount(id: string, amount: number): void {
  const state = shagunStore.get()
  if (!Number.isSafeInteger(amount) || amount < 0) return
  shagunStore.set({ ...state, entries: state.entries.map((e) => (e.id === id && (amount > 0 || e.gift !== null) ? { ...e, amount } : e)) })
}

/** Removes an envelope; returns it (for Undo with `restoreEntries`), or null. */
export function deleteEntry(id: string): ShagunEntry | null {
  const state = shagunStore.get()
  const entry = state.entries.find((e) => e.id === id)
  if (!entry) return null
  shagunStore.set({ ...state, entries: state.entries.filter((e) => e.id !== id) })
  return entry
}

/** Puts removed envelopes back (skipping any still there). */
export function restoreEntries(entries: readonly ShagunEntry[]): void {
  const state = shagunStore.get()
  shagunStore.set({ ...state, entries: mergeEntries(state.entries, entries) })
}

function mergeEntries(current: readonly ShagunEntry[], back: readonly ShagunEntry[]): ShagunEntry[] {
  const have = new Set(current.map((e) => e.id))
  const add = back.filter((e) => !have.has(e.id)).slice(0, Math.max(0, MAX_SHAGUN_ENTRIES - current.length))
  return [...current, ...add]
}
