import { describe, expect, it } from 'vitest'
import type { BillingConfig } from '../../shared/api'
import type { License, PlanId, ProFeature } from '../domain/types'
import * as pro from './index'

/* Compile-time checks that the public API matches the v3 contract (spec §5.5). */
const contract: {
  verifyLicenseToken: (token: string, publicKeySpkiB64: string | null) => Promise<License | null>
  isLicenseActive: (l: License | null, nowSec?: number) => boolean
  usePro: () => {
    isPro: boolean
    license: License | null
    status: 'loading' | 'free' | 'pro' | 'expired'
    expiresAt: number | null
  }
  hasFeature: (f: ProFeature) => boolean
  useHasFeature: (f: ProFeature) => boolean
  redeemLicense: (
    token: string,
  ) => Promise<{ ok: true; license: License } | { ok: false; reason: 'invalid' | 'expired' | 'network' }>
  clearLicense: () => void
  licenseToken: () => string | null
  useBillingConfig: () => BillingConfig | null
  startCheckout: (
    plan: PlanId,
    opts?: { name?: string; contact?: string },
  ) => Promise<
    | { status: 'success'; license: License }
    | { status: 'cancelled' }
    | { status: 'failed'; message: string }
    | { status: 'unavailable' }
  >
  useAiQuota: () => { used: number; limit: number; remaining: number; canUse: boolean; consume(): void }
} = pro

describe('the Pro entry point', () => {
  it('exposes the contract', () => {
    const names = [
      'verifyLicenseToken',
      'isLicenseActive',
      'usePro',
      'hasFeature',
      'useHasFeature',
      'redeemLicense',
      'clearLicense',
      'licenseToken',
      'useBillingConfig',
      'startCheckout',
      'useAiQuota',
    ] as const satisfies ReadonlyArray<keyof typeof contract>
    for (const name of names) expect(typeof contract[name]).toBe('function')
  })

  it('names the license header the server reads', () => {
    expect(pro.LICENSE_HEADER).toBe('X-Settle-License')
  })
})
