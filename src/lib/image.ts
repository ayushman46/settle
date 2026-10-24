/**
 * Turns a picked/taken photo into a JPEG data URL small enough to upload quickly, without
 * losing the detail the AI needs to read a receipt. Runs entirely in the browser.
 */
import { t, type MessageKey } from '../i18n'

export interface PreparedImage {
  /** `data:image/jpeg;base64,…` for `POST /api/scan` (PNG only on browsers that can't encode JPEG). */
  dataUrl: string
  /** Object URL of the ORIGINAL file, for showing the photo. Revoke it when done (see `state/photo.ts`). */
  previewUrl: string
  /** Size of the uploaded JPEG in pixels. */
  width: number
  height: number
  /** Size of the uploaded JPEG in bytes. */
  bytes: number
}

export type ImageErrorCode = 'not_image' | 'decode_failed' | 'too_large'

const MESSAGE_KEYS: Readonly<Record<ImageErrorCode, MessageKey>> = {
  not_image: 'api.image.error.not_image',
  decode_failed: 'api.image.error.decode_failed',
  too_large: 'api.image.error.too_large',
}

/** A photo we can't use. `message` is friendly and safe to show as-is. */
export class ImageError extends Error {
  readonly code: ImageErrorCode

  constructor(code: ImageErrorCode, message: string = t(MESSAGE_KEYS[code])) {
    super(message)
    this.name = 'ImageError'
    this.code = code
  }
}

export const IMAGE_LIMITS = {
  /** Files bigger than this are refused before decoding. */
  maxInputBytes: 25 * 1024 * 1024,
  /** Longest edge of the uploaded image. */
  maxEdge: 2048,
  /** Most pixels in the uploaded image (keeps phone panoramas in check). */
  maxPixels: 3_200_000,
  /** Aim for uploads at or below this size. */
  targetBytes: 2.5 * 1024 * 1024,
} as const

/** JPEG qualities tried in order at each size before scaling down. */
const QUALITIES = [0.85, 0.75, 0.65] as const
/** Each extra round scales the image by this much. */
const SCALE_STEP = 0.8
const MAX_ROUNDS = 4
/** Give up on an <img> that neither loads nor errors (shouldn't happen, but never hang the UI). */
const DECODE_TIMEOUT_MS = 20_000

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i

/** True when the file says it's an image (some Android pickers leave `type` empty, so the name counts too). */
export function isImageFile(file: File): boolean {
  if (file.type) return file.type.toLowerCase().startsWith('image/')
  return IMAGE_EXTENSION.test(file.name)
}

/** Largest size within `maxEdge` and `maxPixels` that keeps the aspect ratio (never upscales). */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = IMAGE_LIMITS.maxEdge,
  maxPixels: number = IMAGE_LIMITS.maxPixels,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const scale = Math.min(1, maxEdge / Math.max(w, h), Math.sqrt(maxPixels / (w * h)))
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) }
}

interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  release(): void
}

async function decodeWithBitmap(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    // Honour the camera's EXIF rotation so the receipt isn't sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    if (!bitmap.width || !bitmap.height) {
      bitmap.close()
      return null
    }
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    return null
  }
}

async function decodeWithElement(file: File): Promise<Decoded | null> {
  if (typeof URL.createObjectURL !== 'function') return null
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image took too long to load')), DECODE_TIMEOUT_MS)
      img.onload = () => {
        clearTimeout(timer)
        resolve()
      }
      img.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Image failed to load'))
      }
      img.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image has no size')
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
      } catch {
        resolve(null)
      }
    })
  }
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return Promise.resolve(new Blob([bytes], { type: 'image/jpeg' }))
  } catch {
    return Promise.resolve(null)
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No data')))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsDataURL(blob)
  })
}

/** Draws the image at `width`×`height` on white (transparent PNGs would turn black as JPEG). */
function draw(decoded: Decoded, width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  let ctx: CanvasRenderingContext2D | null
  try {
    ctx = canvas.getContext('2d', { alpha: false })
  } catch {
    ctx = null
  }
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(decoded.source, 0, 0, width, height)
  return canvas
}

/** Compresses until the JPEG fits `targetBytes`: lower quality first, then smaller dimensions. */
async function compress(decoded: Decoded): Promise<{ blob: Blob; width: number; height: number }> {
  let { width, height } = fitWithin(decoded.width, decoded.height)
  let best: { blob: Blob; width: number; height: number } | null = null
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const canvas = draw(decoded, width, height)
    if (!canvas) break
    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob || blob.size === 0) continue
      if (!best || blob.size < best.blob.size) best = { blob, width, height }
      if (blob.size <= IMAGE_LIMITS.targetBytes) return best
    }
    // Release the canvas memory promptly (matters on phones).
    canvas.width = 0
    canvas.height = 0
    width = Math.max(1, Math.round(width * SCALE_STEP))
    height = Math.max(1, Math.round(height * SCALE_STEP))
  }
  if (!best) throw new ImageError('decode_failed')
  return best
}

/**
 * Validates, decodes (EXIF-rotated), downsizes and JPEG-encodes a photo for upload.
 * @throws ImageError with a friendly message.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isImageFile(file)) throw new ImageError('not_image')
  if (file.size > IMAGE_LIMITS.maxInputBytes) throw new ImageError('too_large')
  if (file.size === 0) throw new ImageError('decode_failed')

  const decoded = (await decodeWithBitmap(file)) ?? (await decodeWithElement(file))
  if (!decoded) throw new ImageError('decode_failed')

  let result: { blob: Blob; width: number; height: number }
  try {
    result = await compress(decoded)
  } catch (error) {
    throw error instanceof ImageError ? error : new ImageError('decode_failed')
  } finally {
    decoded.release()
  }

  let dataUrl: string
  try {
    dataUrl = await blobToDataUrl(result.blob)
  } catch {
    throw new ImageError('decode_failed')
  }
  // Browsers that can't encode JPEG fall back to PNG, which the server accepts too.
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(dataUrl)) throw new ImageError('decode_failed')

  return {
    dataUrl,
    previewUrl: URL.createObjectURL(file),
    width: result.width,
    height: result.height,
    bytes: result.blob.size,
  }
}
