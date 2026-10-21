/**
 * Is this licence genuine? Checked on the device with WebCrypto Ed25519 against the server's
 * public key; browsers without Ed25519 (or without WebCrypto, e.g. plain-http LAN testing) ask
 * the server instead (`POST /api/license/verify`).
 */
import type { License } from '../domain/types'
import { callApi, isRecord } from '../api/http'
import { base64ToBytes, parseLicensePayload, parseLicenseToken, type ParsedLicenseToken } from './token'

/** How long the server check may take before we call it "couldn't check". */
export const LICENSE_VERIFY_TIMEOUT_MS = 10_000

export type LicenseCheck =
  /** Genuine (it may still be expired — see `isLicenseActive`). */
  | { status: 'valid'; license: License }
  /** Malformed, forged, or signed by a different key. */
  | { status: 'invalid' }
  /** Couldn't tell: no key and the server is unreachable or can't verify right now. */
  | { status: 'unverified' }

const ED25519 = { name: 'Ed25519' } as const

/** Imported keys by their base64 SPKI; a failed import is remembered as null. */
const keyCache = new Map<string, Promise<CryptoKey | null>>()

function subtleCrypto(): SubtleCrypto | null {
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto
  return c?.subtle && typeof c.subtle.verify === 'function' ? c.subtle : null
}

function importKey(subtle: SubtleCrypto, spkiB64: string): Promise<CryptoKey | null> {
  const cached = keyCache.get(spkiB64)
  if (cached) return cached
  const der = base64ToBytes(spkiB64)
  const imported = der
    ? subtle.importKey('spki', der, ED25519, false, ['verify']).catch(() => null)
    : Promise.resolve(null)
  keyCache.set(spkiB64, imported)
  return imported
}

/** true/false when the device could check the signature; null when it can't (no Ed25519, bad key). */
async function verifyOnDevice(parsed: ParsedLicenseToken, spkiB64: string): Promise<boolean | null> {
  const subtle = subtleCrypto()
  if (!subtle) return null
  const key = await importKey(subtle, spkiB64)
  if (!key) return null
  try {
    return await subtle.verify(ED25519, key, parsed.signature, parsed.signed)
  } catch {
    return null
  }
}

function sameLicense(a: License, b: License): boolean {
  return a.id === b.id && a.plan === b.plan && a.iat === b.iat && a.exp === b.exp
}

async function verifyOnServer(parsed: ParsedLicenseToken, signal?: AbortSignal): Promise<LicenseCheck> {
  const result = await callApi('/api/license/verify', {
    body: { license: parsed.token },
    timeoutMs: LICENSE_VERIFY_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) {
    // A 4xx about the token itself is a verdict; anything else (offline, 429, 503…) isn't.
    const verdict = result.kind === 'http' && (result.status === 400 || result.status === 422)
    return verdict ? { status: 'invalid' } : { status: 'unverified' }
  }
  const body = result.body
  if (!isRecord(body) || typeof body.valid !== 'boolean') return { status: 'unverified' }
  if (!body.valid) return { status: 'invalid' }
  // The server decoded the same claims we did — anything else means we're out of step.
  const claims = parseLicensePayload(body.license)
  if (claims && !sameLicense(claims, parsed.license)) return { status: 'unverified' }
  return { status: 'valid', license: parsed.license }
}

/**
 * Checks a token, telling "forged/garbled" apart from "couldn't check right now".
 * `publicKeySpkiB64` is the server's Ed25519 key (base64 SPKI DER) from the billing config;
 * null sends the token to the server.
 */
export async function checkLicenseToken(
  token: string,
  publicKeySpkiB64: string | null,
  signal?: AbortSignal,
): Promise<LicenseCheck> {
  const parsed = parseLicenseToken(token)
  if (!parsed) return { status: 'invalid' }
  if (publicKeySpkiB64) {
    const genuine = await verifyOnDevice(parsed, publicKeySpkiB64)
    if (genuine !== null) return genuine ? { status: 'valid', license: parsed.license } : { status: 'invalid' }
  }
  return verifyOnServer(parsed, signal)
}

/** The licence a genuine token carries (expired or not), or null when it's not genuine or can't be checked. */
export async function verifyLicenseToken(token: string, publicKeySpkiB64: string | null): Promise<License | null> {
  const check = await checkLicenseToken(token, publicKeySpkiB64)
  return check.status === 'valid' ? check.license : null
}

/** True while the licence grants Pro: lifetime, or not yet past `exp` (epoch seconds). */
export function isLicenseActive(l: License | null, nowSec: number = Date.now() / 1000): boolean {
  if (!l) return false
  return l.exp === null || l.exp > nowSec
}

/** Forgets imported keys (tests). */
export function resetLicenseKeysForTests(): void {
  keyCache.clear()
}
