/**
 * Exchange rates for trip currency (`GET /api/rates?date=YYYY-MM-DD`): the European Central
 * Bank's daily reference rates (free, no key), kept in memory, plus currencies pegged to one the
 * ECB publishes (AED, SAR, NPR…) derived exactly. Rates are units per 1 EUR; the client crosses
 * them and freezes the rate on the expense, so a rate is only ever read, never trusted blindly.
 */
import { PEGS, type RatesResponse } from '../shared/api'
import type { Logger } from './http'

/** The last ~90 days of reference rates (about 64 business days, 31 currencies). */
export const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'

/** The ECB's first reference rates. */
const FIRST_ECB_DAY = '1999-01-04'
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
/** Refetch after this long whatever is asked… */
export const REFRESH_MS = 6 * HOUR_MS
/** …or after this long when asked for a day newer than the newest we have (today's rates appear ~16:00 CET). */
export const NEWER_DAY_REFRESH_MS = 15 * 60_000
export const FETCH_TIMEOUT_MS = 8_000

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_BLOCK = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/g
const RATE = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]\s*\/>/g

/** Rates per business day (units per 1 EUR, EUR itself = 1), from the ECB's XML. Unparseable entries are skipped. */
export function parseEcbXml(xml: string): Map<string, Record<string, number>> {
  const days = new Map<string, Record<string, number>>()
  const marks = [...xml.matchAll(DAY_BLOCK)]
  marks.forEach((mark, i) => {
    const day = mark[1] ?? ''
    const start = (mark.index ?? 0) + mark[0].length
    const end = marks[i + 1]?.index ?? xml.length
    const rates: Record<string, number> = { EUR: 1 }
    let found = 0
    for (const m of xml.slice(start, end).matchAll(RATE)) {
      const value = Number(m[2])
      if (m[1] && Number.isFinite(value) && value > 0) {
        rates[m[1]] = value
        found++
      }
    }
    if (found > 0 && isRealDay(day)) days.set(day, rates)
  })
  return days
}

function isRealDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Adds the pegged currencies (skipping any whose base is missing that day). */
export function withPegs(rates: Readonly<Record<string, number>>): Pick<RatesResponse, 'rates' | 'pegged'> {
  const out: Record<string, number> = { ...rates }
  const pegged: Record<string, { to: string; peg: number }> = {}
  for (const [code, [base, peg]] of Object.entries(PEGS)) {
    const baseRate = out[base]
    if (baseRate === undefined || out[code] !== undefined) continue
    out[code] = baseRate * peg
    pegged[code] = { to: base, peg }
  }
  return { rates: out, pegged }
}

export type RatesLookup =
  | { ok: true; body: RatesResponse; /** The newest day we have (an older one can be cached for long). */ newest: boolean }
  | { ok: false; code: 'bad_request' | 'rates_unavailable' }

export interface RatesSourceOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  log?: Logger
  url?: string
}

export interface RatesSource {
  /** Rates for `date` (null = the newest): the newest business day at or before it. */
  lookup(date: string | null): Promise<RatesLookup>
}

/** A cached, self-refreshing source of ECB rates. One fetch in flight at a time; failures fall back to the cache. */
export function createRatesSource(options: RatesSourceOptions = {}): RatesSource {
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const now = options.now ?? Date.now
  const log = options.log ?? console
  const url = options.url ?? ECB_URL
  let days = new Map<string, Record<string, number>>()
  let sorted: string[] = []
  let fetchedAt: number | null = null
  let inFlight: Promise<void> | null = null

  async function refresh(): Promise<void> {
    const started = now()
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/xml, text/xml' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const parsed = parseEcbXml(await response.text())
      if (parsed.size === 0) throw new Error('no rates in the reply')
      // Keep older days we had (a shorter reply never loses them).
      days = new Map([...days, ...parsed])
      sorted = [...days.keys()].sort()
      const newest = sorted[sorted.length - 1] ?? ''
      log.info(`[rates] ok · ${newest} · ${Object.keys(days.get(newest) ?? {}).length - 1} currencies · ${now() - started} ms`)
    } catch (error) {
      log.warn(`[rates] fetch failed: ${error instanceof Error ? error.message : String(error)}${sorted.length > 0 ? ' — serving cached rates' : ''}`)
    } finally {
      // A failure also waits before trying again (no hammering a site that's down).
      fetchedAt = now()
    }
  }

  function needsRefresh(asked: string | null): boolean {
    if (fetchedAt === null) return true
    const age = now() - fetchedAt
    if (age > REFRESH_MS) return true
    const newest = sorted[sorted.length - 1]
    return asked !== null && newest !== undefined && asked > newest && age > NEWER_DAY_REFRESH_MS
  }

  return {
    async lookup(date) {
      if (date !== null) {
        const tomorrow = new Date(now() + DAY_MS).toISOString().slice(0, 10)
        if (!isRealDay(date) || date < FIRST_ECB_DAY || date > tomorrow) return { ok: false, code: 'bad_request' }
      }
      if (needsRefresh(date)) {
        inFlight ??= refresh().finally(() => {
          inFlight = null
        })
        await inFlight
      }
      // The newest business day at or before the asked one (weekends and holidays → the day before).
      let pick: string | undefined
      for (let i = sorted.length - 1; i >= 0; i--) {
        const day = sorted[i]
        if (day !== undefined && (date === null || day <= date)) {
          pick = day
          break
        }
      }
      const rates = pick === undefined ? undefined : days.get(pick)
      if (pick === undefined || rates === undefined) return { ok: false, code: 'rates_unavailable' }
      return { ok: true, body: { date: pick, base: 'EUR', ...withPegs(rates) }, newest: pick === sorted[sorted.length - 1] }
    },
  }
}

/** Cache-Control for an answer: a past day never changes (ECB doesn't revise); the newest may get a newer day soon. */
export function ratesCacheControl(newest: boolean): string {
  return newest ? 'public, max-age=900' : 'public, max-age=3600, stale-while-revalidate=86400'
}
