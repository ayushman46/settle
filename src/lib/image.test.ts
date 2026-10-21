import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fitWithin, IMAGE_LIMITS, ImageError, isImageFile, prepareImage } from './image'

interface FakeCtx {
  fillStyle: string
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: string
  fillRect: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
}

let ctx: FakeCtx | null
let blobSize: (width: number, height: number, quality: number) => number
let toBlobCalls: Array<{ width: number; height: number; quality: number }>
let bitmapClose: ReturnType<typeof vi.fn>
const createObjectURL = vi.fn(() => 'blob:preview')
const revokeObjectURL = vi.fn()

function file(name: string, type: string, size = 1000): File {
  const f = new File([new Uint8Array(4)], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function stubBitmap(width: number, height: number) {
  bitmapClose = vi.fn()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: bitmapClose })),
  )
}

beforeEach(() => {
  ctx = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  }
  toBlobCalls = []
  blobSize = () => 500_000
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    _type?: string,
    quality?: number,
  ) {
    const q = quality ?? 1
    toBlobCalls.push({ width: this.width, height: this.height, quality: q })
    const size = blobSize(this.width, this.height, q)
    const blob = new Blob([new Uint8Array(8)], { type: 'image/jpeg' })
    Object.defineProperty(blob, 'size', { value: size })
    setTimeout(() => callback(blob), 0)
  })
  Object.assign(URL, { createObjectURL, revokeObjectURL })
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fitWithin', () => {
  it('limits the long edge and the pixel count, keeping aspect', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2048, height: 1536 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1536, height: 2048 })
    expect(fitWithin(2000, 2000)).toEqual({ width: 1788, height: 1788 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    const pano = fitWithin(10000, 1000)
    expect(pano.width).toBe(2048)
    expect(pano.height).toBe(204)
  })

  it('never returns zero sizes', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 1, height: 1 })
  })
})

describe('isImageFile', () => {
  it('accepts image types and image-named files without a type', () => {
    expect(isImageFile(file('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isImageFile(file('a.heic', 'image/heic'))).toBe(true)
    expect(isImageFile(file('IMG_001.JPG', ''))).toBe(true)
    expect(isImageFile(file('a.pdf', 'application/pdf'))).toBe(false)
    expect(isImageFile(file('notes.txt', ''))).toBe(false)
  })
})

describe('prepareImage', () => {
  it('refuses non-images, huge and empty files with friendly messages', async () => {
    await expect(prepareImage(file('a.pdf', 'application/pdf'))).rejects.toMatchObject({ code: 'not_image' })
    await expect(prepareImage(file('a.jpg', 'image/jpeg', IMAGE_LIMITS.maxInputBytes + 1))).rejects.toMatchObject({
      code: 'too_large',
    })
    const empty = prepareImage(file('a.jpg', 'image/jpeg', 0))
    await expect(empty).rejects.toBeInstanceOf(ImageError)
    await expect(empty).rejects.toMatchObject({ code: 'decode_failed', message: expect.stringMatching(/couldn't open/) })
  })

  it('downscales, draws on white and encodes a JPEG data URL', async () => {
    stubBitmap(4000, 3000)
    const result = await prepareImage(file('bill.jpg', 'image/jpeg'))
    expect(result.width).toBe(2048)
    expect(result.height).toBe(1536)
    expect(result.bytes).toBe(500_000)
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(result.previewUrl).toBe('blob:preview')
    expect(toBlobCalls).toEqual([{ width: 2048, height: 1536, quality: 0.85 }])
    expect(ctx?.fillStyle).toBe('#ffffff')
    expect(ctx?.fillRect).toHaveBeenCalledWith(0, 0, 2048, 1536)
    expect(ctx?.drawImage).toHaveBeenCalledTimes(1)
    expect(bitmapClose).toHaveBeenCalled()
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' })
  })

  it('steps quality down, then scales down, until it fits', async () => {
    stubBitmap(2048, 1536)
    // Only small images at low quality fit under the target.
    blobSize = (w, _h, q) => (w <= 1640 && q <= 0.75 ? 2_000_000 : 3_000_000)
    const result = await prepareImage(file('bill.png', 'image/png'))
    expect(toBlobCalls.map((c) => [c.width, c.quality])).toEqual([
      [2048, 0.85],
      [2048, 0.75],
      [2048, 0.65],
      [1638, 0.85],
      [1638, 0.75],
    ])
    expect(result.width).toBe(1638)
    expect(result.bytes).toBe(2_000_000)
  })

  it('uses the smallest attempt when nothing reaches the target', async () => {
    stubBitmap(1000, 1000)
    blobSize = (w, _h, q) => 3_000_000 + w + Math.round(q * 100)
    const result = await prepareImage(file('bill.jpg', 'image/jpeg'))
    expect(toBlobCalls).toHaveLength(12)
    expect(result.bytes).toBe(Math.min(...toBlobCalls.map((c) => 3_000_000 + c.width + Math.round(c.quality * 100))))
  })

  it('falls back to <img> when createImageBitmap fails', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('unsupported')
      }),
    )
    class FakeImage {
      decoding = ''
      naturalWidth = 1200
      naturalHeight = 900
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)
    const result = await prepareImage(file('bill.webp', 'image/webp'))
    expect(result.width).toBe(1200)
    expect(result.height).toBe(900)
    // One object URL for decoding (revoked) and one for the preview (kept).
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('reports decode_failed when nothing can decode the file', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('bad')
      }),
    )
    class BrokenImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('Image', BrokenImage)
    await expect(prepareImage(file('bill.heic', 'image/heic'))).rejects.toMatchObject({ code: 'decode_failed' })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('reports decode_failed when there is no 2D canvas', async () => {
    stubBitmap(100, 100)
    ctx = null
    await expect(prepareImage(file('bill.jpg', 'image/jpeg'))).rejects.toMatchObject({ code: 'decode_failed' })
    expect(bitmapClose).toHaveBeenCalled()
  })

  it('reports decode_failed when drawing throws', async () => {
    stubBitmap(100, 100)
    ctx?.drawImage.mockImplementation(() => {
      throw new Error('InvalidStateError')
    })
    await expect(prepareImage(file('bill.jpg', 'image/jpeg'))).rejects.toMatchObject({ code: 'decode_failed' })
  })

  it('reports decode_failed when the encoder produces nothing', async () => {
    stubBitmap(100, 100)
    blobSize = () => 0
    await expect(prepareImage(file('bill.jpg', 'image/jpeg'))).rejects.toMatchObject({ code: 'decode_failed' })
  })
})
