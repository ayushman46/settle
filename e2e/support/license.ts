/**
 * Pro license codes for tests, signed with the test-only key the E2E server runs with
 * (serve.mjs derives the same key from the same seed). Never used outside tests.
 */
import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto'
import { LICENSE_PREFIX, type LicensePayload, type PlanId } from '../../shared/api'

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

function testKey(): KeyObject {
  const seed = createHash('sha256').update('settle-e2e-test-license-key').digest()
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' })
}

const PRIVATE_KEY = testKey()

/** The public key as the server publishes it (`BillingConfig.licensePublicKey`). */
export const TEST_LICENSE_PUBLIC_KEY = createPublicKey(PRIVATE_KEY).export({ type: 'spki', format: 'der' }).toString('base64')

const DAY_SECONDS = 86_400
const PLAN_DAYS: Record<PlanId, number | null> = { pro_monthly: 30, pro_yearly: 365, pro_lifetime: null }

/** A signed license token, valid from now for the plan's length (or `days`). */
export function testLicense(plan: PlanId = 'pro_yearly', options: { id?: string; days?: number | null; issuedAt?: number } = {}): string {
  const iat = options.issuedAt ?? Math.floor(Date.now() / 1000)
  const days = options.days === undefined ? PLAN_DAYS[plan] : options.days
  const payload: LicensePayload = { id: options.id ?? `e2e-${plan}`, plan, iat, exp: days === null ? null : iat + days * DAY_SECONDS }
  const signed = `${LICENSE_PREFIX}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
  return `${signed}.${sign(null, Buffer.from(signed, 'ascii'), PRIVATE_KEY).toString('base64url')}`
}
