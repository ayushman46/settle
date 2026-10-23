import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convertMinor } from '../engine/fx'
import { cachedRate, getRates, lookupRate, RATES_CACHE_KEY, resetRatesForTests, useRate } from './rates'

/** Units per 1 EUR — spec 06 §4's fixture table (not real rates), plus the pegs the server derives. */
const ECB = { EUR: 1, USD: 1.0812, JPY: 163.42, INR: 90.4321, THB: 37.512, SGD: 1.4103, IDR: 17012.5, GBP: 0.8364 }

function table(date: string) {
  return {
    date,
    base: 'EUR',
    rates: { ...ECB, AED: ECB.USD * 3.6725, NPR: ECB.INR * 1.6 },
    pegged: { AED: { to: 'USD', peg: 3.6725 }, NPR: { to: 'INR', peg: 1.6 } },
  }
}

/** Weekends and holidays answer with the business day before (as the server does). */
function businessDay(asked: string): string {
  if (asked === '2026-10-18' || asked === '2026-10-17') return '2026-10-16'
  return asked
}

let fetchMock: ReturnType<typeof vi.fn>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function serveRates(): void {
  fetchMock.mockImplementation((url: string) => {
    const asked = new URL(url, 'http://x').searchParams.get('date') ?? '2026-10-23'
    return Promise.resolve(json(table(businessDay(asked))))
  })
}

function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 10))
  window.localStorage.clear()
  resetRatesForTests()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  setOnline(true)
  serveRates()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setOnline(true)
  window.localStorage.clear()
  resetRatesForTests()
})

describe('lookupRate', () => {
  it('turns the ECB table into an exact rate string (spec 06 §4)', async () => {
    const thb = await lookupRate('THB', 'INR', '2026-10-21')
    expect(thb).toEqual({ status: 'ok', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb', stale: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/rates?date=2026-10-21')
    if (thb.status !== 'ok') throw new Error('expected a rate')
    expect(convertMinor(125_000, 'THB', 'INR', thb.rate)).toBe(301_344)

    const cases: Array<[string, number, string, number]> = [
      ['JPY', 4_800, '0.5533722923', 265_619],
      ['IDR', 15_000_000, '0.005315626745', 79_734],
      ['USD', 4_999, '83.64049205', 418_119],
      ['SGD', 2_350, '64.12259803', 150_688],
    ]
    for (const [code, amount, rate, paise] of cases) {
      const found = await lookupRate(code, 'INR', '2026-10-21')
      expect(found).toMatchObject({ status: 'ok', rate, source: 'ecb' })
      expect(convertMinor(amount, code, 'INR', rate)).toBe(paise)
    }
    // One table answers every currency for that day.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('says when a rate comes from a peg', async () => {
    expect(await lookupRate('AED', 'INR', '2026-10-21')).toEqual({
      status: 'ok',
      rate: '22.77481063',
      rateDate: '2026-10-21',
      source: 'pegged',
      stale: false,
      peg: { code: 'AED', to: 'USD', peg: 3.6725 },
    })
    const npr = await lookupRate('NPR', 'INR', '2026-10-21')
    expect(npr).toMatchObject({ status: 'ok', rate: '0.625', source: 'pegged', peg: { code: 'NPR', to: 'INR', peg: 1.6 } })
    if (npr.status === 'ok') expect(convertMinor(150_000, 'NPR', 'INR', npr.rate)).toBe(93_750)
  })

  it('answers a weekend with the business day before, and reuses it for the days in between', async () => {
    expect(await lookupRate('THB', 'INR', '2026-10-18')).toMatchObject({ status: 'ok', rateDate: '2026-10-16' })
    expect(await lookupRate('THB', 'INR', '2026-10-17')).toMatchObject({ status: 'ok', rateDate: '2026-10-16' })
    expect(await lookupRate('THB', 'INR', '2026-10-16')).toMatchObject({ status: 'ok', rateDate: '2026-10-16' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps answers on the phone: a past day is never asked again', async () => {
    await lookupRate('THB', 'INR', '2026-10-21')
    resetRatesForTests() // a new visit: memory gone, localStorage kept
    expect(JSON.parse(window.localStorage.getItem(RATES_CACHE_KEY) ?? '{}')).toMatchObject({ v: 1, entries: [{ asked: '2026-10-21', date: '2026-10-21' }] })
    vi.setSystemTime(new Date(2026, 10, 1, 10))
    expect(await lookupRate('THB', 'INR', '2026-10-21')).toMatchObject({ status: 'ok', rate: '2.410751226', stale: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks again for today after 4 hours', async () => {
    await lookupRate('THB', 'INR', '2026-10-23')
    vi.setSystemTime(new Date(2026, 9, 23, 13, 59))
    await lookupRate('THB', 'INR', '2026-10-23')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date(2026, 9, 23, 14, 1))
    await lookupRate('THB', 'INR', '2026-10-23')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives a future date today’s rate', async () => {
    await lookupRate('THB', 'INR', '2026-12-31')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/rates?date=2026-10-23')
  })

  it('asks once for many lookups at the same time', async () => {
    const all = await Promise.all([lookupRate('THB', 'INR', '2026-10-21'), lookupRate('USD', 'INR', '2026-10-21'), getRates('2026-10-21')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(all[0]).toMatchObject({ status: 'ok', rate: '2.410751226' })
    expect(all[1]).toMatchObject({ status: 'ok', rate: '83.64049205' })
    expect(all[2]).toMatchObject({ date: '2026-10-21' })
  })

  it('says when the ECB doesn’t publish a currency', async () => {
    expect(await lookupRate('LKR', 'INR', '2026-10-21')).toEqual({ status: 'unavailable', reason: 'not_covered' })
    expect(await lookupRate('INR', 'VND', '2026-10-21')).toEqual({ status: 'unavailable', reason: 'not_covered' })
  })

  it('doesn’t ask for days older than the ECB’s 90-day history', async () => {
    expect(await lookupRate('THB', 'INR', '2026-07-01')).toEqual({ status: 'unavailable', reason: 'too_old' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('offline: the nearest cached day at or before, flagged stale', async () => {
    await lookupRate('THB', 'INR', '2026-10-18') // cached: 16 Oct
    setOnline(false)
    expect(await lookupRate('THB', 'INR', '2026-10-21')).toEqual({ status: 'ok', rate: '2.410751226', rateDate: '2026-10-16', source: 'ecb', stale: true })
    expect(await lookupRate('THB', 'INR', '2026-10-15')).toEqual({ status: 'unavailable', reason: 'offline' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('server down: the cache, else unavailable', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ error: { code: 'rates_unavailable', message: 'x' } }, 503)))
    expect(await lookupRate('THB', 'INR', '2026-10-21')).toEqual({ status: 'unavailable', reason: 'error' })
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await lookupRate('THB', 'INR', '2026-10-22')).toEqual({ status: 'unavailable', reason: 'error' })
    fetchMock.mockImplementation(() => Promise.resolve(json({ date: 'soon', rates: {} })))
    expect(await lookupRate('THB', 'INR', '2026-10-20')).toEqual({ status: 'unavailable', reason: 'error' })
  })

  it('ignores a cache it can’t read', async () => {
    window.localStorage.setItem(RATES_CACHE_KEY, '{"v":1,"entries":[{"asked":"2026-10-21","date":"2026-10-22","rates":{"INR":1},"pegged":{},"fetchedAt":1}, 7]}')
    resetRatesForTests()
    expect(cachedRate('THB', 'INR', '2026-10-21')).toBeNull()
    expect(await lookupRate('THB', 'INR', '2026-10-21')).toMatchObject({ status: 'ok', rate: '2.410751226' })
  })
})

describe('useRate', () => {
  it('is null with nothing to convert, loading, then the rate', async () => {
    const { result, rerender } = renderHook(({ from }: { from: string | null }) => useRate(from, 'INR', '2026-10-21'), {
      initialProps: { from: null as string | null },
    })
    expect(result.current).toBeNull()
    rerender({ from: 'INR' })
    expect(result.current).toBeNull()
    rerender({ from: 'THB' })
    expect(result.current).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ok', rate: '2.410751226' }))
    // A cached answer shows at once.
    rerender({ from: 'USD' })
    expect(result.current).toMatchObject({ status: 'ok', rate: '83.64049205' })
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
