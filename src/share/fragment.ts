/**
 * The `#fragment` codec shared by every link Settle makes (pay, claim, pool and their replies):
 * JSON → deflate-raw → base64url, or `j.` + base64url(JSON) when the browser can't compress (or
 * that's shorter). Fragments never reach a server. Decoding is defensive: size caps before and
 * after inflating, lenient about what chat apps glue onto links, and it never throws.
 */
import { base64UrlToBytes, bytesToBase64Url } from './base64url'
import { inflateRaw } from './inflate'

/** Marks an uncompressed fragment. */
export const JSON_PREFIX = 'j.'

/** Longest `#fragment` any Settle link decodes. */
export const MAX_FRAGMENT_LENGTH = 24 * 1024

interface ByteTransform {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<BufferSource>
}

function noop(): void {}

/** Runs bytes through a (de)compression stream, giving up past `maxOutput` bytes. */
async function pump(bytes: Uint8Array, stream: ByteTransform, maxOutput: number): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()
  // Not awaited: the readable side must be drained concurrently or the writer stalls.
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(noop)
  writer.close().catch(noop)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxOutput) {
      reader.cancel().catch(noop)
      throw new RangeError('Too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** deflate-raw, or null when the browser can't compress. */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') return null
  try {
    return await pump(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER)
  } catch {
    return null
  }
}

/** inflate-raw (native, else the bundled JS decoder), or null when corrupt or over `maxOutput` bytes. */
export async function inflate(bytes: Uint8Array, maxOutput: number): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'function') {
    try {
      return await pump(bytes, new DecompressionStream('deflate-raw'), maxOutput)
    } catch {
      // Unsupported format (older Safari) or corrupt data — the JS decoder settles which.
    }
  }
  try {
    return inflateRaw(bytes, maxOutput)
  } catch {
    return null
  }
}

/**
 * A fragment for `json`: deflate-raw base64url, or `j.` + base64url(JSON) when the browser can't
 * compress or that's shorter. Never throws.
 */
export async function encodeFragment(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json)
  const plain = JSON_PREFIX + bytesToBase64Url(bytes)
  const packed = await deflate(bytes)
  const compact = packed ? bytesToBase64Url(packed) : null
  return compact !== null && compact.length < plain.length ? compact : plain
}

/**
 * The payload part of a hash or URL: what follows "#", up to the first character that can't be
 * in a link (chat apps glue on ")", ".", "?utm=…", spaces…). Null when there's none or it's too long.
 */
export function fragmentOf(input: string, maxLength = MAX_FRAGMENT_LENGTH): string | null {
  // Generous for percent-encoding, but never scan megabytes of pasted text.
  if (input.length > maxLength * 3 + 2_048) return null
  let text = input.trim()
  const hashAt = text.indexOf('#')
  if (hashAt !== -1) text = text.slice(hashAt + 1)
  if (text.includes('%')) {
    try {
      text = decodeURIComponent(text)
    } catch {
      return null
    }
  }
  const fragment = /^(?:j\.)?[A-Za-z0-9_\-+/]+/.exec(text)?.[0] ?? ''
  if (!fragment || fragment.length > maxLength) return null
  return fragment
}

/**
 * The JSON text inside a fragment (accepts the bare fragment, `#…`, or the whole URL), or null
 * for anything corrupt, truncated, not UTF-8 or over `maxDecodedBytes` once decoded. Never throws.
 */
export async function decodeFragment(hashOrUrl: string, maxDecodedBytes: number): Promise<string | null> {
  try {
    if (typeof hashOrUrl !== 'string') return null
    const fragment = fragmentOf(hashOrUrl)
    if (!fragment) return null
    let bytes: Uint8Array | null
    if (fragment.startsWith(JSON_PREFIX)) {
      bytes = base64UrlToBytes(fragment.slice(JSON_PREFIX.length))
      if (bytes && bytes.length > maxDecodedBytes) return null
    } else {
      const packed = base64UrlToBytes(fragment)
      bytes = packed && packed.length > 0 ? await inflate(packed, maxDecodedBytes) : null
    }
    if (!bytes || bytes.length === 0) return null
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
