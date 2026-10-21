import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, bytesToBase64Url, isBase64Url } from './base64url'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('base64url', () => {
  it('matches RFC 4648 test vectors (url alphabet, no padding)', () => {
    const vectors: Array<[string, string]> = [
      ['', ''],
      ['f', 'Zg'],
      ['fo', 'Zm8'],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg'],
      ['fooba', 'Zm9vYmE'],
      ['foobar', 'Zm9vYmFy'],
    ]
    for (const [plain, encoded] of vectors) {
      const bytes = new TextEncoder().encode(plain)
      expect(bytesToBase64Url(bytes)).toBe(encoded)
      expect(new TextDecoder().decode(base64UrlToBytes(encoded) ?? new Uint8Array())).toBe(plain)
    }
  })

  it('uses - and _ instead of + and /', () => {
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff, 0xbf]))).toBe('-_-_')
    expect(Array.from(base64UrlToBytes('-_-_') ?? [])).toEqual([0xfb, 0xff, 0xbf])
  })

  it('round-trips random bytes of every length', () => {
    const rand = seeded(7)
    for (let n = 0; n < 300; n++) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = Math.floor(rand() * 256)
      const text = bytesToBase64Url(bytes)
      expect(isBase64Url(text)).toBe(true)
      expect(text.length).toBe(Math.ceil((n * 4) / 3))
      expect(base64UrlToBytes(text)).toEqual(bytes)
    }
  })

  it('handles large inputs', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251)
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
  })

  it('tolerates standard-alphabet characters and padding that chat apps add', () => {
    expect(Array.from(base64UrlToBytes('+/+/') ?? [])).toEqual([0xfb, 0xff, 0xbf])
    expect(new TextDecoder().decode(base64UrlToBytes('Zm8=') ?? new Uint8Array())).toBe('fo')
    expect(new TextDecoder().decode(base64UrlToBytes('Zg==') ?? new Uint8Array())).toBe('f')
  })

  it('rejects characters outside the alphabet and impossible lengths', () => {
    expect(base64UrlToBytes('Zm9v!')).toBeNull()
    expect(base64UrlToBytes('Zm 9v')).toBeNull()
    expect(base64UrlToBytes('Zm9vé')).toBeNull()
    expect(base64UrlToBytes('Z')).toBeNull()
    expect(base64UrlToBytes('Zm9vY')).toBeNull()
    expect(isBase64Url('a.b')).toBe(false)
  })
})
