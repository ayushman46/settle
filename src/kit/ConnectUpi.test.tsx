import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canReadQr, parseUpiQr, readUpiQr } from '../lib/upiQr'
import { ConnectUpi } from './ConnectUpi'

// Settle's own reader (for browsers without one): "reads" the text the canvas was given.
vi.mock('jsqr', () => ({
  default: (data: unknown) => {
    const text = String((data as { text?: string }).text ?? '')
    return text ? { data: text } : null
  },
}))

/** A picture can be opened and drawn, as in any phone browser (jsdom has no canvas of its own). */
function installPixels(): void {
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => ({ text: await blob.text(), width: 1080, height: 2400, close: () => undefined }))
  let drawn = ''
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage: (image: { text: string }) => {
      drawn = image.text
    },
    getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: { text: drawn }, width, height }),
  })) as never)
}

/** A stand-in for the browser's QR reader: "reads" whatever text the picture file holds. */
function installReader(read: (text: string) => string[]): void {
  class FakeDetector {
    async detect(image: unknown): Promise<Array<{ rawValue: string }>> {
      return read(String((image as { text?: string }).text ?? '')).map((rawValue) => ({ rawValue }))
    }
  }
  installPixels()
  vi.stubGlobal('BarcodeDetector', FakeDetector)
}

const picture = (text: string): File => new File([text], 'qr.png', { type: 'image/png' })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a UPI QR', () => {
  it('gives the UPI ID and the bank’s name; anything else is not one', () => {
    expect(parseUpiQr('upi://pay?pa=Riya.Sharma@OkAxis&pn=RIYA%20SHARMA&aid=uGICAgIDV')).toEqual({ vpa: 'riya.sharma@okaxis', name: 'RIYA SHARMA' })
    expect(parseUpiQr('upi://pay?pa=9876543210@ybl')).toEqual({ vpa: '9876543210@ybl', name: null })
    expect(parseUpiQr('https://example.com/pay?pa=riya@okaxis')).toBeNull()
    expect(parseUpiQr('upi://pay?pa=not-an-id&pn=X')).toBeNull()
    expect(parseUpiQr('WIFI:S:Home;T:WPA;P:secret;;')).toBeNull()
  })

  it('is read from a picture where the browser can; says so where it can’t', async () => {
    expect(canReadQr()).toBe(false)
    expect(await readUpiQr(picture('x'))).toEqual({ kind: 'unsupported' })
    installReader((text) => (text ? [text] : []))
    expect(canReadQr()).toBe(true)
    expect(await readUpiQr(picture('upi://pay?pa=sam@oksbi&pn=Sam%20K'))).toEqual({ kind: 'ok', qr: { vpa: 'sam@oksbi', name: 'Sam K' } })
    expect(await readUpiQr(picture(''))).toEqual({ kind: 'none' })
    expect(await readUpiQr(picture('https://settleupi.vercel.app'))).toEqual({ kind: 'other' })
  })

  it('is read by Settle’s own reader where the browser has none (Safari on iPhone)', async () => {
    installPixels()
    expect(canReadQr()).toBe(true)
    expect(await readUpiQr(picture('upi://pay?pa=sam@oksbi&pn=Sam%20K'))).toEqual({ kind: 'ok', qr: { vpa: 'sam@oksbi', name: 'Sam K' } })
    expect(await readUpiQr(picture(''))).toEqual({ kind: 'none' })
    expect(await readUpiQr(picture('WIFI:S:Home;;'))).toEqual({ kind: 'other' })
  })
})

describe('Connect Google Pay', () => {
  it('isn’t offered where the browser can’t open a picture at all (the typed field is the way)', () => {
    const { container } = render(<ConnectUpi onConnect={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reads your UPI ID from a picture of your own QR, and shows the name on it to check', async () => {
    installReader((text) => (text ? [text] : []))
    const onConnect = vi.fn()
    const user = userEvent.setup()
    render(<ConnectUpi onConnect={onConnect} />)
    expect(screen.getByRole('button', { name: 'Connect Google Pay: no typing' })).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Connect Google Pay: no typing', { selector: 'input' }), picture('upi://pay?pa=ayush@okicici&pn=AYUSHMAN%20M'))
    expect(await screen.findByText('Connected ayush@okicici: the name on it is AYUSHMAN M. Check that’s you.')).toBeInTheDocument()
    expect(onConnect).toHaveBeenCalledWith({ vpa: 'ayush@okicici', name: 'AYUSHMAN M' })
  })

  it('says what’s wrong with a picture that has no QR, or someone’s website QR', async () => {
    installReader((text) => (text ? [text] : []))
    const onConnect = vi.fn()
    const user = userEvent.setup()
    render(<ConnectUpi onConnect={onConnect} />)
    const input = screen.getByLabelText('Connect Google Pay: no typing', { selector: 'input' })
    await user.upload(input, picture(''))
    expect(await screen.findByText(/No QR code found in that picture/)).toBeInTheDocument()
    await user.upload(input, picture('https://example.com'))
    expect(await screen.findByText(/That QR isn’t a UPI one/)).toBeInTheDocument()
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('works on an iPhone too: no browser reader, same button', async () => {
    installPixels()
    const onConnect = vi.fn()
    const user = userEvent.setup()
    render(<ConnectUpi onConnect={onConnect} />)
    await user.upload(screen.getByLabelText('Connect Google Pay: no typing', { selector: 'input' }), picture('upi://pay?pa=neha@ybl&pn=NEHA'))
    expect(await screen.findByText('Connected neha@ybl: the name on it is NEHA. Check that’s you.')).toBeInTheDocument()
    expect(onConnect).toHaveBeenCalledWith({ vpa: 'neha@ybl', name: 'NEHA' })
  })
})
