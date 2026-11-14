import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '../../components'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { canReadQr, readQrFrame, readQrTexts } from '../../lib/upiQr'
import { parseShopQr, type ShopQr } from './shop'
import styles from './Counter.module.css'

/** How often the camera's picture is read for a QR. */
const FRAME_MS = 220
/** The longest side a camera frame is read at. */
const FRAME_SIDE = 720

interface BrowserDetector {
  detect(image: CanvasImageSource): Promise<Array<{ rawValue?: string }>>
}

function browserDetector(): BrowserDetector | null {
  const Found = (globalThis as { BarcodeDetector?: new (options?: { formats?: string[] }) => BrowserDetector }).BarcodeDetector
  try {
    return typeof Found === 'function' ? new Found({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

export interface ScanShopProps {
  onFound: (qr: ShopQr) => void
}

/**
 * Reads the shop's UPI QR: with the camera, pointed at the standee on the counter or the QR
 * printed on the bill, or from a photo of it. Read on the phone; nothing is uploaded.
 */
export function ScanShop({ onFound }: ScanShopProps) {
  const t = useT()
  const video = useRef<HTMLVideoElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [camera, setCamera] = useState<'off' | 'starting' | 'on'>('off')
  const [reading, setReading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const stop = useCallback((): void => {
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = null
    setCamera('off')
  }, [])
  useEffect(() => stop, [stop])

  const take = useCallback(
    (texts: readonly string[]): boolean => {
      for (const text of texts) {
        const qr = parseShopQr(text)
        if (qr) {
          haptic('success')
          stop()
          setProblem(null)
          onFound(qr)
          return true
        }
      }
      return false
    },
    [onFound, stop],
  )

  // While the camera is on: read a frame every so often until a UPI QR is in it.
  useEffect(() => {
    if (camera !== 'on') return
    const detector = browserDetector()
    const canvas = document.createElement('canvas')
    let busy = false
    let warned = false
    const timer = window.setInterval(() => {
      const el = video.current
      if (busy || !el || el.readyState < 2 || el.videoWidth === 0) return
      busy = true
      void (async () => {
        try {
          let texts: string[] = []
          if (detector) {
            texts = (await detector.detect(el)).map((code) => code.rawValue ?? '').filter(Boolean)
          } else {
            const scale = Math.min(1, FRAME_SIDE / Math.max(el.videoWidth, el.videoHeight))
            canvas.width = Math.max(1, Math.round(el.videoWidth * scale))
            canvas.height = Math.max(1, Math.round(el.videoHeight * scale))
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) return
            context.drawImage(el, 0, 0, canvas.width, canvas.height)
            const text = await readQrFrame(context.getImageData(0, 0, canvas.width, canvas.height))
            if (text) texts = [text]
          }
          if (texts.length > 0 && !take(texts) && !warned) {
            warned = true
            setProblem(t('counter.scan.other'))
          }
        } catch {
          // A frame that couldn't be read: the next one will be.
        } finally {
          busy = false
        }
      })()
    }, FRAME_MS)
    return () => window.clearInterval(timer)
  }, [camera, take, t])

  const start = async (): Promise<void> => {
    setProblem(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem(t('counter.scan.noCamera'))
      return
    }
    setCamera('starting')
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      stream.current = media
      setCamera('on')
      // The <video> is on the page now: show the camera in it.
      requestAnimationFrame(() => {
        const el = video.current
        if (!el) return
        el.srcObject = media
        void el.play().catch(() => undefined)
      })
    } catch {
      stop()
      setProblem(t('counter.scan.denied'))
    }
  }

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setReading(true)
    setProblem(null)
    const texts = await readQrTexts(file)
    setReading(false)
    if (texts === null) setProblem(t('counter.scan.noCamera'))
    else if (texts.length === 0) setProblem(t('counter.scan.none'))
    else if (!take(texts)) setProblem(t('counter.scan.other'))
    if (texts === null || texts.length === 0) haptic('error')
  }

  return (
    <div className={styles.scan}>
      {camera === 'on' && (
        <div className={styles.viewfinder}>
          <video ref={video} className={styles.video} playsInline muted aria-label={t('counter.scan.video.aria')} />
          <span className={styles.frame} aria-hidden="true" />
          <Button size="sm" variant="secondary" iconStart={<X />} className={styles.stop} onClick={stop}>
            {t('counter.scan.stop')}
          </Button>
        </div>
      )}
      {camera !== 'on' && (
        <Button block iconStart={<Camera />} loading={camera === 'starting'} onClick={() => void start()}>
          {t('counter.scan.camera')}
        </Button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e)} aria-label={t('counter.scan.photo')} />
      {canReadQr() && (
        <Button block variant="secondary" iconStart={<ImageIcon />} loading={reading} onClick={() => input.current?.click()}>
          {t('counter.scan.photo')}
        </Button>
      )}
      <p className={problem ? styles.problem : styles.fine} role="status">
        {problem ?? t('counter.scan.how')}
      </p>
    </div>
  )
}
