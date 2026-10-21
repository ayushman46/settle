/**
 * URL-safe Base64 (RFC 4648 §5) without padding, for putting bytes in a link's `#fragment`.
 * Pure JS so it behaves the same everywhere (no `btoa` binary-string pitfalls).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** char code → 6-bit value, or -1 for anything outside the alphabet. */
const LOOKUP: Int8Array = (() => {
  const table = new Int8Array(128).fill(-1)
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i
  return table
})()

/** True when every character is in the base64url alphabet (an empty string counts). */
export function isBase64Url(text: string): boolean {
  return /^[A-Za-z0-9_-]*$/.test(text)
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  const parts: string[] = []
  let chunk = ''
  let i = 0
  const full = bytes.length - (bytes.length % 3)
  for (; i < full; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    chunk +=
      ALPHABET.charAt((n >> 18) & 63) +
      ALPHABET.charAt((n >> 12) & 63) +
      ALPHABET.charAt((n >> 6) & 63) +
      ALPHABET.charAt(n & 63)
    // Join in slices so very long inputs don't build one huge rope string.
    if (chunk.length >= 8192) {
      parts.push(chunk)
      chunk = ''
    }
  }
  const rest = bytes.length - full
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16
    chunk += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63)
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8)
    chunk += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63) + ALPHABET.charAt((n >> 6) & 63)
  }
  parts.push(chunk)
  return parts.join('')
}

/**
 * Decodes base64url (standard `+`/`/` and trailing `=` padding are tolerated, since some chat
 * apps rewrite links). Returns null for anything that isn't valid Base64. Never throws.
 */
export function base64UrlToBytes(text: string): Uint8Array | null {
  const clean = text.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  if (clean.length % 4 === 1) return null
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let o = 0
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i)
    const value = code < 128 ? (LOOKUP[code] ?? -1) : -1
    if (value < 0) return null
    buffer = ((buffer << 6) | value) & 0xffffff
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[o++] = (buffer >> bits) & 0xff
    }
  }
  return o === out.length ? out : out.slice(0, o)
}
