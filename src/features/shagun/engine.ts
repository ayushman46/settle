/**
 * The shagun book's sums, worked out from what's written in it (pure: no storage, no clock; pass
 * `today` in). Per family: everything they gave you and you gave them, the net, the last time each
 * way, and what to give next time. Per function: what came in and from how many families.
 */
import { cleanText } from '../../data/schemas'
import { isIsoDate } from '../../engine/dates'
import { suggestShagun, yearsBetween } from './suggest'
import { MAX_SHAGUN_NAME, type ShagunEntry, type ShagunFunction } from './types'

/* ------------------------------------------------------------------ names */

/** A name as it's kept: single spaces, trimmed, at most 60 characters. */
export function tidyName(raw: string): string {
  return cleanText(raw, MAX_SHAGUN_NAME)
}

/** The same family however it was typed: "Sharma ji" and "sharma ji " are one. */
export function nameKey(raw: string): string {
  return tidyName(raw).toLowerCase()
}

/** Older first: by date, then by when it was written down. */
export function byTime(a: ShagunEntry, b: ShagunEntry): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0)
}

/**
 * Names from the book that fit what's being typed, for "pick, don't type": names starting with it
 * first, then names containing it, each alphabetically. Empty query: nothing.
 */
export function matchNames(names: readonly string[], query: string, limit = 5): string[] {
  const q = nameKey(query)
  if (!q) return []
  const starts: string[] = []
  const contains: string[] = []
  const seen = new Set<string>()
  for (const name of names) {
    const key = nameKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    if (key.startsWith(q)) starts.push(name)
    else if (key.includes(q)) contains.push(name)
  }
  return [...starts.sort(compareNames), ...contains.sort(compareNames)].slice(0, limit)
}

/* ------------------------------------------------------------------ families */

export interface FamilySummary {
  key: string
  /** As last written. */
  name: string
  /** Paise they gave you, in all. */
  received: number
  /** Paise you gave them, in all. */
  given: number
  /** received − given: above 0, they’ve given you more than you’ve given them. */
  net: number
  receivedCount: number
  givenCount: number
  lastReceived: ShagunEntry | null
  lastGiven: ShagunEntry | null
  /** The latest date either way. */
  lastDate: string
  /** Both ways, oldest first. */
  entries: ShagunEntry[]
}

/** One summary per family (case and spaces ignored), in no particular order. */
export function familySummaries(entries: readonly ShagunEntry[]): FamilySummary[] {
  const byKey = new Map<string, ShagunEntry[]>()
  for (const entry of entries) {
    const key = nameKey(entry.name)
    if (!key) continue
    const list = byKey.get(key)
    if (list) list.push(entry)
    else byKey.set(key, [entry])
  }
  const out: FamilySummary[] = []
  for (const [key, list] of byKey) out.push(summarise(key, list))
  return out
}

function summarise(key: string, list: ShagunEntry[]): FamilySummary {
  const entries = [...list].sort(byTime)
  let received = 0
  let given = 0
  let receivedCount = 0
  let givenCount = 0
  let lastReceived: ShagunEntry | null = null
  let lastGiven: ShagunEntry | null = null
  let latestWritten = entries[0] as ShagunEntry
  for (const entry of entries) {
    if (entry.direction === 'received') {
      received += entry.amount
      receivedCount += 1
      lastReceived = entry
    } else {
      given += entry.amount
      givenCount += 1
      lastGiven = entry
    }
    if (entry.at >= latestWritten.at) latestWritten = entry
  }
  const last = entries[entries.length - 1] as ShagunEntry
  return {
    key,
    name: tidyName(latestWritten.name),
    received,
    given,
    net: received - given,
    receivedCount,
    givenCount,
    lastReceived,
    lastGiven,
    lastDate: last.date,
    entries,
  }
}

/** The family a typed name belongs to, or null. */
export function findFamily(families: readonly FamilySummary[], name: string): FamilySummary | null {
  const key = nameKey(name)
  return key ? (families.find((f) => f.key === key) ?? null) : null
}

/* ------------------------------------------------------------------ what to give */

export type ShagunAdvice =
  /** They've never given you anything (or nothing is written down). */
  | { kind: 'none' }
  /** They gave you only gifts, no money: nothing to grow. */
  | { kind: 'gift'; gift: string; date: string; fn: ShagunFunction | null }
  /**
   * Give `amount` (paise): they gave `gave` (paise, everything at that function) on `date`,
   * `years` whole years before today.
   */
  | { kind: 'amount'; amount: number; gave: number; date: string; years: number; fn: ShagunFunction | null }

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/**
 * What to give them next time: what they gave you the last time (all of it, if there were two
 * envelopes at that function), grown for the whole years since, rounded up to an amount that ends
 * in 1, and never below what they gave.
 */
export function adviseFamily(
  family: Pick<FamilySummary, 'entries'>,
  functionsById: Readonly<Record<string, ShagunFunction>>,
  today: string,
): ShagunAdvice {
  const received = family.entries.filter((e) => e.direction === 'received')
  if (received.length === 0) return { kind: 'none' }
  const withMoney = received.filter((e) => e.amount > 0)
  const latest = withMoney.reduce<ShagunEntry | null>((best, e) => (best === null || byTime(best, e) < 0 ? e : best), null)
  if (latest === null) {
    const lastGift = [...received].sort(byTime)[received.length - 1] as ShagunEntry
    return { kind: 'gift', gift: lastGift.gift ?? '', date: lastGift.date, fn: lastGift.functionId ? (functionsById[lastGift.functionId] ?? null) : null }
  }
  // Everything they gave at that same function (or that same day, when it isn't tied to one).
  const sameOccasion = withMoney.filter((e) =>
    latest.functionId !== null ? e.functionId === latest.functionId : e.functionId === null && e.date === latest.date,
  )
  const gave = sameOccasion.reduce((sum, e) => sum + e.amount, 0)
  const years = isIsoDate(latest.date) && isIsoDate(today) ? yearsBetween(utcDate(latest.date), utcDate(today)) : 0
  const rupees = suggestShagun({ gaveYou: gave / 100, yearsAgo: years })
  if (rupees === null) return { kind: 'none' }
  // Never below what they gave, to the paisa (the rule rounds whole rupees).
  const amount = Math.max(rupees * 100, gave)
  return { kind: 'amount', amount, gave, date: latest.date, years, fn: latest.functionId ? (functionsById[latest.functionId] ?? null) : null }
}

export interface GivenNote {
  /** Paise you gave them at that occasion, in all (0 when it was only a gift). */
  amount: number
  /** The gift, when there was no money. */
  gift: string | null
  date: string
  fn: ShagunFunction | null
}

/**
 * The last time you gave them something: everything you gave at that same function (or that same
 * day, when it isn't tied to one). Null when the book has nothing you gave them.
 */
export function lastGivenTo(
  family: Pick<FamilySummary, 'entries'>,
  functionsById: Readonly<Record<string, ShagunFunction>>,
): GivenNote | null {
  const given = family.entries.filter((e) => e.direction === 'given')
  const latest = given.reduce<ShagunEntry | null>((best, e) => (best === null || byTime(best, e) < 0 ? e : best), null)
  if (latest === null) return null
  const same = given.filter((e) =>
    latest.functionId !== null ? e.functionId === latest.functionId : e.functionId === null && e.date === latest.date,
  )
  const amount = same.reduce((sum, e) => sum + e.amount, 0)
  const gift = amount > 0 ? null : (same.find((e) => e.gift)?.gift ?? null)
  return { amount, gift, date: latest.date, fn: latest.functionId ? (functionsById[latest.functionId] ?? null) : null }
}

/* ------------------------------------------------------------------ the whole book */

export interface BookTotals {
  received: number
  given: number
  families: number
  entries: number
}

export function bookTotals(entries: readonly ShagunEntry[]): BookTotals {
  let received = 0
  let given = 0
  const keys = new Set<string>()
  for (const e of entries) {
    if (e.direction === 'received') received += e.amount
    else given += e.amount
    const key = nameKey(e.name)
    if (key) keys.add(key)
  }
  return { received, given, families: keys.size, entries: entries.length }
}

export interface FunctionTotal {
  fn: ShagunFunction
  received: number
  given: number
  /** Different families with an entry at it. */
  families: number
  entries: number
}

/** One function's totals (see `functionTotals`). */
export function functionTotal(fn: ShagunFunction, entries: readonly ShagunEntry[]): FunctionTotal {
  return functionTotals([fn], entries)[0] as FunctionTotal
}

/** Each function with what came in and went out at it, newest function first (ties by name). */
export function functionTotals(functions: readonly ShagunFunction[], entries: readonly ShagunEntry[]): FunctionTotal[] {
  const acc = new Map<string, { received: number; given: number; keys: Set<string>; entries: number }>()
  for (const fn of functions) acc.set(fn.id, { received: 0, given: 0, keys: new Set(), entries: 0 })
  for (const e of entries) {
    if (e.functionId === null) continue
    const row = acc.get(e.functionId)
    if (!row) continue
    if (e.direction === 'received') row.received += e.amount
    else row.given += e.amount
    row.keys.add(nameKey(e.name))
    row.entries += 1
  }
  return functions
    .map((fn) => {
      const row = acc.get(fn.id) ?? { received: 0, given: 0, keys: new Set<string>(), entries: 0 }
      return { fn, received: row.received, given: row.given, families: row.keys.size, entries: row.entries }
    })
    .sort((a, b) => (a.fn.date < b.fn.date ? 1 : a.fn.date > b.fn.date ? -1 : compareNames(a.fn.name, b.fn.name)))
}

/** Families whose name contains what's typed (case and spaces ignored). Empty query: all. */
export function searchFamilies(families: readonly FamilySummary[], query: string): FamilySummary[] {
  const q = nameKey(query)
  return q ? families.filter((f) => f.key.includes(q)) : [...families]
}

export type FamilySort = 'name' | 'amount' | 'recent'

/** name: A to Z · amount: most money either way first · recent: latest entry first. Ties by name. */
export function sortFamilies(families: readonly FamilySummary[], by: FamilySort): FamilySummary[] {
  const list = [...families]
  const byName = (a: FamilySummary, b: FamilySummary) => compareNames(a.name, b.name)
  if (by === 'name') return list.sort(byName)
  if (by === 'amount') return list.sort((a, b) => b.received + b.given - (a.received + a.given) || byName(a, b))
  return list.sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : byName(a, b)))
}

/**
 * The latest envelope from this name already written down at this function, this way round, or
 * null. Without a function, only that same day counts.
 */
export function earlierInFunction(
  entries: readonly ShagunEntry[],
  functionId: string | null,
  name: string,
  direction: ShagunEntry['direction'],
  date?: string,
): ShagunEntry | null {
  const key = nameKey(name)
  if (!key) return null
  let found: ShagunEntry | null = null
  for (const e of entries) {
    if (e.functionId !== functionId || e.direction !== direction) continue
    if (functionId === null && e.date !== date) continue
    if (nameKey(e.name) !== key) continue
    if (found === null || byTime(found, e) < 0) found = e
  }
  return found
}
