/**
 * Validates the bill photo sent to `POST /api/scan` before it costs an NVIDIA call:
 * a base64 data URL of a JPEG, PNG or WebP whose bytes really are that kind of image.
 */
import { API_LIMITS } from '../shared/api'

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export type ImageCheck =
  | { ok: true; mime: ImageMime; bytes: number; /** Canonical data URL: sniffed mime, no whitespace, padded. */ dataUrl: string }
  | { ok: false; code: 'unsupported_image' | 'image_too_large' }

const DATA_URL = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
/** Enough base64 for 12 decoded bytes — the longest signature we check (RIFF....WEBP). */
const SNIFF_CHARS = 16

/** Recognises an image from its first bytes. Never trusts the declared mime type. */
export function sniffImage(head: Uint8Array): ImageMime | null {
  const at = (index: number) => head[index] ?? -1
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((byte, index) => at(index) === byte)) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to))
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

/**
 * Checks a data URL. A photo whose bytes are a different supported format than its
 * declared type (say, a JPEG labelled PNG) is accepted and relabelled — that is a
 * harmless client quirk, not a reason to make someone retake the photo.
 */
export function inspectImage(dataUrl: string, maxBytes: number = API_LIMITS.maxImageBytes): ImageCheck {
  const match = DATA_URL.exec(dataUrl)
  if (!match) return { ok: false, code: 'unsupported_image' }

  const base64 = (match[2] ?? '').replace(/\s+/g, '')
  if (!BASE64.test(base64) || base64.length % 4 === 1) return { ok: false, code: 'unsupported_image' }
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const padding = padded.endsWith('==') ? 2 : padded.endsWith('=') ? 1 : 0
  const bytes = (padded.length / 4) * 3 - padding
  if (bytes > maxBytes) return { ok: false, code: 'image_too_large' }

  const mime = sniffImage(Buffer.from(padded.slice(0, SNIFF_CHARS), 'base64'))
  if (mime === null) return { ok: false, code: 'unsupported_image' }
  return { ok: true, mime, bytes, dataUrl: `data:${mime};base64,${padded}` }
}
