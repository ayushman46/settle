/**
 * Your UPI ID without typing it: every UPI app shows "your QR code", and that QR is a
 * `upi://pay?pa=<your UPI ID>&pn=<the name on your bank account>` link. Reading a picture of it
 * (a screenshot, or the image the app shares) gives the ID exactly as the bank has it — no typos —
 * and the name to check it against. Read on the phone with the browser's own barcode reader
 * (Chrome and the Android app have one) or, where there is none (Safari on iPhone), with a reader built into Settle. Nothing
 * is uploaded.
 */
import { isValidUpiId, normalizeUpiId } from './upi'

export interface UpiQr {
  /** The UPI ID, normalized. */
  vpa: string
  /** The payee name printed in the QR (the bank's), or null. */
  name: string | null
}

/** What a QR says, when it's a UPI payment QR for a valid UPI ID; else null. */
export function parseUpiQr(text: string): UpiQr | null {
  const trimmed = text.trim()
  if (!/^upi:\/\/pay\?/i.test(trimmed)) return null
  let params: URLSearchParams
  try {
    params = new URLSearchParams(trimmed.slice(trimmed.indexOf('?') + 1))
  } catch {
    return null
  }
  const pa = params.get('pa') ?? ''
  if (!isValidUpiId(pa)) return null
  const name = (params.get('pn') ?? '').replace(/\s+/g, ' ').trim()
  return { vpa: normalizeUpiId(pa), name: name ? Array.from(name).slice(0, 60).join('') : null }
}

interface Detected {
  rawValue?: string
}
interface Detector {
  detect(image: ImageBitmapSource): Promise<Detected[]>
}
type DetectorClass = new (options?: { formats?: string[] }) => Detector

function detectorClass(): DetectorClass | null {
  const found = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  return typeof found === 'function' ? found : null
}

/** The picture can be opened and its pixels read (every current phone browser, iPhone included). */
function canReadPixels(): boolean {
  return typeof createImageBitmap === 'function' && typeof document !== 'undefined'
}

/** This browser can read a QR from a picture. */
export function canReadQr(): boolean {
  return detectorClass() !== null || canReadPixels()
}

export type UpiQrResult =
  | { kind: 'ok'; qr: UpiQr }
  /** No QR in the picture. */
  | { kind: 'none' }
  /** A QR, but not a UPI one (a link, a Wi-Fi code, a merchant's order QR without a UPI ID…). */
  | { kind: 'other' }
  /** This browser can't read pictures of QR codes. */
  | { kind: 'unsupported' }

/** The longest side a picture is read at: a phone screenshot fits, a 12 MP photo is shrunk. */
const MAX_SIDE = 2000

/** The browser's own reader, where there is one (Chrome on Android, the Android app). */
async function readWithBrowser(bitmap: ImageBitmap): Promise<string[]> {
  const Reader = detectorClass()
  if (!Reader) return []
  try {
    const found = await new Reader({ formats: ['qr_code'] }).detect(bitmap)
    return found.map((code) => code.rawValue ?? '').filter(Boolean)
  } catch {
    return []
  }
}

/** Our own reader, on the phone, for browsers without one (Safari on iPhone, Firefox). */
async function readFromPixels(bitmap: ImageBitmap): Promise<string[]> {
  if (typeof document === 'undefined') return []
  const { default: jsQR } = await import('jsqr')
  const longest = Math.max(bitmap.width, bitmap.height) || 1
  // Full size first; a second, smaller pass picks up QRs that fill a very large picture.
  for (const scale of [Math.min(1, MAX_SIDE / longest), Math.min(1, 800 / longest)]) {
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return []
    context.drawImage(bitmap, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })
    if (code?.data) return [code.data]
    if (scale === 1 && longest <= 800) break
  }
  return []
}

/** Reads a UPI QR from a picture. Never throws. */
export async function readUpiQr(picture: Blob): Promise<UpiQrResult> {
  if (!canReadQr() || typeof createImageBitmap !== 'function') return { kind: 'unsupported' }
  try {
    const bitmap = await createImageBitmap(picture)
    try {
      let found = await readWithBrowser(bitmap)
      if (found.length === 0) found = await readFromPixels(bitmap)
      if (found.length === 0) return { kind: 'none' }
      for (const text of found) {
        const qr = parseUpiQr(text)
        if (qr) return { kind: 'ok', qr }
      }
      return { kind: 'other' }
    } finally {
      bitmap.close()
    }
  } catch {
    return { kind: 'none' }
  }
}
