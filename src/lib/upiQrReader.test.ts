import jsQR from 'jsqr'
import { encode } from 'uqr'
import { describe, expect, it } from 'vitest'
import { parseUpiQr } from './upiQr'

/** A phone screenshot (1080 × 2400) with a real QR somewhere on it, as RGBA pixels. */
function screenshot(value: string, { dark = false } = {}): { data: Uint8ClampedArray; width: number; height: number } {
  const width = 1080
  const height = 2400
  const paper = dark ? 24 : 255
  const ink = dark ? 240 : 0
  const data = new Uint8ClampedArray(width * height * 4).fill(paper)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  const { data: modules, size } = encode(value, { border: 4 })
  const cell = Math.floor(720 / size)
  const left = Math.floor((width - size * cell) / 2)
  const top = 700
  for (let y = 0; y < size * cell; y++) {
    for (let x = 0; x < size * cell; x++) {
      if (!modules[Math.floor(y / cell)]![Math.floor(x / cell)]) continue
      const at = ((top + y) * width + left + x) * 4
      data[at] = data[at + 1] = data[at + 2] = ink
    }
  }
  return { data, width, height }
}

describe('Settle’s own QR reader (browsers without one: Safari on iPhone)', () => {
  const link = 'upi://pay?pa=ayush.m@okicici&pn=AYUSHMAN%20M&aid=uGICAgIDV3fDqSQ'

  it('reads the UPI ID from a screenshot of a UPI app’s “my QR” screen', () => {
    const shot = screenshot(link)
    const code = jsQR(shot.data, shot.width, shot.height, { inversionAttempts: 'attemptBoth' })
    expect(parseUpiQr(code?.data ?? '')).toEqual({ vpa: 'ayush.m@okicici', name: 'AYUSHMAN M' })
  })

  it('reads it in dark mode too (light QR on a dark screen)', () => {
    const shot = screenshot(link, { dark: true })
    const code = jsQR(shot.data, shot.width, shot.height, { inversionAttempts: 'attemptBoth' })
    expect(parseUpiQr(code?.data ?? '')).toEqual({ vpa: 'ayush.m@okicici', name: 'AYUSHMAN M' })
  })

  it('finds nothing in a picture with no QR', () => {
    const blank = new Uint8ClampedArray(400 * 400 * 4).fill(255)
    expect(jsQR(blank, 400, 400, { inversionAttempts: 'attemptBoth' })).toBeNull()
  })
})
