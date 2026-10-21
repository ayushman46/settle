import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LICENSE_HEADER } from '../../shared/api'
import { BILLING_CACHE_KEY, FALLBACK_BILLING_CONFIG } from './config'
import { PENDING_PAYMENT_KEY, readPendingPayment, type PendingPayment } from './pending'
import {
  CLAIM_RETRY_DELAYS_MS,
  claimPayment,
  clearLicense,
  hasFeature,
  LICENSE_KEY,
  licenseHeaders,
  licenseToken,
  proState,
  redeemLicense,
  resumePendingPayment,
  useHasFeature,
  usePro,
} from './store'
import {
  createTestSigner,
  DAY_SECONDS,
  installLicense,
  rememberBillingConfig,
  resetProModulesForTests,
  type TestSigner,
} from './testKit'

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

const fetchMock = vi.fn<typeof fetch>()
let routes: Record<string, Handler> = {}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function calls(url: string): Array<RequestInit | undefined> {
  return fetchMock.mock.calls.filter(([u]) => u === url).map(([, init]) => init)
}

let signer: TestSigner
let other: TestSigner

beforeAll(async () => {
  signer = await createTestSigner()
  other = await createTestSigner()
})

beforeEach(() => {
  routes = {}
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url, init) => {
    const handler = routes[String(url)]
    if (!handler) throw new TypeError(`Failed to fetch ${String(url)}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  resetProModulesForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetProModulesForTests()
})

const now = () => Math.floor(Date.now() / 1000)

function serveConfig(publicKey: string | null): void {
  routes['/api/billing/config'] = () => json({ ...FALLBACK_BILLING_CONFIG, licensePublicKey: publicKey })
}

describe('usePro', () => {
  it('is free when nothing is stored', () => {
    const { result } = renderHook(() => usePro())
    expect(result.current).toEqual({ isPro: false, license: null, status: 'free', expiresAt: null })
    expect(hasFeature('insights')).toBe(false)
    expect(licenseToken()).toBeNull()
    expect(licenseHeaders()).toEqual({})
  })

  it('opens straight into Pro from a stored license, with expiry in milliseconds', async () => {
    const exp = now() + 30 * DAY_SECONDS
    const token = await signer.token({ plan: 'pro_monthly', exp })
    installLicense(token, signer.publicKey)
    const { result } = renderHook(() => usePro())
    expect(result.current).toMatchObject({ isPro: true, status: 'pro', expiresAt: exp * 1000 })
    expect(result.current.license).toMatchObject({ plan: 'pro_monthly', exp })
    expect(licenseToken()).toBe(token)
    expect(licenseHeaders()).toEqual({ [LICENSE_HEADER]: token })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('has no end date for lifetime', async () => {
    installLicense(await signer.token({ plan: 'pro_lifetime', exp: null }), signer.publicKey)
    expect(proState()).toMatchObject({ isPro: true, status: 'pro', expiresAt: null })
  })

  it('keeps an expired pass to show when it ended', async () => {
    const token = await signer.token({ plan: 'pro_monthly', iat: 1_000, exp: 2_000 })
    installLicense(token, signer.publicKey)
    expect(proState()).toEqual({
      isPro: false,
      status: 'expired',
      expiresAt: 2_000_000,
      license: { id: 'pay_test123', plan: 'pro_monthly', iat: 1_000, exp: 2_000 },
    })
    expect(licenseToken()).toBe(token)
    expect(licenseHeaders()).toEqual({})
    expect(hasFeature('recurring')).toBe(false)
  })

  it.each([
    ['broken JSON', '{'],
    ['the wrong shape', JSON.stringify(['SETTLE1.a.b'])],
    ['no token', JSON.stringify({ v: 1 })],
    ['a garbled token', JSON.stringify({ v: 1, token: 'SETTLE1.abc.def' })],
  ])('treats %s on the device as free', (_label, raw) => {
    window.localStorage.setItem(LICENSE_KEY, raw)
    expect(proState().status).toBe('free')
  })

  it('flips to expired the moment the pass runs out, app open', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00Z'), toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const exp = now() + 90
    installLicense(await signer.token({ iat: now() - DAY_SECONDS, exp }), signer.publicKey)
    const { result } = renderHook(() => usePro())
    expect(result.current.status).toBe('pro')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(89_000)
    })
    expect(result.current.status).toBe('pro')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(result.current).toMatchObject({ status: 'expired', isPro: false })
  })

  it('re-checks expiry when the app comes back to the foreground', async () => {
    const exp = now() + 60
    installLicense(await signer.token({ exp }), signer.publicKey)
    const { result } = renderHook(() => usePro())
    expect(result.current.status).toBe('pro')
    vi.spyOn(Date, 'now').mockReturnValue((exp + 5) * 1000)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.status).toBe('expired')
  })

  it('stops sending the license the moment it runs out, even before the screen catches up', async () => {
    const exp = now() + 60
    installLicense(await signer.token({ exp }), signer.publicKey)
    expect(licenseHeaders()).toHaveProperty(LICENSE_HEADER)
    vi.spyOn(Date, 'now').mockReturnValue((exp + 1) * 1000)
    expect(licenseHeaders()).toEqual({})
  })

  it('ignores (but never deletes) a stored license that is not genuine', async () => {
    const forged = await other.token({ plan: 'pro_lifetime', exp: null })
    installLicense(forged, signer.publicKey)
    const { result } = renderHook(() => usePro())
    await waitFor(() => expect(result.current.status).toBe('free'))
    expect(licenseToken()).toBeNull()
    expect(window.localStorage.getItem(LICENSE_KEY)).toContain(forged)
  })

  it('re-checks against the server’s current key when the remembered one is out of date', async () => {
    const token = await signer.token()
    installLicense(token, other.publicKey)
    serveConfig(signer.publicKey)
    const verify = vi.spyOn(crypto.subtle, 'verify')
    const { result } = renderHook(() => usePro())
    expect(result.current.status).toBe('pro')
    // Once with the remembered key (no), once with the server's current one (yes).
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(2))
    await act(async () => {
      expect(await verify.mock.results[1]?.value).toBe(true)
    })
    expect(calls('/api/billing/config')).toHaveLength(1)
    expect(result.current.status).toBe('pro')
    expect(licenseToken()).toBe(token)
    expect(calls('/api/license/verify')).toHaveLength(0)
  })

  it('ignores a stored license the remembered key rejects when the current key cannot be fetched', async () => {
    installLicense(await signer.token(), other.publicKey)
    const { result } = renderHook(() => usePro())
    await waitFor(() => expect(result.current.status).toBe('free'))
    expect(calls('/api/billing/config')).toHaveLength(1)
  })

  it('stays Pro when the quiet re-check cannot reach anyone', async () => {
    const token = await signer.token()
    window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
    resetProModulesForTests()
    const { result } = renderHook(() => usePro())
    expect(result.current.status).toBe('pro')
    await waitFor(() => expect(calls('/api/license/verify')).toHaveLength(1))
    expect(calls('/api/billing/config')).toHaveLength(1)
    expect(result.current.status).toBe('pro')
  })

  it('follows other tabs', async () => {
    rememberBillingConfig({ licensePublicKey: signer.publicKey })
    const { result } = renderHook(() => usePro())
    expect(result.current.status).toBe('free')
    const token = await signer.token({ plan: 'pro_lifetime', exp: null })
    act(() => {
      window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
      window.dispatchEvent(new StorageEvent('storage', { key: LICENSE_KEY }))
    })
    expect(result.current).toMatchObject({ status: 'pro', license: { plan: 'pro_lifetime' } })
    act(() => {
      window.localStorage.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(result.current.status).toBe('free')
  })

  it("is 'loading' when rendered on a server", () => {
    function Probe() {
      return createElement('span', null, usePro().status)
    }
    expect(renderToString(createElement(Probe))).toContain('loading')
  })
})

describe('hasFeature', () => {
  it('unlocks every Pro feature with an active pass', async () => {
    const { result } = renderHook(() => useHasFeature('themes'))
    expect(result.current).toBe(false)
    rememberBillingConfig({ licensePublicKey: signer.publicKey })
    const token = await signer.token()
    await act(async () => {
      await redeemLicense(token)
    })
    expect(result.current).toBe(true)
    for (const f of ['unlimited_ai', 'recurring', 'insights', 'export', 'themes', 'clean_cards'] as const) {
      expect(hasFeature(f)).toBe(true)
    }
  })
})

describe('redeemLicense', () => {
  beforeEach(() => {
    rememberBillingConfig({ licensePublicKey: signer.publicKey })
  })

  it('verifies on the device and makes it this device’s license', async () => {
    const token = await signer.token({ id: 'promo-launch', plan: 'pro_yearly' })
    const { result } = renderHook(() => usePro())
    let outcome: Awaited<ReturnType<typeof redeemLicense>> | undefined
    await act(async () => {
      outcome = await redeemLicense(token)
    })
    expect(outcome).toMatchObject({ ok: true, license: { id: 'promo-launch', plan: 'pro_yearly' } })
    expect(result.current.status).toBe('pro')
    expect(JSON.parse(window.localStorage.getItem(LICENSE_KEY) ?? '{}')).toEqual({ v: 1, token })
    expect(calls('/api/license/verify')).toHaveLength(0)
  })

  it('finds the code inside a pasted message', async () => {
    const token = await signer.token()
    await expect(redeemLicense(`Your Settle Pro code:\n${token}\nThanks!`)).resolves.toMatchObject({ ok: true })
    expect(licenseToken()).toBe(token)
  })

  it.each([
    ['empty input', ''],
    ['random text', 'DIWALI50'],
    ['a garbled token', 'SETTLE1.abc.def'],
  ])('says invalid for %s', async (_label, input) => {
    await expect(redeemLicense(input)).resolves.toEqual({ ok: false, reason: 'invalid' })
    expect(proState().status).toBe('free')
  })

  it('says invalid for a code signed by someone else', async () => {
    serveConfig(signer.publicKey)
    await expect(redeemLicense(await other.token())).resolves.toEqual({ ok: false, reason: 'invalid' })
    expect(window.localStorage.getItem(LICENSE_KEY)).toBeNull()
  })

  it('says expired for a genuine code that has run out (and keeps the current one)', async () => {
    await redeemLicense(await signer.token({ plan: 'pro_lifetime', exp: null }))
    await expect(redeemLicense(await signer.token({ iat: 1_000, exp: 2_000 }))).resolves.toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(proState().license?.plan).toBe('pro_lifetime')
  })

  it('says network when nobody can check it', async () => {
    window.localStorage.removeItem(BILLING_CACHE_KEY)
    resetProModulesForTests()
    await expect(redeemLicense(await signer.token())).resolves.toEqual({ ok: false, reason: 'network' })
    expect(proState().status).toBe('free')
  })

  it('fetches the key when none is remembered', async () => {
    window.localStorage.removeItem(BILLING_CACHE_KEY)
    resetProModulesForTests()
    serveConfig(signer.publicKey)
    await expect(redeemLicense(await signer.token())).resolves.toMatchObject({ ok: true })
    expect(calls('/api/billing/config')).toHaveLength(1)
    expect(calls('/api/license/verify')).toHaveLength(0)
  })

  it('retries with the server’s current key when the remembered one is out of date', async () => {
    rememberBillingConfig({ licensePublicKey: other.publicKey })
    serveConfig(signer.publicKey)
    await expect(redeemLicense(await signer.token())).resolves.toMatchObject({ ok: true })
  })

  it('never cuts a longer pass short', async () => {
    await redeemLicense(await signer.token({ id: 'life', plan: 'pro_lifetime', exp: null }))
    const shorter = await signer.token({ id: 'month', plan: 'pro_monthly', exp: now() + 30 * DAY_SECONDS })
    await expect(redeemLicense(shorter)).resolves.toMatchObject({ ok: true, license: { id: 'life' } })
    expect(proState().license?.id).toBe('life')
  })

  it('upgrades to a longer pass', async () => {
    await redeemLicense(await signer.token({ id: 'month', plan: 'pro_monthly', exp: now() + 30 * DAY_SECONDS }))
    await expect(redeemLicense(await signer.token({ id: 'year', exp: now() + 365 * DAY_SECONDS }))).resolves.toMatchObject({
      ok: true,
      license: { id: 'year' },
    })
    expect(proState().license?.id).toBe('year')
  })

  it('replaces an expired pass', async () => {
    installLicense(await signer.token({ id: 'old', iat: 1_000, exp: 2_000 }), signer.publicKey)
    await expect(redeemLicense(await signer.token({ id: 'new', plan: 'pro_monthly', exp: now() + DAY_SECONDS }))).resolves.toMatchObject({
      ok: true,
      license: { id: 'new' },
    })
  })
})

describe('clearLicense', () => {
  it('removes Pro from this device', async () => {
    installLicense(await signer.token(), signer.publicKey)
    const { result } = renderHook(() => usePro())
    expect(result.current.isPro).toBe(true)
    act(() => clearLicense())
    expect(result.current.status).toBe('free')
    expect(window.localStorage.getItem(LICENSE_KEY)).toBeNull()
    expect(licenseToken()).toBeNull()
  })
})

describe('claimPayment', () => {
  const payment: PendingPayment = { orderId: 'order_1', paymentId: 'pay_1', signature: 'sig', plan: 'pro_yearly', at: 1 }

  beforeEach(() => {
    rememberBillingConfig({ licensePublicKey: signer.publicKey })
  })

  it('exchanges the payment for a license and stores it', async () => {
    const token = await signer.token({ id: 'pay_1' })
    routes['/api/billing/verify'] = () => json({ license: token })
    await expect(claimPayment(payment)).resolves.toMatchObject({ ok: true, license: { id: 'pay_1' } })
    expect(JSON.parse(String(calls('/api/billing/verify')[0]?.body))).toEqual({
      orderId: 'order_1',
      paymentId: 'pay_1',
      signature: 'sig',
    })
    expect(proState().status).toBe('pro')
    expect(readPendingPayment()).toBeNull()
  })

  it('retries a dropped connection, then keeps the payment for later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    routes['/api/billing/verify'] = () => json({ error: { code: 'upstream_error' } }, 502)
    const promise = claimPayment(payment)
    for (const delay of CLAIM_RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(delay)
    await expect(promise).resolves.toEqual({ ok: false, pending: true })
    expect(calls('/api/billing/verify')).toHaveLength(CLAIM_RETRY_DELAYS_MS.length + 1)
    expect(readPendingPayment()).toEqual(payment)
  })

  it('succeeds on a retry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const token = await signer.token({ id: 'pay_1' })
    let attempt = 0
    routes['/api/billing/verify'] = () => (++attempt === 1 ? json({}, 503) : json({ license: token }))
    const promise = claimPayment(payment)
    await vi.advanceTimersByTimeAsync(CLAIM_RETRY_DELAYS_MS[0] ?? 0)
    await expect(promise).resolves.toMatchObject({ ok: true })
    expect(readPendingPayment()).toBeNull()
  })

  it('gives up for good when the server rejects the payment', async () => {
    routes['/api/billing/verify'] = () => json({ error: { code: 'bad_request' } }, 400)
    await expect(claimPayment(payment)).resolves.toEqual({ ok: false, pending: false })
    expect(calls('/api/billing/verify')).toHaveLength(1)
    expect(readPendingPayment()).toBeNull()
    expect(proState().status).toBe('free')
  })

  it('refuses a license that the server’s current key says is not genuine', async () => {
    serveConfig(signer.publicKey)
    routes['/api/billing/verify'] = async () => json({ license: await other.token() })
    await expect(claimPayment(payment)).resolves.toEqual({ ok: false, pending: false })
    expect(proState().status).toBe('free')
    expect(readPendingPayment()).toBeNull()
  })

  it('checks a new license against the server’s current key when the remembered one is out of date', async () => {
    rememberBillingConfig({ licensePublicKey: other.publicKey })
    serveConfig(signer.publicKey)
    const token = await signer.token({ id: 'pay_1' })
    routes['/api/billing/verify'] = () => json({ license: token })
    await expect(claimPayment(payment)).resolves.toMatchObject({ ok: true, license: { id: 'pay_1' } })
    expect(licenseToken()).toBe(token)
  })

  it('keeps a paid license when only an unconfirmed remembered key doubts it', async () => {
    // Keys were rotated since the last visit and the config can't be fetched right now.
    rememberBillingConfig({ licensePublicKey: other.publicKey })
    const token = await signer.token({ id: 'pay_1' })
    routes['/api/billing/verify'] = () => json({ license: token })
    await expect(claimPayment(payment)).resolves.toMatchObject({ ok: true, license: { id: 'pay_1' } })
    expect(proState().status).toBe('pro')
    expect(readPendingPayment()).toBeNull()
  })

  it('claims a payment left over from an earlier visit on start', async () => {
    window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment))
    const token = await signer.token({ id: 'pay_1', plan: 'pro_lifetime', exp: null })
    routes['/api/billing/verify'] = () => json({ license: token })
    const { result } = renderHook(() => usePro())
    await waitFor(() => expect(result.current.status).toBe('pro'))
    expect(window.localStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
  })

  it('claims a leftover payment when the connection returns', async () => {
    window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment))
    const { result } = renderHook(() => usePro())
    await waitFor(() => expect(calls('/api/billing/verify')).toHaveLength(1))
    expect(result.current.status).toBe('free')
    const token = await signer.token({ id: 'pay_1' })
    routes['/api/billing/verify'] = () => json({ license: token })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.status).toBe('pro'))
  })

  it('resumes nothing when nothing is pending', async () => {
    await expect(resumePendingPayment()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
