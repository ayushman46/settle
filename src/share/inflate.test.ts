import { describe, expect, it } from 'vitest'
import { InflateError, inflateRaw } from './inflate'

/** Compresses with the platform's own deflate-raw so the decoder is checked against zlib output. */
async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  void writer.write(bytes as Uint8Array<ArrayBuffer>)
  void writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const encode = (text: string) => new TextEncoder().encode(text)

describe('inflateRaw', () => {
  it('decodes fixed-Huffman blocks (short inputs)', async () => {
    for (const text of ['', 'a', 'hello', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{"v":1,"t":"Chai"}']) {
      const packed = await deflateRaw(encode(text))
      expect(new TextDecoder().decode(inflateRaw(packed, 1 << 20))).toBe(text)
    }
  })

  it('decodes dynamic-Huffman blocks (long repetitive JSON)', async () => {
    const people = Array.from({ length: 40 }, (_, i) => ({ n: `Friend ${i} ✨ नमस्ते`, a: 12_345 + i * 7, paid: i % 3 === 0 }))
    const text = JSON.stringify({ v: 1, t: 'Goa trip 🏖️', p: people })
    const packed = await deflateRaw(encode(text))
    expect(packed.length).toBeLessThan(text.length / 2)
    expect(new TextDecoder().decode(inflateRaw(packed, 1 << 20))).toBe(text)
  })

  it('decodes stored blocks (incompressible bytes) and long back-references', async () => {
    const rand = seeded(42)
    const noise = new Uint8Array(70_000).map(() => Math.floor(rand() * 256))
    expect(inflateRaw(await deflateRaw(noise), 1 << 20)).toEqual(noise)

    const runs = new Uint8Array(200_000).map((_, i) => (i % 40_000 < 20_000 ? 65 : (i * 31) % 256))
    expect(inflateRaw(await deflateRaw(runs), 1 << 20)).toEqual(runs)
  })

  it('round-trips many random texts', async () => {
    const rand = seeded(1)
    const alphabet = 'abc ₹,.{}"0123456789🙂'
    for (let n = 0; n < 40; n++) {
      const len = Math.floor(rand() * 3000)
      let text = ''
      for (let i = 0; i < len; i++) text += Array.from(alphabet)[Math.floor(rand() * Array.from(alphabet).length)]
      const packed = await deflateRaw(encode(text))
      expect(new TextDecoder().decode(inflateRaw(packed, 1 << 20))).toBe(text)
    }
  })

  it('stops at the output cap (zip bombs are harmless)', async () => {
    const packed = await deflateRaw(new Uint8Array(1_000_000).fill(97))
    expect(packed.length).toBeLessThan(2_000)
    expect(() => inflateRaw(packed, 16 * 1024)).toThrow(InflateError)
    expect(inflateRaw(packed, 1_000_000)).toHaveLength(1_000_000)
  })

  it('rejects truncated and corrupt data', async () => {
    const packed = await deflateRaw(encode('The quick brown fox jumps over the lazy dog. '.repeat(20)))
    expect(() => inflateRaw(packed.slice(0, packed.length - 3), 1 << 20)).toThrow(InflateError)
    expect(() => inflateRaw(new Uint8Array([]), 1 << 20)).toThrow(InflateError)
    // Block type 3 is reserved.
    expect(() => inflateRaw(new Uint8Array([0b111]), 1 << 20)).toThrow('Invalid block type')
    // Stored block whose length and one's-complement disagree.
    expect(() => inflateRaw(new Uint8Array([1, 5, 0, 0, 0]), 1 << 20)).toThrow('length mismatch')
    // Stored block promising more bytes than there are.
    expect(() => inflateRaw(new Uint8Array([1, 5, 0, 0xfa, 0xff, 1, 2]), 1 << 20)).toThrow('Unexpected end')
  })

  it('never reads a back-reference before the start of the output', () => {
    // Fixed block: length symbol 257 (3 bytes) at distance 1 with nothing written yet.
    // Bits (LSB first): BFINAL=1, BTYPE=01, then 7-bit code 0000001 for 257, then 5-bit distance 0.
    const bits = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
    const bytes = new Uint8Array(Math.ceil(bits.length / 8))
    bits.forEach((b, i) => {
      bytes[i >> 3] = (bytes[i >> 3] ?? 0) | (b << (i & 7))
    })
    expect(() => inflateRaw(bytes, 1 << 20)).toThrow('Distance too far back')
  })

  it('fuzz: random garbage either decodes within the cap or throws InflateError', () => {
    const rand = seeded(99)
    for (let n = 0; n < 2_000; n++) {
      const bytes = new Uint8Array(1 + Math.floor(rand() * 64)).map(() => Math.floor(rand() * 256))
      try {
        expect(inflateRaw(bytes, 4096).length).toBeLessThanOrEqual(4096)
      } catch (error) {
        expect(error).toBeInstanceOf(InflateError)
      }
    }
  })
})
