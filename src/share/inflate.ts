/**
 * A small raw-DEFLATE (RFC 1951) decoder, modelled on zlib's `puff`. It is the fallback for
 * browsers without `DecompressionStream('deflate-raw')` (e.g. iOS before 16.4), so a pay link
 * opens on every phone. Output is capped, which also makes "zip bombs" harmless.
 */

export class InflateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InflateError'
  }
}

const MAX_BITS = 15

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
]
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
/** Order in which code-length code lengths are stored in a dynamic block header. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/** Canonical Huffman code: how many codes of each length, and the symbols in code order. */
interface Huffman {
  counts: Uint16Array
  symbols: Uint16Array
}

function buildHuffman(lengths: ArrayLike<number>): Huffman {
  const counts = new Uint16Array(MAX_BITS + 1)
  for (let s = 0; s < lengths.length; s++) {
    const len = lengths[s] ?? 0
    counts[len] = (counts[len] ?? 0) + 1
  }
  let left = 1
  for (let len = 1; len <= MAX_BITS; len++) {
    left = left * 2 - (counts[len] ?? 0)
    if (left < 0) throw new InflateError('Over-subscribed Huffman code')
  }
  const offsets = new Uint16Array(MAX_BITS + 2)
  for (let len = 1; len <= MAX_BITS; len++) offsets[len + 1] = (offsets[len] ?? 0) + (counts[len] ?? 0)
  const symbols = new Uint16Array(lengths.length)
  for (let s = 0; s < lengths.length; s++) {
    const len = lengths[s] ?? 0
    if (len !== 0) {
      const at = offsets[len] ?? 0
      symbols[at] = s
      offsets[len] = at + 1
    }
  }
  return { counts, symbols }
}

const FIXED: { lit: Huffman; dist: Huffman } = (() => {
  const lit = new Uint8Array(288)
  lit.fill(8, 0, 144)
  lit.fill(9, 144, 256)
  lit.fill(7, 256, 280)
  lit.fill(8, 280, 288)
  return { lit: buildHuffman(lit), dist: buildHuffman(new Uint8Array(30).fill(5)) }
})()

class Inflater {
  private pos = 0
  private bitBuf = 0
  private bitCount = 0
  private out: Uint8Array
  private outLen = 0
  private readonly input: Uint8Array
  private readonly maxOutput: number

  constructor(input: Uint8Array, maxOutput: number) {
    this.input = input
    this.maxOutput = maxOutput
    this.out = new Uint8Array(Math.min(maxOutput, Math.max(1024, input.length * 4)))
  }

  run(): Uint8Array {
    let last = 0
    while (last === 0) {
      last = this.bits(1)
      const type = this.bits(2)
      if (type === 0) this.stored()
      else if (type === 1) this.codes(FIXED.lit, FIXED.dist)
      else if (type === 2) this.dynamic()
      else throw new InflateError('Invalid block type')
    }
    return this.out.slice(0, this.outLen)
  }

  private bits(need: number): number {
    let value = this.bitBuf
    while (this.bitCount < need) {
      if (this.pos >= this.input.length) throw new InflateError('Unexpected end of data')
      value |= (this.input[this.pos++] ?? 0) << this.bitCount
      this.bitCount += 8
    }
    this.bitBuf = value >>> need
    this.bitCount -= need
    return value & ((1 << need) - 1)
  }

  private push(byte: number): void {
    if (this.outLen >= this.out.length) this.grow()
    this.out[this.outLen++] = byte
  }

  private grow(): void {
    if (this.out.length >= this.maxOutput) throw new InflateError('Output too large')
    const next = new Uint8Array(Math.min(this.maxOutput, this.out.length * 2))
    next.set(this.out)
    this.out = next
  }

  private stored(): void {
    this.bitBuf = 0
    this.bitCount = 0
    if (this.pos + 4 > this.input.length) throw new InflateError('Unexpected end of data')
    const len = (this.input[this.pos] ?? 0) | ((this.input[this.pos + 1] ?? 0) << 8)
    const nlen = (this.input[this.pos + 2] ?? 0) | ((this.input[this.pos + 3] ?? 0) << 8)
    this.pos += 4
    if (len !== (~nlen & 0xffff)) throw new InflateError('Stored block length mismatch')
    if (this.pos + len > this.input.length) throw new InflateError('Unexpected end of data')
    for (let i = 0; i < len; i++) this.push(this.input[this.pos + i] ?? 0)
    this.pos += len
  }

  private decode(h: Huffman): number {
    let code = 0
    let first = 0
    let index = 0
    for (let len = 1; len <= MAX_BITS; len++) {
      code |= this.bits(1)
      const count = h.counts[len] ?? 0
      if (code - count < first) return h.symbols[index + (code - first)] ?? 0
      index += count
      first = (first + count) << 1
      code <<= 1
    }
    throw new InflateError('Invalid Huffman code')
  }

  private codes(lit: Huffman, dist: Huffman): void {
    for (;;) {
      const symbol = this.decode(lit)
      if (symbol < 256) {
        this.push(symbol)
        continue
      }
      if (symbol === 256) return
      const li = symbol - 257
      if (li >= 29) throw new InflateError('Invalid length symbol')
      const length = (LENGTH_BASE[li] ?? 0) + this.bits(LENGTH_EXTRA[li] ?? 0)
      const di = this.decode(dist)
      if (di >= 30) throw new InflateError('Invalid distance symbol')
      const distance = (DIST_BASE[di] ?? 0) + this.bits(DIST_EXTRA[di] ?? 0)
      if (distance > this.outLen) throw new InflateError('Distance too far back')
      for (let i = 0; i < length; i++) this.push(this.out[this.outLen - distance] ?? 0)
    }
  }

  private dynamic(): void {
    const nlen = this.bits(5) + 257
    const ndist = this.bits(5) + 1
    const ncode = this.bits(4) + 4
    if (nlen > 286 || ndist > 30) throw new InflateError('Bad dynamic block counts')

    const codeLengths = new Uint8Array(19)
    for (let i = 0; i < ncode; i++) codeLengths[CODE_LENGTH_ORDER[i] ?? 0] = this.bits(3)
    const lencode = buildHuffman(codeLengths)

    const lengths = new Uint8Array(nlen + ndist)
    let i = 0
    while (i < nlen + ndist) {
      const symbol = this.decode(lencode)
      if (symbol < 16) {
        lengths[i++] = symbol
        continue
      }
      let repeat: number
      let value = 0
      if (symbol === 16) {
        if (i === 0) throw new InflateError('Repeat with no previous length')
        value = lengths[i - 1] ?? 0
        repeat = 3 + this.bits(2)
      } else if (symbol === 17) {
        repeat = 3 + this.bits(3)
      } else {
        repeat = 11 + this.bits(7)
      }
      if (i + repeat > nlen + ndist) throw new InflateError('Too many code lengths')
      lengths.fill(value, i, i + repeat)
      i += repeat
    }
    if ((lengths[256] ?? 0) === 0) throw new InflateError('Missing end-of-block code')
    this.codes(buildHuffman(lengths.subarray(0, nlen)), buildHuffman(lengths.subarray(nlen)))
  }
}

/**
 * Decompresses raw DEFLATE data. Throws `InflateError` on corrupt or truncated input, or when the
 * output would exceed `maxOutput` bytes.
 */
export function inflateRaw(input: Uint8Array, maxOutput: number): Uint8Array {
  return new Inflater(input, Math.max(1, Math.floor(maxOutput))).run()
}
