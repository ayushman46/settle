/**
 * HMAC-SHA256 (RFC 2104) on the synchronous `sha256`, for signing replies to claim and pool links:
 * the link carries a random secret, the reply carries a short MAC of its canonical text, so a
 * garbled, edited or mixed-up reply is caught. (It can't stop a friend picking someone else's
 * name — the copy says so.)
 */
import { base64UrlToBytes, bytesToBase64Url } from './base64url'
import { sha256, utf8 } from './sha256'

const BLOCK = 64

function bytesOf(value: Uint8Array | string): Uint8Array {
  return typeof value === 'string' ? utf8(value) : value
}

/** HMAC-SHA256 of `message` (UTF-8 when a string) under `key` (UTF-8 when a string). 32 bytes. */
export function hmacSha256(key: Uint8Array | string, message: Uint8Array | string): Uint8Array {
  let k = bytesOf(key)
  if (k.length > BLOCK) k = sha256(k)
  const block = new Uint8Array(BLOCK)
  block.set(k)
  const inner = new Uint8Array(BLOCK)
  const outer = new Uint8Array(BLOCK)
  for (let i = 0; i < BLOCK; i++) {
    const b = block[i] ?? 0
    inner[i] = b ^ 0x36
    outer[i] = b ^ 0x5c
  }
  const msg = bytesOf(message)
  const innerInput = new Uint8Array(BLOCK + msg.length)
  innerInput.set(inner)
  innerInput.set(msg, BLOCK)
  const innerHash = sha256(innerInput)
  const outerInput = new Uint8Array(BLOCK + innerHash.length)
  outerInput.set(outer)
  outerInput.set(innerHash, BLOCK)
  return sha256(outerInput)
}

/**
 * A link MAC: the first `bytes` (default 12) bytes of HMAC-SHA256(secret, canonical) as base64url
 * (12 bytes → 16 characters). `secretB64u` is the link's base64url secret (its bytes are the key);
 * an undecodable secret is used as text.
 */
export function macB64u(secretB64u: string, canonical: string, bytes = 12): string {
  const key = base64UrlToBytes(secretB64u) ?? utf8(secretB64u)
  return bytesToBase64Url(hmacSha256(key, canonical).slice(0, Math.max(1, Math.min(32, Math.trunc(bytes)))))
}

/** Compares two strings in time that depends only on their lengths (for MACs). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0)
  return diff === 0
}
