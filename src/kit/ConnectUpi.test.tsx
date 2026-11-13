import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canReadQr, parseUpiQr, readUpiQr } from '../lib/upiQr'
import { ConnectUpi } from './ConnectUpi'

/** A stand-in for the browser's QR reader: "reads" whatever text the picture file holds. */
function installReader(read: (text: string) => string[]): void {
  class FakeDetector {
    async detect(image: unknown): Promise<Array<{ rawValue: string }>> {
      return read(String((image as { text?: string }).text ?? '')).map((rawValue) => ({ rawValue }))
    }
  }
  vi.stubGlobal('BarcodeDetector', FakeDetector)
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => ({ text: await blob.text(), close: () => undefined }))
}

const picture = (text: string): File => new File([text], 'qr.png', { type: 'image/png' })

afterEach(() => vi.unstubAllGlobals())

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
})

describe('Connect Google Pay', () => {
  it('isn’t offered where the browser can’t read a QR (the typed field is the way)', () => {
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
})
