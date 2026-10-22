/** Pure-TS SHA-256 and HMAC-SHA256 against the published vectors and the claim-link vectors (spec 01 §4.3). */
import { describe, expect, it } from 'vitest'
import { randomB64u } from '../lib/ids'
import { base64UrlToBytes, bytesToBase64Url } from './base64url'
import { hmacSha256, macB64u, timingSafeEqual } from './hmac'
import { sha256, sha256Hex, toHex, utf8 } from './sha256'

describe('sha256 (FIPS 180-4 vectors)', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu', 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
    ['रिया', '27b0b2e0f273db085329bea700cb4db42dd59fbb4fb7ee21f6543db64b44dc41'],
  ])('sha256(%j)', (text, hex) => {
    expect(sha256Hex(text)).toBe(hex)
  })

  it('hashes 1,000,000 × "a"', () => {
    expect(toHex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
  })

  it('pads correctly around the 55/56/64-byte block edges', () => {
    // Lengths whose padding spills into an extra block, checked against known digests of "a" × n.
    expect(sha256Hex('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318')
    expect(sha256Hex('a'.repeat(56))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a')
    expect(sha256Hex('a'.repeat(64))).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb')
  })
})

describe('hmacSha256 (RFC 4231)', () => {
  it('case 1: 20 × 0x0b, "Hi There"', () => {
    expect(toHex(hmacSha256(new Uint8Array(20).fill(0x0b), 'Hi There'))).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })

  it('case 2: "Jefe", "what do ya want for nothing?"', () => {
    expect(toHex(hmacSha256('Jefe', 'what do ya want for nothing?'))).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  it('case 6: a 131-byte key (hashed first)', () => {
    expect(toHex(hmacSha256(new Uint8Array(131).fill(0xaa), 'Test Using Larger Than Block-Size Key - Hash Key First'))).toBe(
      '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
    )
  })
})

describe('link MACs (spec 01 §4.3 vectors)', () => {
  const canonical = 'q7Lr2xVb9K|e2738144e47b|1|Riya|1:1/2,2:1/4,4:1/1,5:1/2||54950|1792748400'

  it('signs a claim reply: m = 69uBM-ypy-Qpz3uu', () => {
    const m = macB64u('k3J9vQ2mXe8Ls1Wd0PzR4A', canonical)
    expect(m).toBe('69uBM-ypy-Qpz3uu')
    // replyId: base64url of the first 12 bytes of SHA-256(canonical + '|' + m).
    expect(bytesToBase64Url(sha256(utf8(`${canonical}|${m}`)).slice(0, 12))).toBe('_Yf8WGpd0FRub0Qi')
  })

  it('fingerprints the claim items: h = e2738144e47b', () => {
    const items: Array<[string, number, number?]> = [
      ['Butter Chicken', 45000],
      ['Paneer Tikka', 38000],
      ['Butter Naan', 24000, 4],
      ['Kingfisher Beer', 90000, 3],
      ['Fresh Lime Soda', 12000],
      ['Gulab Jamun', 15000],
    ]
    const canon = `INR|276600|${items.map(([n, a, q]) => `${n}\t${a}\t${q ?? 1}`).join('\n')}`
    expect(sha256Hex(canon).slice(0, 12)).toBe('e2738144e47b')
  })

  it('changes with any edit and keeps its length', () => {
    const m = macB64u('k3J9vQ2mXe8Ls1Wd0PzR4A', canonical)
    expect(macB64u('k3J9vQ2mXe8Ls1Wd0PzR4A', canonical.replace('54950', '54951'))).not.toBe(m)
    expect(macB64u('x3J9vQ2mXe8Ls1Wd0PzR4A', canonical)).not.toBe(m)
    expect(macB64u('k3J9vQ2mXe8Ls1Wd0PzR4A', canonical, 32)).toHaveLength(43)
  })

  it('compares MACs without short-circuiting', () => {
    expect(timingSafeEqual('69uBM-ypy-Qpz3uu', '69uBM-ypy-Qpz3uu')).toBe(true)
    expect(timingSafeEqual('69uBM-ypy-Qpz3uu', '69uBM-ypy-Qpz3uv')).toBe(false)
    expect(timingSafeEqual('69uBM-ypy-Qpz3uu', '69uBM-ypy-Qpz3u')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
    expect(timingSafeEqual('', 'a')).toBe(false)
    expect(timingSafeEqual('a', '')).toBe(false)
  })
})

describe('randomB64u', () => {
  it('makes base64url strings of the right length from random bytes', () => {
    const a = randomB64u(16)
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(base64UrlToBytes(a)).toHaveLength(16)
    expect(randomB64u(16)).not.toBe(a)
    expect(randomB64u(6)).toMatch(/^[A-Za-z0-9_-]{8}$/)
    expect(randomB64u(7)).toHaveLength(10)
    expect(randomB64u(0)).toBe('')
  })

  it('encodes exactly like bytesToBase64Url', () => {
    const real = crypto.getRandomValues
    try {
      const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7, 8])
      crypto.getRandomValues = (<T extends ArrayBufferView | null>(buf: T): T => {
        ;(buf as unknown as Uint8Array).set(bytes.slice(0, (buf as unknown as Uint8Array).length))
        return buf
      }) as typeof crypto.getRandomValues
      for (let n = 1; n <= bytes.length; n++) expect(randomB64u(n)).toBe(bytesToBase64Url(bytes.slice(0, n)))
    } finally {
      crypto.getRandomValues = real
    }
  })
})
