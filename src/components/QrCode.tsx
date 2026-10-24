import { useMemo } from 'react'
import { encode } from 'uqr'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { qrPath } from './helpers'
import styles from './QrCode.module.css'

export interface QrCodeProps {
  /** Text to encode (e.g. a `upi://pay?...` link). */
  value: string
  /** Accessible description, e.g. "QR code to pay Aisha ₹712.40". */
  label: string
  /** Rendered width/height in px (shrinks to fit narrow containers). Default 232. */
  size?: number
  /** Error correction. Default `M` (15%) — robust without making the code dense. */
  ecc?: 'L' | 'M' | 'Q' | 'H'
  className?: string
}

/** Light modules around the code, in modules (on top of the white padding). */
const QUIET_ZONE = 2

/** Crisp, scannable QR code: one SVG path, dark ink on white in every theme. */
export function QrCode({ value, label, size = 232, ecc = 'M', className }: QrCodeProps) {
  const t = useT()
  const code = useMemo(() => {
    try {
      const { data } = encode(value, { ecc, border: 0 })
      return { d: qrPath(data, QUIET_ZONE), dimension: data.length + QUIET_ZONE * 2 }
    } catch {
      return null
    }
  }, [value, ecc])

  return (
    <div className={cx(styles.qr, className)} style={{ width: size }}>
      {code ? (
        <svg
          key={value}
          role="img"
          aria-label={label}
          viewBox={`0 0 ${code.dimension} ${code.dimension}`}
          shapeRendering="crispEdges"
          className={styles.svg}
        >
          <path d={code.d} />
        </svg>
      ) : (
        <p role="img" aria-label={label} className={styles.fallback}>
          {t('ui.qr.tooLong')}
        </p>
      )}
    </div>
  )
}
