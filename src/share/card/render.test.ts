import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRAND, ME_ID } from '../../domain/types'
import { FRIENDS, makeExpense, makeFriend, makeProfile } from '../testing'
import type { ShareCardInput } from './layout'
import { cardCharacters, defaultSiteLabel, renderShareCard, ShareCardError, shareCardFilename, shareCardInputFromExpense } from './render'
import { recordingContext, type RecordingContext } from './testCanvas'
import { CARD_ACCENTS } from './theme'

const INPUT: ShareCardInput = {
  title: 'Dinner at Toit',
  category: 'food',
  currency: 'INR',
  date: '2026-10-18',
  total: 276_600,
  payerName: 'Ayush',
  people: [
    { name: 'Ayush', color: 2, amount: 138_300, paid: true, isPayer: true },
    { name: 'Riya', color: 5, amount: 138_300, paid: false, isPayer: false },
  ],
}

const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })

let rec: RecordingContext
let canvases: HTMLCanvasElement[]

function stubCanvas(opts: { context?: boolean; blob?: Blob | null; toBlobThrows?: boolean } = {}) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvases.push(this)
    return (opts.context === false ? null : rec.ctx) as never
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback: BlobCallback, type?: string) {
    if (opts.toBlobThrows) throw new Error('SecurityError')
    expect(type).toBe('image/png')
    callback(opts.blob === undefined ? PNG : opts.blob)
  })
}

function stubFonts(load: (font: string, text?: string) => Promise<FontFace[]>) {
  Object.defineProperty(document, 'fonts', { value: { load: vi.fn(load) }, configurable: true })
}

beforeEach(() => {
  rec = recordingContext()
  canvases = []
  vi.stubGlobal('Path2D', class {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'fonts')
})

describe('renderShareCard', () => {
  it('draws a 1080×1350 PNG and frees the canvas afterwards', async () => {
    stubCanvas()
    const blob = await renderShareCard(INPUT, { watermark: true, theme: 'light' })
    expect(blob).toBe(PNG)
    expect(canvases).toHaveLength(1)
    // The bitmap is released (width/height reset) once the PNG exists.
    expect(canvases[0]?.width).toBe(0)
    const drawn = rec.named('fillText').map((c) => c.args[0])
    expect(drawn).toEqual(expect.arrayContaining(['Dinner at Toit', 'Riya', `Made with ${BRAND.name}`]))
  })

  it('respects the theme and the watermark', async () => {
    stubCanvas()
    await renderShareCard(INPUT, { watermark: false, theme: 'dark' })
    expect(rec.named('fillRect')[0]?.state.fillStyle).toBe('#0b0c0e')
    expect(rec.named('fillText').some((c) => String(c.args[0]).includes('Made with'))).toBe(false)
  })

  it("draws in the owner's accent when one is given (lime otherwise)", async () => {
    stubCanvas()
    await renderShareCard(INPUT, { watermark: true, theme: 'light', accent: 'coral' })
    const fills = rec.named('fill').map((c) => c.state.fillStyle)
    expect(fills).toContain(CARD_ACCENTS.coral.accent)
    expect(fills).not.toContain(CARD_ACCENTS.lime.accent)

    rec = recordingContext()
    await renderShareCard(INPUT, { watermark: true, theme: 'light' })
    expect(rec.named('fill').map((c) => c.state.fillStyle)).toContain(CARD_ACCENTS.lime.accent)
  })

  it('waits for Geist in every weight it uses', async () => {
    stubCanvas()
    const loads: Array<[string, string | undefined]> = []
    stubFonts(async (font, text) => {
      loads.push([font, text])
      return []
    })
    await renderShareCard(INPUT, { watermark: true, theme: 'light' })
    expect(loads.map(([f]) => f.split(' ')[0])).toEqual(['400', '500', '600'])
    expect(loads.every(([f]) => f.includes('"Geist Variable"'))).toBe(true)
    // With the card's own text, so the "₹" subset (latin-ext) is fetched before drawing.
    expect(loads.every(([, text]) => text === cardCharacters(INPUT))).toBe(true)
  })

  it('asks for every character it will draw, once', () => {
    const chars = cardCharacters({ ...INPUT, title: 'Café 🍕 Toit', people: [...INPUT.people, { name: 'Zoë', color: 0, amount: 1, paid: false, isPayer: false }] })
    for (const ch of ['₹', 'é', '🍕', 'Z', 'ë', '2', '7', '·', BRAND.name.charAt(0)]) expect(chars, ch).toContain(ch)
    expect(new Set(Array.from(chars)).size).toBe(Array.from(chars).length)
    expect(cardCharacters({ ...INPUT, currency: 'EUR' })).toContain('€')
  })

  it('draws with fallback fonts when Geist fails or is slow', async () => {
    stubCanvas()
    stubFonts(() => Promise.reject(new Error('network')))
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).resolves.toBe(PNG)

    vi.useFakeTimers()
    stubFonts(() => new Promise(() => undefined))
    const pending = renderShareCard(INPUT, { watermark: true, theme: 'light' })
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(pending).resolves.toBe(PNG)
  })

  it('falls back to OffscreenCanvas when the DOM canvas has no 2D context', async () => {
    stubCanvas({ context: false })
    const convertToBlob = vi.fn(async (opts: { type: string }) => {
      expect(opts.type).toBe('image/png')
      return PNG
    })
    const sizes: number[][] = []
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(width: number, height: number) {
          sizes.push([width, height])
        }
        getContext() {
          return rec.ctx
        }
        convertToBlob = convertToBlob
      },
    )
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).resolves.toBe(PNG)
    expect(sizes).toEqual([[1080, 1350]])
    expect(rec.named('fillText').length).toBeGreaterThan(5)
  })

  it('rejects with ShareCardError when nothing can draw or encode the image', async () => {
    stubCanvas({ context: false })
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).rejects.toBeInstanceOf(ShareCardError)
    vi.restoreAllMocks()

    stubCanvas({ blob: null })
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).rejects.toThrow("Couldn't create the image")
    vi.restoreAllMocks()

    stubCanvas({ toBlobThrows: true })
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).rejects.toBeInstanceOf(ShareCardError)
    vi.restoreAllMocks()

    stubCanvas({ blob: new Blob([], { type: 'image/png' }) })
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).rejects.toBeInstanceOf(ShareCardError)
  })

  it('wraps unexpected drawing errors in ShareCardError', async () => {
    rec = recordingContext({ throwOn: 'fillRect' })
    stubCanvas()
    await expect(renderShareCard(INPUT, { watermark: true, theme: 'light' })).rejects.toBeInstanceOf(ShareCardError)
    expect(canvases[0]?.width).toBe(0)
  })
})

describe('defaultSiteLabel', () => {
  it("shows the site's host in production", () => {
    expect(defaultSiteLabel({ hostname: 'settle.app', host: 'settle.app' })).toBe('settle.app')
    expect(defaultSiteLabel({ hostname: 'www.settle.app', host: 'www.settle.app' })).toBe('settle.app')
    expect(defaultSiteLabel({ hostname: 'staging.settle.app', host: 'staging.settle.app:8443' })).toBe('staging.settle.app:8443')
  })

  it('shows the tagline on local and LAN hosts', () => {
    for (const hostname of ['localhost', 'app.localhost', 'phone.local', '127.0.0.1', '192.168.1.20', '[::1]', '']) {
      expect(defaultSiteLabel({ hostname, host: hostname })).toBe(BRAND.tagline)
    }
    // jsdom runs on localhost.
    expect(defaultSiteLabel()).toBe(BRAND.tagline)
  })
})

describe('shareCardInputFromExpense', () => {
  it('maps an expense to card data with the names friends know', () => {
    expect(shareCardInputFromExpense(makeExpense(), FRIENDS, makeProfile())).toEqual({
      title: 'Dinner at Toit',
      category: 'food',
      currency: 'INR',
      date: '2026-10-18',
      total: 276_600,
      payerName: 'Ayush',
      people: [
        { name: 'Ayush', color: 2, amount: 69_150, paid: true, isPayer: true },
        { name: 'Riya', color: 5, amount: 69_150, paid: true, isPayer: false },
        { name: 'Sam', color: 1, amount: 69_150, paid: false, isPayer: false },
        { name: 'Neha Sharma', color: 3, amount: 69_150, paid: false, isPayer: false },
      ],
    })
  })

  it('falls back sensibly for a nameless owner, unknown friends and duplicates', () => {
    const e = makeExpense({
      payerId: 'riya',
      participants: [ME_ID, 'ghost', 'ghost'].map((friendId) => ({ friendId, input: null })),
      shares: { [ME_ID]: 100, ghost: 200 },
      paidBack: {},
    })
    const card = shareCardInputFromExpense(e, { ...FRIENDS, [ME_ID]: makeFriend(ME_ID, 'You') }, makeProfile({ name: 'You' }))
    expect(card.payerName).toBe('Riya')
    expect(card.people).toEqual([
      { name: 'Me', color: 0, amount: 100, paid: false, isPayer: false },
      { name: 'Friend', color: 0, amount: 200, paid: false, isPayer: false },
    ])
  })
})

describe('shareCardFilename', () => {
  it('makes a safe ASCII file name from the title', () => {
    expect(shareCardFilename('Dinner at Toit!')).toBe('settle-dinner-at-toit.png')
    expect(shareCardFilename('Café Coffee Day — 2×')).toBe('settle-cafe-coffee-day-2.png')
    expect(shareCardFilename('खाना')).toBe('settle-split.png')
    expect(shareCardFilename('   ')).toBe('settle-split.png')
    expect(shareCardFilename('a'.repeat(100))).toBe(`settle-${'a'.repeat(48)}.png`)
    expect(shareCardFilename(`${'a'.repeat(47)} b`)).toBe(`settle-${'a'.repeat(47)}.png`)
  })
})
