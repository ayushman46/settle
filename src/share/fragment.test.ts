/** The shared `#fragment` codec: round trips, the plain-JSON fallback, chat-app damage and size caps. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bytesToBase64Url } from './base64url'
import { decodeFragment, encodeFragment, fragmentOf, JSON_PREFIX, MAX_FRAGMENT_LENGTH } from './fragment'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('encodeFragment / decodeFragment', () => {
  it('round-trips JSON, compressing when that is shorter', async () => {
    const json = JSON.stringify({ v: 1, k: 'claim', items: Array.from({ length: 30 }, (_, i) => ({ n: `Butter Naan ${i}`, a: 6000 })) })
    const fragment = await encodeFragment(json)
    expect(fragment.startsWith(JSON_PREFIX)).toBe(false)
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decodeFragment(`https://settle.example/claim#${fragment}`, 16 * 1024)).toBe(json)
    expect(await decodeFragment(`#${fragment}`, 16 * 1024)).toBe(json)
    expect(await decodeFragment(fragment, 16 * 1024)).toBe(json)
  })

  it('uses plain JSON for tiny payloads (shorter) and when the browser cannot compress', async () => {
    expect(await encodeFragment('{}')).toBe(`${JSON_PREFIX}${bytesToBase64Url(new TextEncoder().encode('{}'))}`)
    vi.stubGlobal('CompressionStream', undefined)
    const json = JSON.stringify({ text: 'रिया '.repeat(50) })
    const fragment = await encodeFragment(json)
    expect(fragment.startsWith(JSON_PREFIX)).toBe(true)
    expect(await decodeFragment(fragment, 16 * 1024)).toBe(json)
  })

  it('decodes with the bundled inflater when the browser has no DecompressionStream', async () => {
    const json = JSON.stringify({ text: 'Kingfisher '.repeat(40) })
    const fragment = await encodeFragment(json)
    vi.stubGlobal('DecompressionStream', undefined)
    expect(await decodeFragment(fragment, 16 * 1024)).toBe(json)
  })

  it('survives what chat apps do to links', async () => {
    const json = JSON.stringify({ hello: 'world '.repeat(30) })
    const fragment = await encodeFragment(json)
    for (const damaged of [`https://x.test/pool#${fragment})`, `https://x.test/pool#${fragment}.`, `https://x.test/pool#${fragment}?utm_source=wa`, ` #${fragment} `, `#${encodeURIComponent(fragment)}`]) {
      expect(await decodeFragment(damaged, 16 * 1024), damaged).toBe(json)
    }
  })

  it('refuses corrupt, truncated, non-UTF-8 and oversized fragments', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(20_000) })
    const bigFragment = await encodeFragment(big)
    expect(await decodeFragment(bigFragment, 16 * 1024)).toBeNull()
    expect(await decodeFragment(bigFragment, 32 * 1024)).toBe(big)
    const plainBig = `${JSON_PREFIX}${bytesToBase64Url(new TextEncoder().encode(big))}`
    expect(await decodeFragment(plainBig, 16 * 1024)).toBeNull()
    const ok = await encodeFragment(JSON.stringify({ a: 'b'.repeat(200) }))
    for (const bad of ['', '#', '#!!!', ok.slice(0, ok.length / 2), `${JSON_PREFIX}${bytesToBase64Url(Uint8Array.from([0xff, 0xfe, 0xfd]))}`, '#%E0%A4%A']) {
      expect(await decodeFragment(bad, 16 * 1024), bad).toBeNull()
    }
    expect(await decodeFragment(`#${'A'.repeat(MAX_FRAGMENT_LENGTH + 1)}`, 16 * 1024)).toBeNull()
    expect(await decodeFragment(42 as unknown as string, 16 * 1024)).toBeNull()
  })

  it('fragmentOf picks the payload out of a URL', () => {
    expect(fragmentOf('https://a.test/pay#abc_-DEF')).toBe('abc_-DEF')
    expect(fragmentOf('j.eyJ9')).toBe('j.eyJ9')
    expect(fragmentOf('nothing here!')).toBe('nothing')
    expect(fragmentOf('#')).toBeNull()
    expect(fragmentOf('x'.repeat(MAX_FRAGMENT_LENGTH * 4))).toBeNull()
  })
})
