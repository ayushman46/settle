import { describe, expect, it } from 'vitest'
import { qrPicture, qrPictureLayout } from './qrPicture'

const UPI = 'upi://pay?pa=ayush%40okaxis&pn=Ayush&am=333.33&cu=INR&tn=Goa%20cab'

describe('qrPictureLayout', () => {
  it('draws whole modules with a quiet zone, and stacks the lines under the code', () => {
    const layout = qrPictureLayout(UPI, [
      { text: 'Pay Ayush', size: 34, bold: true },
      { text: '₹333.33', size: 52, bold: true },
    ])
    expect(layout).not.toBeNull()
    if (!layout) return
    expect(Number.isInteger(layout.scale) && layout.scale >= 4).toBe(true)
    expect(layout.modules.length).toBeGreaterThan(100)
    // Four light modules all round: nothing dark in the quiet zone.
    expect(layout.modules.every(([x, y]) => x >= 4 && y >= 4)).toBe(true)
    const [first, second] = layout.lineTops
    expect(second! - first!).toBe(Math.round(34 * 1.35))
    expect(layout.height).toBeGreaterThan(layout.width)
  })

  it('gives up on what can’t be a QR code', () => {
    expect(qrPictureLayout('x'.repeat(5000), [])).toBeNull()
  })
})

describe('qrPicture', () => {
  it('is null where the browser can’t draw (no canvas here)', async () => {
    expect(await qrPicture(UPI, [])).toBeNull()
  })
})
