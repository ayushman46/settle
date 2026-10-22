/**
 * Pro licenses without a database: Ed25519-signed tokens the server issues after a verified
 * payment (or the owner issues as promo codes with `npm run license`). Anyone holding the
 * public key can check one — the browser does it offline with WebCrypto.
 *
 * Token: `SETTLE1.<base64url(JSON {id, plan, iat, exp})>.<base64url(signature)>`, the signature
 * covering the ASCII bytes `SETTLE1.<base64url payload>`. scripts/license.mjs mirrors this file.
 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { z } from 'zod'
import { LICENSE_PREFIX, PLAN_IDS, type LicensePayload, type PlanId } from '../shared/api'
import { PLAN_DAYS } from './plans'

export interface LicenseKeys {
  /** Signs new licenses. Null: this server can't issue any (checkout stays off). */
  privateKey: KeyObject | null
  /** Checks licenses. Derived from the private key when only that is configured. */
  publicKey: KeyObject | null
  /** The public key as SPKI DER in standard base64, for the browser. */
  publicKeySpki: string | null
}

export const NO_LICENSE_KEYS: LicenseKeys = Object.freeze({ privateKey: null, publicKey: null, publicKeySpki: null })

/** Longer than any real token (~200 chars): don't spend a signature check on junk. */
export const MAX_TOKEN_LENGTH = 1024
const MAX_ID_LENGTH = 100
const SIGNATURE_BYTES = 64
const BASE64URL = /^[A-Za-z0-9_-]+$/
const DAY_SECONDS = 86_400

const PayloadSchema = z
  .object({
    id: z.string().min(1).max(MAX_ID_LENGTH),
    plan: z.enum(PLAN_IDS as [PlanId, ...PlanId[]]),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive().nullable(),
  })
  .refine((license) => license.exp === null || license.exp > license.iat)

/* ------------------------------------------------------------------ keys */

/** `\n` written literally (one-line .env values) → real newlines; strips quotes and spaces. */
function unescapeKey(raw: string): string {
  const trimmed = raw.trim().replace(/^(["'])([\s\S]*)\1$/, '$2')
  return trimmed.replace(/\\n/g, '\n').trim()
}

function isEd25519(key: KeyObject): boolean {
  return key.asymmetricKeyType === 'ed25519'
}

/** Ed25519 private key from PKCS#8 PEM or base64 DER. Null when blank, malformed or another key type. */
export function parsePrivateKey(raw: string | undefined): KeyObject | null {
  if (raw === undefined) return null
  const text = unescapeKey(raw)
  if (text === '') return null
  try {
    const key = text.includes('-----BEGIN')
      ? createPrivateKey({ key: text, format: 'pem' })
      : createPrivateKey({ key: Buffer.from(text.replace(/\s+/g, ''), 'base64'), format: 'der', type: 'pkcs8' })
    return isEd25519(key) ? key : null
  } catch {
    return null
  }
}

/** Ed25519 public key from SPKI base64 DER or PEM. Null when blank, malformed or another key type. */
export function parsePublicKey(raw: string | undefined): KeyObject | null {
  if (raw === undefined) return null
  const text = unescapeKey(raw)
  if (text === '') return null
  try {
    const key = text.includes('-----BEGIN')
      ? createPublicKey({ key: text, format: 'pem' })
      : createPublicKey({ key: Buffer.from(text.replace(/\s+/g, ''), 'base64'), format: 'der', type: 'spki' })
    return isEd25519(key) ? key : null
  } catch {
    return null
  }
}

export function spkiBase64(publicKey: KeyObject): string {
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
}

/** Blank, or what people type into a hosting dashboard's required field for "not yet" ("none", "-"…). */
function isUnset(raw: string | undefined): boolean {
  return /^\s*(?:|["']{2}|none|null|undefined|n\/a|na|-+|todo|skip|later|changeme)\s*$/i.test(raw ?? '')
}

/**
 * Reads `LICENSE_PRIVATE_KEY` / `LICENSE_PUBLIC_KEY`. The public key is derived from the
 * private one when absent — and when the two don't match, since only the derived one can
 * check what this server signs.
 * @returns the keys, plus notes for the operator about anything ignored.
 */
export function loadLicenseKeys(privateRaw: string | undefined, publicRaw: string | undefined): { keys: LicenseKeys; problems: string[] } {
  const problems: string[] = []
  const privateKey = parsePrivateKey(privateRaw)
  if (privateKey === null && !isUnset(privateRaw)) {
    problems.push('LICENSE_PRIVATE_KEY is not an Ed25519 private key (PKCS#8 PEM or base64 DER) — run "npm run license keygen".')
  }
  let publicKey = parsePublicKey(publicRaw)
  if (publicKey === null && !isUnset(publicRaw)) {
    problems.push('LICENSE_PUBLIC_KEY is not an Ed25519 public key (SPKI base64 or PEM).')
  }
  if (privateKey !== null) {
    const derived = createPublicKey(privateKey)
    if (publicKey !== null && spkiBase64(publicKey) !== spkiBase64(derived)) {
      problems.push("LICENSE_PUBLIC_KEY doesn't match LICENSE_PRIVATE_KEY — using the key derived from the private key.")
    }
    publicKey = derived
  }
  return { keys: { privateKey, publicKey, publicKeySpki: publicKey ? spkiBase64(publicKey) : null }, problems }
}

/* ------------------------------------------------------------------ tokens */

/** When a pass bought (or issued) at `iat` runs out: `days` overrides the plan's own length. */
export function licenseExpiry(plan: PlanId, iat: number, days?: number | null): number | null {
  const length = days === undefined ? PLAN_DAYS[plan] : days
  return length === null ? null : iat + length * DAY_SECONDS
}

export function signLicense(payload: LicensePayload, privateKey: KeyObject): string {
  const license = PayloadSchema.parse(payload)
  const body = Buffer.from(JSON.stringify({ id: license.id, plan: license.plan, iat: license.iat, exp: license.exp })).toString('base64url')
  const signed = `${LICENSE_PREFIX}.${body}`
  return `${signed}.${sign(null, Buffer.from(signed, 'ascii'), privateKey).toString('base64url')}`
}

export type LicenseCheck = { valid: true; active: boolean; license: LicensePayload } | { valid: false; active: false; license: null }

const INVALID: LicenseCheck = Object.freeze({ valid: false, active: false, license: null })

export function isActive(license: LicensePayload, nowSeconds: number): boolean {
  return license.iat <= nowSeconds + DAY_SECONDS && (license.exp === null || license.exp > nowSeconds)
}

/**
 * Checks a token's signature and shape. Never throws. `active` also needs it unexpired — and not
 * issued more than a day in the future (clock skew is fine; a forged far-future `iat` isn't).
 */
export function verifyLicense(token: unknown, publicKey: KeyObject, nowSeconds: number): LicenseCheck {
  if (typeof token !== 'string') return INVALID
  const trimmed = token.trim()
  if (trimmed.length > MAX_TOKEN_LENGTH) return INVALID
  const parts = trimmed.split('.')
  if (parts.length !== 3) return INVALID
  const [prefix = '', body = '', signature = ''] = parts
  if (prefix !== LICENSE_PREFIX || !BASE64URL.test(body) || !BASE64URL.test(signature)) return INVALID

  const signatureBytes = Buffer.from(signature, 'base64url')
  if (signatureBytes.length !== SIGNATURE_BYTES || signatureBytes.toString('base64url') !== signature) return INVALID
  try {
    if (!verify(null, Buffer.from(`${prefix}.${body}`, 'ascii'), publicKey, signatureBytes)) return INVALID
    const parsed = PayloadSchema.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')))
    if (!parsed.success) return INVALID
    return { valid: true, active: isActive(parsed.data, nowSeconds), license: parsed.data }
  } catch {
    return INVALID
  }
}
