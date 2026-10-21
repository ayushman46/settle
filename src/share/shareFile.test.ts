import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeFilename, shareFile } from './shareFile'

const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })

let clicks: HTMLAnchorElement[]

function setTouch(touch: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: touch && query.includes('pointer: coarse'), media: query }))
}

function setShare(share: ((data: ShareData) => Promise<void>) | undefined, canShare?: (data: ShareData) => boolean) {
  Object.defineProperty(navigator, 'share', { value: share && vi.fn(share), configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: canShare && vi.fn(canShare), configurable: true })
}

function domError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

beforeEach(() => {
  clicks = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this)
  })
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:card'), configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
  setTouch(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('shareFile', () => {
  it('opens the share sheet with the file and message on phones', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    setShare(share, () => true)
    expect(await shareFile(PNG, 'settle-dinner.png', 'Dinner at Toit — pay here: https://x', { title: 'Dinner' })).toBe('shared')
    const data = (navigator.share as unknown as typeof share).mock.calls[0]?.[0]
    expect(data?.text).toBe('Dinner at Toit — pay here: https://x')
    expect(data?.title).toBe('Dinner')
    const file = data?.files?.[0]
    expect(file).toBeInstanceOf(File)
    expect(file?.name).toBe('settle-dinner.png')
    expect(file?.type).toBe('image/png')
    expect(clicks).toHaveLength(0)
  })

  it('retries without the text when a target only takes files', async () => {
    setShare(async () => undefined, (data) => !data.text)
    expect(await shareFile(PNG, 'card.png', 'Hello')).toBe('shared')
    const data = vi.mocked(navigator.share).mock.calls[0]?.[0]
    expect(data?.text).toBeUndefined()
    expect(data?.files).toHaveLength(1)
  })

  it('reports a dismissed share sheet as cancelled', async () => {
    setShare(() => Promise.reject(domError('AbortError')), () => true)
    expect(await shareFile(PNG, 'card.png')).toBe('cancelled')
    expect(clicks).toHaveLength(0)
  })

  it('downloads instead when sharing is refused (e.g. the tap was too long ago)', async () => {
    setShare(() => Promise.reject(domError('NotAllowedError')), () => true)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    expect(clicks).toHaveLength(1)
  })

  it('downloads when the browser cannot share files', async () => {
    setShare(async () => undefined, () => false)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    setShare(undefined)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    setShare(async () => undefined, () => {
      throw new TypeError('bad data')
    })
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    expect(clicks).toHaveLength(3)
  })

  it('shares when canShare is missing but share exists (older Safari)', async () => {
    setShare(async () => undefined)
    expect(await shareFile(PNG, 'card.png')).toBe('shared')
  })

  it('downloads on desktop unless asked to share', async () => {
    setTouch(false)
    setShare(async () => undefined, () => true)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    expect(navigator.share).not.toHaveBeenCalled()
    expect(await shareFile(PNG, 'card.png', undefined, { prefer: 'share' })).toBe('shared')
    setTouch(true)
    expect(await shareFile(PNG, 'card.png', undefined, { prefer: 'download' })).toBe('downloaded')
    expect(navigator.share).toHaveBeenCalledTimes(1)
  })

  it('treats a missing matchMedia as desktop', async () => {
    vi.stubGlobal('matchMedia', undefined)
    setShare(async () => undefined, () => true)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
  })

  it('downloads with a hidden link, then revokes the URL later', async () => {
    vi.useFakeTimers()
    setShare(undefined)
    expect(await shareFile(PNG, 'Dinner: at/Toit?.png')).toBe('downloaded')
    const link = clicks[0]
    expect(link?.download).toBe('Dinner- at-Toit-.png')
    expect(link?.href).toBe('blob:card')
    expect(link?.isConnected).toBe(false)
    expect(URL.createObjectURL).toHaveBeenCalledWith(PNG)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card')
  })

  it('fails gracefully when neither sharing nor downloading is possible', async () => {
    setShare(undefined)
    Reflect.deleteProperty(URL, 'createObjectURL')
    Object.defineProperty(URL, 'createObjectURL', { value: undefined, configurable: true })
    expect(await shareFile(PNG, 'card.png')).toBe('failed')
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => {
        throw new Error('nope')
      },
      configurable: true,
    })
    expect(await shareFile(PNG, 'card.png')).toBe('failed')
  })

  it('downloads when File cannot be constructed', async () => {
    vi.stubGlobal('File', undefined)
    setShare(async () => undefined, () => true)
    expect(await shareFile(PNG, 'card.png')).toBe('downloaded')
    expect(navigator.share).not.toHaveBeenCalled()
  })
})

describe('safeFilename', () => {
  it('keeps good names and fixes the extension to match the type', () => {
    expect(safeFilename('settle-dinner.png', 'image/png')).toBe('settle-dinner.png')
    expect(safeFilename('settle-dinner', 'image/png')).toBe('settle-dinner.png')
    expect(safeFilename('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg')
    expect(safeFilename('photo.png', 'image/jpeg')).toBe('photo.jpg')
    expect(safeFilename('backup.json', 'application/json; charset=utf-8')).toBe('backup.json')
    expect(safeFilename('Dinner v2.0 final', 'image/png')).toBe('Dinner v2.0 final.png')
  })

  it('strips characters that break file systems', () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j.png', 'image/png')).toBe('a-b-c-d-e-f-g-h-i-j.png')
    expect(safeFilename('  ..hidden.png', 'image/png')).toBe('hidden.png')
    expect(safeFilename('trailing dots...', 'text/plain')).toBe('trailing dots.txt')
    expect(safeFilename('‮gnp.exe', 'image/png')).toBe('gnp.png')
    expect(safeFilename('', 'image/png')).toBe('settle.png')
    expect(safeFilename('...', '')).toBe('settle')
  })

  it('keeps an unknown type’s own extension and caps the length', () => {
    expect(safeFilename('notes.md', 'text/markdown')).toBe('notes.md')
    expect(safeFilename('x'.repeat(200), '')).toHaveLength(80)
    const long = safeFilename(`${'x'.repeat(200)}.png`, 'image/png')
    expect(long).toBe(`${'x'.repeat(76)}.png`)
  })
})
