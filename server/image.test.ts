import { describe, expect, it } from 'vitest'
import { inspectImage, sniffImage } from './image'
import { GIF_BYTES_AS_PNG, JPEG_DATA_URL, PNG_DATA_URL, WEBP_DATA_URL } from './testing'

describe('sniffImage', () => {
  it('recognises JPEG, PNG and WebP signatures', () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]))).toBe('image/jpeg')
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImage(Uint8Array.from(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')))).toBe('image/webp')
  })

  it('rejects everything else', () => {
    expect(sniffImage(Uint8Array.from(Buffer.from('GIF89a')))).toBeNull()
    expect(sniffImage(Uint8Array.from(Buffer.from('RIFF\0\0\0\0WAVE')))).toBeNull()
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(sniffImage(new Uint8Array())).toBeNull()
  })
})

describe('inspectImage', () => {
  it.each([
    [JPEG_DATA_URL, 'image/jpeg'],
    [PNG_DATA_URL, 'image/png'],
    [WEBP_DATA_URL, 'image/webp'],
  ])('accepts a real %#', (dataUrl, mime) => {
    const result = inspectImage(dataUrl)
    expect(result).toMatchObject({ ok: true, mime })
    if (result.ok) expect(result.dataUrl).toBe(dataUrl)
  })

  it('counts decoded bytes', () => {
    const payload = Buffer.alloc(1000, 1)
    payload.set([0xff, 0xd8, 0xff])
    const result = inspectImage(`data:image/jpeg;base64,${payload.toString('base64')}`)
    expect(result).toMatchObject({ ok: true, bytes: 1000 })
  })

  it('normalises the mime type, whitespace and padding', () => {
    const body = JPEG_DATA_URL.split(',')[1] ?? ''
    const messy = `DATA:IMAGE/JPG;BASE64,${body.slice(0, 10)}\n ${body.slice(10).replace(/=+$/, '')}`
    const result = inspectImage(messy)
    expect(result).toEqual({ ok: true, mime: 'image/jpeg', bytes: expect.any(Number), dataUrl: JPEG_DATA_URL })
  })

  it('relabels a supported image sent with the wrong declared type', () => {
    const mislabelled = JPEG_DATA_URL.replace('image/jpeg', 'image/png')
    expect(inspectImage(mislabelled)).toMatchObject({ ok: true, mime: 'image/jpeg', dataUrl: JPEG_DATA_URL })
  })

  it.each([
    ['not a data URL', 'https://example.com/bill.jpg'],
    ['plain base64', JPEG_DATA_URL.split(',')[1] ?? ''],
    ['a GIF', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='],
    ['an SVG', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['a PDF', 'data:application/pdf;base64,JVBERi0xLjQ='],
    ['URL-encoded data', 'data:image/png,%89PNG'],
    ['broken base64', 'data:image/jpeg;base64,/9j/4AAQ*SkZJRg=='],
    ['misplaced padding', 'data:image/jpeg;base64,/9j/=4AAQSkZJRg'],
    ['impossible length', 'data:image/jpeg;base64,/9j/4'],
    ['GIF bytes labelled PNG', GIF_BYTES_AS_PNG],
    ['an empty payload', 'data:image/jpeg;base64,'],
  ])('rejects %s as unsupported', (_label, dataUrl) => {
    expect(inspectImage(dataUrl)).toEqual({ ok: false, code: 'unsupported_image' })
  })

  it('rejects images over the size limit before decoding them', () => {
    const payload = Buffer.alloc(2048, 0)
    payload.set([0xff, 0xd8, 0xff])
    const dataUrl = `data:image/jpeg;base64,${payload.toString('base64')}`
    expect(inspectImage(dataUrl, 2048)).toMatchObject({ ok: true })
    expect(inspectImage(dataUrl, 2047)).toEqual({ ok: false, code: 'image_too_large' })
  })
})
