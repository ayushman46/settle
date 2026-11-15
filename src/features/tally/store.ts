/**
 * The tallies kept on this phone. Each tally holds its own rates, its usual, the days that differ
 * from the usual, and which months are closed. Anything unreadable is dropped on load; a tally
 * that cannot be repaired goes, the rest stay.
 */
import * as z from 'zod/mini'
import { cleanCurrency, cleanText, cleanUpiId, records } from '../../data/schemas'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate, isPeriod } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import { mobileOf } from '../../lib/upiGuess'
import {
  keysOf,
  lockedThrough,
  MAX_DAY_UNITS,
  Q,
  SHARED,
  TALLY_UNITS,
  usualOn,
  type RateStep,
  type Tally,
  type TallyMonth,
  type TallySplit,
  type TallyUnit,
  type TallyVendor,
  type UsualStep,
} from './engine'

export interface TallyState {
  tallies: Tally[]
}

export const MAX_TALLIES = 60
export const MAX_TALLY_NAME = 30
export const MAX_TALLY_MEMBERS = 30
export const MAX_VENDOR_NAME = 40
const MAX_STEPS = 200
const MAX_DAYS = 4000
const MAX_COUNT = MAX_DAY_UNITS * Q

/* ------------------------------------------------------------------ reading what was saved */

const isRecord = (raw: unknown): raw is Record<string, unknown> => typeof raw === 'object' && raw !== null && !Array.isArray(raw)
const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_COUNT
const isRate = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_MINOR
const stamp = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)

function readCounts(raw: unknown, keys: ReadonlySet<string>): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(raw)) return out
  for (const [key, n] of Object.entries(raw)) if (keys.has(key) && isCount(n)) out[key] = n
  return out
}

/** Cleans a vendor: a name is needed; a UPI ID or a ten-digit number is kept when it is one. */
export function cleanVendor(raw: unknown): TallyVendor | null {
  if (!isRecord(raw) || typeof raw.name !== 'string') return null
  const name = cleanText(raw.name, MAX_VENDOR_NAME)
  if (!name) return null
  return { name, upiId: typeof raw.upiId === 'string' ? cleanUpiId(raw.upiId) : null, phone: typeof raw.phone === 'string' ? mobileOf(raw.phone) : null }
}

function readTally(raw: unknown): Tally | null {
  if (!isRecord(raw)) return null
  const { id, start } = raw
  if (typeof id !== 'string' || id.length === 0 || id.length > 200 || !isIsoDate(start) || typeof raw.name !== 'string') return null
  const name = cleanText(raw.name, MAX_TALLY_NAME)
  const memberIds = Array.isArray(raw.memberIds)
    ? Array.from(new Set(raw.memberIds.filter((m): m is string => typeof m === 'string' && m.length > 0 && m !== SHARED))).slice(0, MAX_TALLY_MEMBERS)
    : []
  if (!name || memberIds.length === 0) return null
  const split: TallySplit = raw.split === 'own' ? 'own' : 'equal'
  const keys = new Set(keysOf({ split, memberIds }))

  const rates: RateStep[] = []
  for (const step of Array.isArray(raw.rates) ? raw.rates.slice(0, MAX_STEPS) : []) {
    if (isRecord(step) && isIsoDate(step.from) && isRate(step.rate) && !rates.some((r) => r.from === step.from)) rates.push({ from: step.from, rate: step.rate })
  }
  if (rates.length === 0) return null
  rates.sort((a, b) => (a.from < b.from ? -1 : 1))

  const usual: UsualStep[] = []
  for (const step of Array.isArray(raw.usual) ? raw.usual.slice(0, MAX_STEPS) : []) {
    if (isRecord(step) && isIsoDate(step.from) && !usual.some((u) => u.from === step.from)) usual.push({ from: step.from, counts: readCounts(step.counts, keys) })
  }
  if (usual.length === 0) usual.push({ from: start, counts: {} })
  usual.sort((a, b) => (a.from < b.from ? -1 : 1))

  const days: Record<string, Record<string, number>> = {}
  let kept = 0
  for (const [date, counts] of isRecord(raw.days) ? Object.entries(raw.days) : []) {
    if (kept >= MAX_DAYS) break
    const clean = isIsoDate(date) ? readCounts(counts, keys) : {}
    if (Object.keys(clean).length > 0) {
      days[date] = clean
      kept += 1
    }
  }

  const months: Record<string, TallyMonth> = {}
  for (const [period, month] of isRecord(raw.months) ? Object.entries(raw.months) : []) {
    if (!isPeriod(period) || !isRecord(month)) continue
    const closedAt = stamp(month.closedAt)
    const paidAt = stamp(month.paidAt)
    if (closedAt === null && paidAt === null) continue
    months[period] = { closedAt, paidAt, expenseId: closedAt !== null && typeof month.expenseId === 'string' ? month.expenseId : null }
  }

  return {
    id,
    name,
    unit: TALLY_UNITS.includes(raw.unit as TallyUnit) ? (raw.unit as TallyUnit) : 'unit',
    currency: cleanCurrency(typeof raw.currency === 'string' ? raw.currency : null, 'INR'),
    split,
    memberIds,
    groupId: typeof raw.groupId === 'string' && raw.groupId ? raw.groupId : null,
    start,
    rates,
    usual,
    days,
    vendor: cleanVendor(raw.vendor),
    months,
    createdAt: stamp(raw.createdAt) ?? 0,
  }
}

const tallySchema: ZodType<Tally> = z.pipe(
  z.unknown(),
  z.transform((raw, ctx) => {
    const tally = readTally(raw)
    if (!tally) {
      ctx.issues.push({ code: 'custom', message: 'Unusable tally', input: raw })
      return z.NEVER
    }
    return tally
  }),
)

export const tallySchemaState = z.object({
  tallies: z.catch(
    records(tallySchema, (t) => t.id, MAX_TALLIES),
    [],
  ),
})

export const tallyStore = createStore<TallyState>({
  key: STORAGE_KEYS.tally,
  schema: tallySchemaState,
  initial: () => ({ tallies: [] }),
  version: 1,
})

/* ------------------------------------------------------------------ reading */

export function useTallies(): Tally[] {
  return useStore(tallyStore, (state) => state.tallies)
}

export function tallyById(id: string): Tally | null {
  return tallyStore.get().tallies.find((t) => t.id === id) ?? null
}

/* ------------------------------------------------------------------ writing */

function change(id: string, next: (tally: Tally) => Tally | null): boolean {
  const state = tallyStore.get()
  const old = state.tallies.find((t) => t.id === id)
  const tally = old ? next(old) : null
  if (!old || !tally) return false
  tallyStore.set({ tallies: state.tallies.map((t) => (t.id === id ? tally : t)) })
  return true
}

export interface TallyInput {
  name: string
  unit: TallyUnit
  /** Paise a unit. */
  rate: number
  /** The usual for a day, in quarter units (each person's, when it is by own count). */
  usual: number
  split: TallySplit
  memberIds: readonly string[]
  groupId: string | null
  /** The first day it counts. */
  start: string
  currency: string
}

/** Starts a tally; null when it has no name, no people, a bad rate or date, or there are 60 already. */
export function addTally(input: TallyInput, now: number = Date.now()): Tally | null {
  const state = tallyStore.get()
  if (state.tallies.length >= MAX_TALLIES) return null
  const split: TallySplit = input.split === 'own' ? 'own' : 'equal'
  const counts: Record<string, number> = {}
  for (const key of keysOf({ split, memberIds: [...input.memberIds] })) counts[key] = input.usual
  const tally = readTally({
    id: newId(),
    name: input.name,
    unit: input.unit,
    currency: input.currency,
    split,
    memberIds: input.memberIds,
    groupId: input.groupId,
    start: input.start,
    rates: [{ from: input.start, rate: input.rate }],
    usual: [{ from: input.start, counts }],
    days: {},
    vendor: null,
    months: {},
    createdAt: now,
  })
  if (!tally || !isCount(input.usual)) return null
  tallyStore.set({ tallies: [...state.tallies, tally] })
  return tally
}

/** Puts a tally back exactly as it was (Undo), or adds it again if it was deleted. */
export function putTally(tally: Tally): void {
  const state = tallyStore.get()
  const there = state.tallies.some((t) => t.id === tally.id)
  if (!there && state.tallies.length >= MAX_TALLIES) return
  tallyStore.set({ tallies: there ? state.tallies.map((t) => (t.id === tally.id ? tally : t)) : [...state.tallies, tally] })
}

/** Removes a tally; returns it (for Undo with `putTally`), or null. */
export function deleteTally(id: string): Tally | null {
  const state = tallyStore.get()
  const tally = state.tallies.find((t) => t.id === id)
  if (!tally) return null
  tallyStore.set({ tallies: state.tallies.filter((t) => t.id !== id) })
  return tally
}

/**
 * Writes down a day's count for `key` (quarter units). A count equal to the usual is not stored.
 * False when the day is before the start, in a closed month, or the count is not one.
 */
export function setCount(id: string, date: string, key: string, quarters: number): boolean {
  return change(id, (tally) => {
    if (!isIsoDate(date) || date < tally.start || date <= lockedThrough(tally) || !isCount(quarters) || !keysOf(tally).includes(key)) return null
    const day = { ...(tally.days[date] ?? {}) }
    if (quarters === usualOn(tally, date, key)) delete day[key]
    else day[key] = quarters
    const days = { ...tally.days }
    if (Object.keys(day).length > 0) days[date] = day
    else delete days[date]
    return { ...tally, days }
  })
}

/** The rate from `from` on (paise a unit). False for a date inside a closed month. */
export function setRate(id: string, from: string, rate: number): boolean {
  return change(id, (tally) => {
    if (!isIsoDate(from) || !isRate(rate) || from <= lockedThrough(tally)) return null
    // A rate "from" before the tally began is the rate it began with.
    const at = from < tally.start ? tally.start : from
    const rates = [...tally.rates.filter((r) => r.from !== at), { from: at, rate }].sort((a, b) => (a.from < b.from ? -1 : 1))
    return rates.length > MAX_STEPS ? null : { ...tally, rates }
  })
}

/** The usual for `key` from `from` on. Days already written down keep what was written. */
export function setUsual(id: string, from: string, key: string, quarters: number): boolean {
  return change(id, (tally) => {
    if (!isIsoDate(from) || !isCount(quarters) || from <= lockedThrough(tally) || !keysOf(tally).includes(key)) return null
    const at = from < tally.start ? tally.start : from
    const before = tally.usual.filter((u) => u.from <= at).pop()
    const step: UsualStep = { from: at, counts: { ...(before?.counts ?? {}), [key]: quarters } }
    // Later steps follow the new usual for this key too: "from now on" means from now on.
    const usual = [...tally.usual.filter((u) => u.from < at), step, ...tally.usual.filter((u) => u.from > at).map((u) => ({ ...u, counts: { ...u.counts, [key]: quarters } }))]
    return usual.length > MAX_STEPS ? null : { ...tally, usual }
  })
}

/** Saves (or clears) the vendor. */
export function setVendor(id: string, vendor: TallyVendor | null): boolean {
  return change(id, (tally) => ({ ...tally, vendor: vendor ? cleanVendor(vendor) : null }))
}

export function renameTally(id: string, name: string): boolean {
  const clean = cleanText(name, MAX_TALLY_NAME)
  return change(id, (tally) => (clean ? { ...tally, name: clean } : null))
}

/** Changes what is known about a month (closed, its expense, paid). A month with nothing known is forgotten. */
export function setMonth(id: string, period: string, patch: Partial<TallyMonth>): boolean {
  return change(id, (tally) => {
    if (!isPeriod(period)) return null
    const month: TallyMonth = { closedAt: null, expenseId: null, paidAt: null, ...tally.months[period], ...patch }
    if (month.closedAt === null) month.expenseId = null
    const months = { ...tally.months }
    if (month.closedAt === null && month.paidAt === null) delete months[period]
    else months[period] = month
    return { ...tally, months }
  })
}
