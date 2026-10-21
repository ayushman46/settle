/**
 * The Settle licence token, as issued by the server (purchases) and the CLI (promo codes):
 *
 *   SETTLE1.<base64url(JSON {id, plan, iat, exp})>.<base64url(Ed25519 signature)>
 *
 * The signature covers the ASCII bytes of "SETTLE1.<payload>". This module only reads the
 * format — whether a token is genuine is `license.ts`'s job.
 */
import { LICENSE_PREFIX, PLAN_IDS } from '../../shared/api'
import type { License, PlanId } from '../domain/types'

export { LICENSE_HEADER, LICENSE_PREFIX, PLAN_IDS } from '../../shared/api'

/** Longest token we accept; real ones are ~200 characters. */
export const MAX_TOKEN_LENGTH = 2048

/** Longest licence id we accept (payment ids and promo code ids are far shorter). */
const MAX_ID_LENGTH = 128

const ED25519_SIGNATURE_BYTES = 64

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value)
}

/** Decodes standard base64 (padding optional); null when it isn't valid base64. */
export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> | null {
  const clean = text.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null
  const bare = clean.replace(/=+$/, '')
  if (bare.length % 4 === 1) return null
  try {
    const binary = atob(bare.padEnd(Math.ceil(bare.length / 4) * 4, '='))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Decodes unpadded base64url (RFC 4648 §5); null when it isn't valid. */
export function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  return base64ToBytes(text.replace(/-/g, '+').replace(/_/g, '/'))
}

/** Encodes bytes as unpadded base64url. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function asciiBytes(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0x7f
  return bytes
}

function isEpochSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** Validates a decoded payload; extra fields are ignored. */
export function parseLicensePayload(value: unknown): License | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const { id, plan, iat, exp } = value as Record<string, unknown>
  if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) return null
  if (!isPlanId(plan) || !isEpochSeconds(iat)) return null
  if (exp !== null && !(isEpochSeconds(exp) && exp > iat)) return null
  return { id, plan, iat, exp }
}

export interface ParsedLicenseToken {
  /** The token exactly as it will be stored and sent. */
  token: string
  /** What the token claims — not yet proven genuine. */
  license: License
  /** The bytes the signature covers: ASCII "SETTLE1.<payload>". */
  signed: Uint8Array<ArrayBuffer>
  signature: Uint8Array<ArrayBuffer>
}

/** Reads a token's structure and claims, or null when it isn't a well-formed Settle token. */
export function parseLicenseToken(token: string): ParsedLicenseToken | null {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [prefix, payload, sig] = parts as [string, string, string]
  if (prefix !== LICENSE_PREFIX || !payload || !sig) return null

  const signature = base64UrlToBytes(sig)
  if (!signature || signature.length !== ED25519_SIGNATURE_BYTES) return null
  const payloadBytes = base64UrlToBytes(payload)
  if (!payloadBytes) return null

  let claims: unknown
  try {
    claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes))
  } catch {
    return null
  }
  const license = parseLicensePayload(claims)
  if (!license) return null
  return { token, license, signed: asciiBytes(`${prefix}.${payload}`), signature }
}

const TOKEN_IN_TEXT = /SETTLE1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi

function uriDecoded(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/**
 * Finds a token in whatever was pasted: the bare code, a message around it, a link that carries
 * it, a code a chat app wrapped onto several lines. The prefix is case-insensitive (people retype
 * it); the rest isn't. Prefers a candidate that is a well-formed token; null when there's none.
 */
export function extractLicenseToken(input: string): string | null {
  if (typeof input !== 'string') return null
  const text = input.slice(0, MAX_TOKEN_LENGTH * 4).replace(/[\u200B-\u200D\uFEFF]/g, '')
  // As written first (so words after the code aren't glued onto it), then with line breaks removed.
  const joined = text.replace(/\s+/g, '')
  const sources = [text, uriDecoded(text), joined, uriDecoded(joined)]
  let first: string | null = null
  for (const source of sources) {
    for (const match of source.matchAll(TOKEN_IN_TEXT)) {
      const token = LICENSE_PREFIX + match[0].slice(LICENSE_PREFIX.length)
      if (token.length > MAX_TOKEN_LENGTH) continue
      if (parseLicenseToken(token)) return token
      first ??= token
    }
  }
  return first
}
