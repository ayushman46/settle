/* eslint-disable react-refresh/only-export-components -- test-only helpers (render kit + fake server), never part of the app bundle. */
/**
 * Test support for the Pro, Insights and Recurring screens: a fake `/api` (billing config,
 * license checks), a clean slate for every module with memory, real signed licenses, and a
 * render kit with the app's providers at a given URL.
 */
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { BillingConfig } from '../../../shared/api'
import { resetNavForTests } from '../../app/router'
import { ToastProvider } from '../../components'
import { resetDataForTests } from '../../data'
import type { License } from '../../domain/types'
import { resetHapticsForTests } from '../../lib/haptics'
import { FALLBACK_BILLING_CONFIG } from '../../pro'
import { resetBillingForTests } from '../../pro/billing'
import { resetQuotaForTests } from '../../pro/quota'
import { createTestSigner, installLicense, resetProModulesForTests, type TestSigner } from '../../pro/testKit'
import { resetPaywallForTests } from './paywall'

export { DAY_SECONDS } from '../../pro/testKit'

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

export const fetchMock = vi.fn<typeof fetch>()
const routes = new Map<string, Handler>()

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Answers `url` (exact match) with `handler` until the next `resetProScreens()`. */
export function route(url: string, handler: Handler): void {
  routes.set(url, handler)
}

let signer: TestSigner | null = null

/** One real Ed25519 keypair per test file (generating keys is slow-ish). */
export async function testSigner(): Promise<TestSigner> {
  signer ??= await createTestSigner()
  return signer
}

/** Serves `GET /api/billing/config` as this server would: the launch plans, signed by the test key. */
export function serveBilling(patch: Partial<BillingConfig> = {}): void {
  route('/api/billing/config', () =>
    json({ ...FALLBACK_BILLING_CONFIG, licensePublicKey: signer?.publicKey ?? null, ...patch }),
  )
}

/** Puts a genuine license on the device (defaults: a yearly pass issued now). */
export async function installPro(claims: Partial<License> = {}): Promise<string> {
  const keys = await testSigner()
  const token = await keys.token(claims)
  installLicense(token, keys.publicKey)
  return token
}

/** A clean slate: data, Pro (license, config, checkout, AI quota), the paywall, navigation and the fake server. */
export function resetProScreens(): void {
  routes.clear()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url, init) => {
    const handler = routes.get(String(url))
    if (!handler) throw new TypeError(`Failed to fetch ${String(url)}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  resetDataForTests()
  resetProModulesForTests()
  resetBillingForTests()
  resetQuotaForTests()
  resetPaywallForTests()
  resetHapticsForTests()
  window.history.replaceState(null, '', '/')
  resetNavForTests()
}

/** Renders `ui` inside the app's providers with the address bar at `path`. */
export function renderAt(path: string, ui: ReactElement) {
  window.history.replaceState(null, '', path)
  resetNavForTests()
  const user = userEvent.setup()
  const utils = render(<ToastProvider>{ui}</ToastProvider>)
  return { user, ...utils }
}

/** The current in-app address (path + query + hash). */
export function currentUrl(): string {
  return window.location.pathname + window.location.search + window.location.hash
}
