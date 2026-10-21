import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingConfig, Plan } from '../../shared/api'
import {
  BILLING_CACHE_KEY,
  FALLBACK_BILLING_CONFIG,
  knownLicensePublicKey,
  loadBillingConfig,
  parseBillingConfig,
  planById,
  planMonths,
  planPerMonth,
  resetBillingConfigForTests,
  useBillingConfig,
} from './config'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const SERVER: BillingConfig = {
  checkout: 'razorpay',
  keyId: 'rzp_live_xyz',
  currency: 'INR',
  plans: [
    { id: 'pro_monthly', name: 'Monthly', amount: 5900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
    { id: 'pro_yearly', name: 'Yearly', amount: 49900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 29 },
  ],
  licensePublicKey: 'MCowBQYDK2VwAyEAzKXv0CaT1a7XDB6SQaFhdenrYljDXUi8C3/P9s6gJSk=',
  proAiPerDay: 150,
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  resetBillingConfigForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetBillingConfigForTests()
})

describe('FALLBACK_BILLING_CONFIG', () => {
  it('has the launch prices with checkout off', () => {
    expect(FALLBACK_BILLING_CONFIG.checkout).toBeNull()
    expect(FALLBACK_BILLING_CONFIG.plans.map((p) => [p.id, p.amount, p.days])).toEqual([
      ['pro_monthly', 4900, 30],
      ['pro_yearly', 39900, 365],
      ['pro_lifetime', 99900, null],
    ])
  })

  it('states the yearly saving honestly (12 × ₹49 = ₹588 → 32%, rounded down)', () => {
    const monthly = planById(FALLBACK_BILLING_CONFIG, 'pro_monthly')?.amount ?? 0
    const yearly = planById(FALLBACK_BILLING_CONFIG, 'pro_yearly')
    expect(yearly?.savingsPercent).toBe(Math.floor((1 - (yearly?.amount ?? 0) / (12 * monthly)) * 100))
    expect(yearly?.badge).toBe('Best value')
    expect(planById(FALLBACK_BILLING_CONFIG, 'pro_lifetime')?.badge).toBe('Pay once')
  })
})

describe('parseBillingConfig', () => {
  it('accepts a server config', () => {
    expect(parseBillingConfig(SERVER)).toEqual(SERVER)
  })

  it('turns checkout off without a key id', () => {
    expect(parseBillingConfig({ ...SERVER, keyId: null })).toMatchObject({ checkout: null, keyId: null })
    expect(parseBillingConfig({ ...SERVER, checkout: 'stripe' })).toMatchObject({ checkout: null, keyId: null })
  })

  it('drops plans it cannot trust and duplicates', () => {
    const parsed = parseBillingConfig({
      ...SERVER,
      plans: [
        { id: 'pro_weekly', amount: 900, days: 7 },
        { id: 'pro_monthly', amount: 0, days: 30 },
        { id: 'pro_monthly', amount: 49.5, days: 30 },
        { id: 'pro_monthly', amount: 4900, days: 0 },
        { id: 'pro_monthly', amount: 4900, days: 'thirty' },
        { id: 'pro_yearly', amount: 39900, days: 365, savingsPercent: 150, badge: '   ' },
        { id: 'pro_yearly', amount: 1, days: 365 },
        { id: 'pro_lifetime', amount: 99900, days: null, name: '' },
        null,
      ],
    })
    expect(parsed?.plans).toEqual([
      { id: 'pro_yearly', name: 'Yearly', amount: 39900, currency: 'INR', days: 365, badge: null, savingsPercent: null },
      { id: 'pro_lifetime', name: 'Lifetime', amount: 99900, currency: 'INR', days: null, badge: null, savingsPercent: null },
    ])
  })

  it('fills in sensible defaults', () => {
    expect(parseBillingConfig({ plans: SERVER.plans })).toEqual({
      checkout: null,
      keyId: null,
      currency: 'INR',
      plans: SERVER.plans,
      licensePublicKey: null,
      proAiPerDay: 200,
    })
  })

  it('rejects anything without a usable plan', () => {
    expect(parseBillingConfig(null)).toBeNull()
    expect(parseBillingConfig({})).toBeNull()
    expect(parseBillingConfig({ plans: [] })).toBeNull()
    expect(parseBillingConfig({ plans: [{ id: 'x' }] })).toBeNull()
  })
})

describe('useBillingConfig', () => {
  it('fetches the config once and remembers it', async () => {
    fetchMock.mockResolvedValue(json(SERVER))
    const { result } = renderHook(() => useBillingConfig())
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toEqual(SERVER))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/billing/config')
    expect(JSON.parse(window.localStorage.getItem(BILLING_CACHE_KEY) ?? 'null')).toEqual(SERVER)
    renderHook(() => useBillingConfig())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(knownLicensePublicKey()).toBe(SERVER.licensePublicKey)
  })

  it('paints the remembered config first, then refreshes it', async () => {
    window.localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ...SERVER, proAiPerDay: 99 }))
    resetBillingConfigForTests()
    fetchMock.mockResolvedValue(json(SERVER))
    const { result } = renderHook(() => useBillingConfig())
    expect(result.current?.proAiPerDay).toBe(99)
    await waitFor(() => expect(result.current?.proAiPerDay).toBe(150))
  })

  it('falls back to the built-in plans when offline with nothing remembered', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useBillingConfig())
    await waitFor(() => expect(result.current).toBe(FALLBACK_BILLING_CONFIG))
  })

  it('keeps the remembered config when the server is down', async () => {
    window.localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify(SERVER))
    resetBillingConfigForTests()
    fetchMock.mockResolvedValue(json({ error: { code: 'upstream_error' } }, 500))
    const { result } = renderHook(() => useBillingConfig())
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current).toEqual(SERVER)
  })

  it('ignores a garbled remembered config', () => {
    window.localStorage.setItem(BILLING_CACHE_KEY, '{"plans":')
    resetBillingConfigForTests()
    fetchMock.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useBillingConfig())
    expect(result.current).toBeNull()
  })

  it('tries again when the connection returns', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    const { result } = renderHook(() => useBillingConfig())
    await waitFor(() => expect(result.current).toBe(FALLBACK_BILLING_CONFIG))
    fetchMock.mockResolvedValue(json(SERVER))
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current).toEqual(SERVER))
  })

  it("doesn't hammer a server that just failed", async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const first = renderHook(() => useBillingConfig())
    await waitFor(() => expect(first.result.current).toBe(FALLBACK_BILLING_CONFIG))
    renderHook(() => useBillingConfig())
    renderHook(() => useBillingConfig())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('is null on the server', async () => {
    const { renderToString } = await import('react-dom/server')
    const { createElement } = await import('react')
    function Probe() {
      return createElement('span', null, useBillingConfig() === null ? 'none' : 'some')
    }
    fetchMock.mockReturnValue(new Promise(() => {}))
    expect(renderToString(createElement(Probe))).toContain('none')
  })
})

describe('loadBillingConfig', () => {
  it('uses the remembered config unless a fresh one is needed', async () => {
    window.localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ...SERVER, keyId: 'rzp_old' }))
    resetBillingConfigForTests()
    let release: (r: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise((resolve) => (release = resolve)))
    await expect(loadBillingConfig()).resolves.toMatchObject({ keyId: 'rzp_old' })
    const fresh = loadBillingConfig({ fresh: true })
    release(json(SERVER))
    await expect(fresh).resolves.toEqual(SERVER)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(loadBillingConfig({ fresh: true })).resolves.toEqual(SERVER)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never throws: built-in plans when nothing else is known', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(loadBillingConfig({ fresh: true })).resolves.toBe(FALLBACK_BILLING_CONFIG)
  })

  it('survives blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    fetchMock.mockResolvedValue(json(SERVER))
    await expect(loadBillingConfig()).resolves.toEqual(SERVER)
  })
})

describe('plan helpers', () => {
  const plan = (days: number | null, amount: number): Plan => ({
    id: 'pro_yearly',
    name: 'x',
    amount,
    currency: 'INR',
    days,
    badge: null,
    savingsPercent: null,
  })

  it('counts whole months and the monthly price, rounded down', () => {
    expect(planMonths(plan(30, 4900))).toBe(1)
    expect(planMonths(plan(365, 39900))).toBe(12)
    expect(planMonths(plan(7, 900))).toBe(1)
    expect(planMonths(plan(null, 99900))).toBeNull()
    expect(planPerMonth(plan(365, 39900))).toBe(3325)
    expect(planPerMonth(plan(30, 4900))).toBe(4900)
    expect(planPerMonth(plan(null, 99900))).toBeNull()
  })

  it('finds plans by id', () => {
    expect(planById(SERVER, 'pro_yearly')?.amount).toBe(49900)
    expect(planById(SERVER, 'pro_lifetime')).toBeNull()
    expect(planById(null, 'pro_yearly')).toBeNull()
  })
})
