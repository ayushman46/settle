/**
 * Your UPI ID without typing it: every UPI app shows "your QR code", and that QR is a
 * `upi://pay?pa=<your UPI ID>&pn=<the name on your bank account>` link. Reading a picture of it
 * (a screenshot, or the image the app shares) gives the ID exactly as the bank has it — no typos —
 * and the name to check it against. Read on the phone with the browser's own barcode reader
 * (Chrome and the Android app have one; where there's none, the ID is typed as before). Nothing
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

/** This browser can read a QR from a picture. */
export function canReadQr(): boolean {
  return detectorClass() !== null
}

export type UpiQrResult =
  | { kind: 'ok'; qr: UpiQr }
  /** No QR in the picture. */
  | { kind: 'none' }
  /** A QR, but not a UPI one (a link, a Wi-Fi code, a merchant's order QR without a UPI ID…). */
  | { kind: 'other' }
  /** This browser can't read pictures of QR codes. */
  | { kind: 'unsupported' }

/** Reads a UPI QR from a picture. Never throws. */
export async function readUpiQr(picture: Blob): Promise<UpiQrResult> {
  const Reader = detectorClass()
  if (!Reader) return { kind: 'unsupported' }
  try {
    const bitmap = await createImageBitmap(picture)
    try {
      const found = await new Reader({ formats: ['qr_code'] }).detect(bitmap)
      if (found.length === 0) return { kind: 'none' }
      for (const code of found) {
        const qr = parseUpiQr(code.rawValue ?? '')
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
