/**
 * Exchange rates for trip currency: the ECB reference rates served by `GET /api/rates`, cached in
 * memory and on the phone (`settle.v4.rates`) so a rate asked for once keeps working offline.
 * A past day's answer is final (the ECB never revises), so it's reused forever; an answer for today
 * (or later) is asked again after 4 hours. Rates come back as decimal strings (`rateString`), the
 * form `convertMinor` uses — never floats for money.
 */
import { useEffect, useRef, useState } from 'react'
import { addDays, isIsoDate, today } from '../engine/dates'
import { crossRate, rateString } from '../engine/fx'
import { callApi, isOffline, isRecord } from './http'

export const RATES_CACHE_KEY = 'settle.v4.rates'

/** How many answers the phone keeps (the newest asked days). */
export const MAX_CACHED_RATES = 60
/** An answer for today or later is asked again after this long. */
export const LATEST_TTL_MS = 4 * 60 * 60 * 1000
/** Older days than this aren't served by the ECB's 90-day history. */
export const MAX_AGE_DAYS = 90
/** Waiting for a date or currency to settle before asking (spec 06 §9). */
export const RATE_DEBOUNCE_MS = 300

const TIMEOUT_MS = 10_000

export interface RatesTable {
  /** The ECB business day used (at or before the asked day). */
  date: string
  /** Units per 1 EUR (EUR included), plus pegged currencies. */
  rates: Record<string, number>
  /** Currencies derived from a peg: code → the currency it's pegged to and the peg. */
  pegged: Record<string, { to: string; peg: number }>
}

export type RateLookup =
  | {
      status: 'ok'
      /** Units of `to` per 1 `from`, a decimal string (`rateString`). */
      rate: string
      /** The ECB business day the rate is from. */
      rateDate: string
      source: 'ecb' | 'pegged'
      /** From the phone's cache because the server couldn't be reached. */
      stale: boolean
      /** For a pegged currency: which one, what it's pegged to and the peg ("AED pegged to USD at 3.6725"). */
      peg?: { code: string; to: string; peg: number }
    }
  | { status: 'unavailable'; reason: 'offline' | 'not_covered' | 'too_old' | 'error' }

/** One cached answer: asked for `asked`, answered with the business day `date`. */
interface CacheEntry extends RatesTable {
  asked: string
  fetchedAt: number
}

type FetchResult = { ok: true; entry: CacheEntry } | { ok: false; reason: 'offline' | 'too_old' | 'error' }

let memory: CacheEntry[] | null = null
const inFlight = new Map<string, Promise<FetchResult>>()

/* ------------------------------------------------------------------ validation */

function isRateRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false
  return Object.entries(value).every(([code, rate]) => /^[A-Z]{3}$/.test(code) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0)
}

function isPegRecord(value: unknown): value is Record<string, { to: string; peg: number }> {
  if (!isRecord(value)) return false
  return Object.entries(value).every(
    ([code, peg]) =>
      /^[A-Z]{3}$/.test(code) &&
      isRecord(peg) &&
      typeof peg.to === 'string' &&
      /^[A-Z]{3}$/.test(peg.to) &&
      typeof peg.peg === 'number' &&
      Number.isFinite(peg.peg) &&
      peg.peg > 0,
  )
}

/** A rates table as the server sends it, or null when anything is off. */
export function parseRatesTable(value: unknown): RatesTable | null {
  if (!isRecord(value) || !isIsoDate(value.date) || !isRateRecord(value.rates)) return null
  const pegged = value.pegged === undefined ? {} : value.pegged
  if (!isPegRecord(pegged)) return null
  return { date: value.date, rates: { ...value.rates, EUR: 1 }, pegged: { ...pegged } }
}

function parseEntry(value: unknown): CacheEntry | null {
  if (!isRecord(value) || !isIsoDate(value.asked) || typeof value.fetchedAt !== 'number' || !Number.isFinite(value.fetchedAt)) return null
  const table = parseRatesTable(value)
  if (!table || table.date > value.asked) return null
  return { ...table, asked: value.asked, fetchedAt: value.fetchedAt }
}

/* ------------------------------------------------------------------ the cache */

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function entries(): CacheEntry[] {
  if (memory) return memory
  memory = []
  try {
    const raw = storage()?.getItem(RATES_CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    const list = isRecord(parsed) && Array.isArray(parsed.entries) ? parsed.entries : []
    memory = list.map(parseEntry).filter((e): e is CacheEntry => e !== null)
  } catch {
    // Unreadable or blocked: start empty.
  }
  return memory
}

function remember(entry: CacheEntry): void {
  const list = [entry, ...entries().filter((e) => e.asked !== entry.asked)]
    .sort((a, b) => (a.asked < b.asked ? 1 : a.asked > b.asked ? -1 : 0))
    .slice(0, MAX_CACHED_RATES)
  memory = list
  try {
    storage()?.setItem(RATES_CACHE_KEY, JSON.stringify({ v: 1, entries: list }))
  } catch {
    // Storage full or blocked: the memory copy still works for this visit.
  }
}

/** True while an answer can be reused as is: a past day's is final, today's lasts 4 hours. */
function usable(entry: CacheEntry, now: number): boolean {
  return entry.asked < today(new Date(now)) || (now - entry.fetchedAt >= 0 && now - entry.fetchedAt < LATEST_TTL_MS)
}

/**
 * The cached answer for `asked`: an answer for day A that used business day D is also the answer
 * for every day between D and A (there was no business day in between).
 */
function cachedFor(asked: string, now: number): CacheEntry | null {
  return entries().find((e) => e.date <= asked && asked <= e.asked && usable(e, now)) ?? null
}

/** The newest cached business day at or before `asked`, however old the answer (offline fallback). */
function nearestCached(asked: string): CacheEntry | null {
  let best: CacheEntry | null = null
  for (const e of entries()) {
    if (e.date <= asked && (best === null || e.date > best.date)) best = e
  }
  return best
}

/** The day to ask for: a date in the future gets today's rate. */
function askedDay(date: string, now: number): string {
  const day = today(new Date(now))
  return isIsoDate(date) && date <= day ? date : day
}

function tooOld(asked: string, now: number): boolean {
  return asked < addDays(today(new Date(now)), -MAX_AGE_DAYS)
}

/* ------------------------------------------------------------------ the network */

async function fetchRates(asked: string, now: number): Promise<FetchResult> {
  const result = await callApi(`/api/rates?date=${encodeURIComponent(asked)}`, { method: 'GET', timeoutMs: TIMEOUT_MS })
  if (result.ok) {
    const table = parseRatesTable(result.body)
    if (!table || table.date > asked) return { ok: false, reason: 'error' }
    const entry: CacheEntry = { ...table, asked, fetchedAt: now }
    remember(entry)
    return { ok: true, entry }
  }
  if (result.kind === 'network') return { ok: false, reason: isOffline() ? 'offline' : 'error' }
  if (result.kind === 'http' && result.code === 'rates_unavailable') return { ok: false, reason: tooOld(asked, now) ? 'too_old' : 'error' }
  return { ok: false, reason: isOffline() ? 'offline' : 'error' }
}

/** One request per asked day at a time, shared by every caller. */
function fetchShared(asked: string, now: number): Promise<FetchResult> {
  const pending = inFlight.get(asked)
  if (pending) return pending
  const promise = fetchRates(asked, now).finally(() => inFlight.delete(asked))
  inFlight.set(asked, promise)
  return promise
}

/** Resolves with `promise`, or with null as soon as `signal` aborts (the shared request carries on). */
function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | null> {
  if (!signal) return promise
  if (signal.aborted) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const onAbort = () => resolve(null)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/** Rates for a date: memory → the phone's cache → `GET /api/rates`. Null when there are none to be had. */
export async function getRates(date: string, signal?: AbortSignal): Promise<RatesTable | null> {
  const now = Date.now()
  const asked = askedDay(date, now)
  const hit = cachedFor(asked, now)
  if (hit) return hit
  const result = await untilAborted(fetchShared(asked, now), signal)
  return result?.ok ? result.entry : null
}

/* ------------------------------------------------------------------ one rate */

/** The rate from → to in `table`, or null when the ECB doesn't publish one of them. */
function rateIn(table: RatesTable, from: string, to: string, stale: boolean): RateLookup | null {
  const rate = rateString(crossRate(table.rates, from, to) ?? Number.NaN)
  if (rate === null) return null
  const pegCode = table.pegged[from] ? from : table.pegged[to] ? to : null
  const peg = pegCode ? table.pegged[pegCode] : undefined
  return {
    status: 'ok',
    rate,
    rateDate: table.date,
    source: peg ? 'pegged' : 'ecb',
    stale,
    ...(peg && pegCode ? { peg: { code: pegCode, to: peg.to, peg: peg.peg } } : {}),
  }
}

/** The rate from → to without asking the network: a usable cached answer, or null. */
export function cachedRate(from: string, to: string, date: string): RateLookup | null {
  const now = Date.now()
  const hit = cachedFor(askedDay(date, now), now)
  if (!hit) return null
  return rateIn(hit, from, to, false) ?? { status: 'unavailable', reason: 'not_covered' }
}

/**
 * The rate from → to for an expense dated `date` (a weekend or holiday uses the business day
 * before; a future date, today's). Offline or with the server down, the nearest cached day at or
 * before it, flagged stale.
 */
export async function lookupRate(from: string, to: string, date: string, signal?: AbortSignal): Promise<RateLookup> {
  const now = Date.now()
  const asked = askedDay(date, now)
  if (from === to) return { status: 'ok', rate: '1', rateDate: asked, source: 'ecb', stale: false }

  const hit = cachedFor(asked, now)
  if (hit) return rateIn(hit, from, to, false) ?? { status: 'unavailable', reason: 'not_covered' }

  const result = tooOld(asked, now) ? ({ ok: false, reason: 'too_old' } as const) : await untilAborted(fetchShared(asked, now), signal)
  if (result === null) return { status: 'unavailable', reason: 'error' }
  if (result.ok) return rateIn(result.entry, from, to, false) ?? { status: 'unavailable', reason: 'not_covered' }

  if (result.reason !== 'too_old') {
    const fallback = nearestCached(asked)
    if (fallback) return rateIn(fallback, from, to, true) ?? { status: 'unavailable', reason: 'not_covered' }
  }
  return { status: 'unavailable', reason: result.reason }
}

/* ------------------------------------------------------------------ React */

export type RateState = RateLookup | { status: 'loading' }

/**
 * The rate from → to for `date`, looked up after the inputs have been still for 300 ms (a cached
 * answer shows at once). Null when there's nothing to convert (`from` null or equal to `to`).
 */
export function useRate(from: string | null, to: string, date: string): RateState | null {
  const key = from !== null && from !== to ? `${from}>${to}@${date}` : null
  const [state, setState] = useState<{ key: string; value: RateLookup } | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (key === null || from === null) return
    // A cached answer is read during render; nothing to fetch.
    if (cachedRate(from, to, date)) {
      first.current = false
      return
    }
    const controller = new AbortController()
    const delay = first.current ? 0 : RATE_DEBOUNCE_MS
    first.current = false
    const timer = setTimeout(() => {
      void lookupRate(from, to, date, controller.signal).then((value) => {
        if (!controller.signal.aborted) setState({ key, value })
      })
    }, delay)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, from, to, date])

  if (key === null || from === null) return null
  if (state?.key === key) return state.value
  return cachedRate(from, to, date) ?? { status: 'loading' }
}

/** Forgets every cached and pending answer (tests). */
export function resetRatesForTests(): void {
  memory = null
  inFlight.clear()
}
