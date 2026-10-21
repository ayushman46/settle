/**
 * Test helpers (never imported by the app): a real Ed25519 keypair that signs Settle license
 * tokens exactly like the server and the promo-code CLI, plus a way to put one on the "device".
 */
import type { BillingConfig } from '../../shared/api'
import type { License } from '../domain/types'
import { BILLING_CACHE_KEY, FALLBACK_BILLING_CONFIG, resetBillingConfigForTests } from './config'
import { resetLicenseKeysForTests } from './license'
import { LICENSE_KEY, resetProForTests } from './store'
import { bytesToBase64Url, LICENSE_PREFIX } from './token'

export const DAY_SECONDS = 86_400

export interface TestSigner {
  /** SPKI DER, standard base64 — what `BillingConfig.licensePublicKey` carries. */
  publicKey: string
  /** Signs any payload (even a malformed one) into a `SETTLE1.…` token. */
  signPayload(payload: unknown): Promise<string>
  /** A token for `claims` (defaults: a yearly pass issued now). */
  token(claims?: Partial<License>): Promise<string>
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function ascii(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

export async function createTestSigner(): Promise<TestSigner> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  const signPayload = async (payload: unknown): Promise<string> => {
    const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
    const signed = `${LICENSE_PREFIX}.${body}`
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, ascii(signed)))
    return `${signed}.${bytesToBase64Url(signature)}`
  }
  return {
    publicKey: toBase64(spki),
    signPayload,
    token: (claims = {}) => {
      const iat = claims.iat ?? Math.floor(Date.now() / 1000)
      const license: License = {
        id: claims.id ?? 'pay_test123',
        plan: claims.plan ?? 'pro_yearly',
        iat,
        exp: claims.exp === undefined ? iat + 365 * DAY_SECONDS : claims.exp,
      }
      return signPayload(license)
    },
  }
}

/** Remembers a billing config on the device, as if the server had sent it on an earlier visit. */
export function rememberBillingConfig(patch: Partial<BillingConfig>): void {
  window.localStorage.setItem(BILLING_CACHE_KEY, JSON.stringify({ ...FALLBACK_BILLING_CONFIG, ...patch }))
  resetBillingConfigForTests()
}

/**
 * Puts `token` on the device as the stored license, with `publicKey` remembered so the quiet
 * re-check happens on the device (no network). Resets the Pro stores so they re-read it.
 */
export function installLicense(token: string, publicKey: string): void {
  window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
  rememberBillingConfig({ licensePublicKey: publicKey })
  resetProForTests()
}

/** Forgets everything the Pro modules hold in memory (call in `beforeEach`). */
export function resetProModulesForTests(): void {
  resetProForTests()
  resetBillingConfigForTests()
  resetLicenseKeysForTests()
}
