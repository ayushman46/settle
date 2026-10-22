function hex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/**
 * A random v4 UUID. Uses `crypto.randomUUID` when available; it is missing on plain-http LAN
 * origins (not a secure context), so fall back to `getRandomValues`, then `Math.random`.
 */
export function newId(): string {
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40 // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80 // RFC 4122 variant
  const h = hex(bytes)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * `bytes` random bytes as unpadded base64url (16 bytes → 22 characters): secrets and short ids in
 * share links. Uses `crypto.getRandomValues` (available on every origin, secure or not).
 */
export function randomB64u(bytes: number): string {
  const n = Math.max(0, Math.trunc(bytes))
  const buf = new Uint8Array(n)
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(buf)
  else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256)
  let out = ''
  for (let i = 0; i < n; i += 3) {
    const a = buf[i] ?? 0
    const b = buf[i + 1] ?? 0
    const d = buf[i + 2] ?? 0
    const triple = (a << 16) | (b << 8) | d
    const chars = i + 2 < n ? 4 : i + 1 < n ? 3 : 2
    for (let k = 0; k < chars; k++) out += B64U[(triple >> (18 - 6 * k)) & 63]
  }
  return out
}
