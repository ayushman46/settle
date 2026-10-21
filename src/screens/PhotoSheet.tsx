import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { ImageOff } from 'lucide-react'
import { BottomSheet, EmptyState } from '../components'
import { cx } from '../lib/cx'
import styles from './PhotoSheet.module.css'

export interface PhotoSheetProps {
  open: boolean
  /** The bill photo (object URL). */
  url: string | null
  onClose: () => void
}

/** A zoomed view: the image's rendered width and the spot (0..1 of the image) to centre. */
interface Zoom {
  width: number
  x: number
  y: number
}

/** How much closer a tap brings the photo. */
const ZOOM_FACTOR = 2.5

const clamp01 = (n: number): number => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5))

/** The bill photo, full height. Tap to zoom in on a spot (and back); pinch works on touch screens. */
export function PhotoSheet({ open, url, onClose }: PhotoSheetProps) {
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setZoom(null)
  }
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Centre the tapped spot once the zoomed image has laid out.
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !zoom) return
    viewport.scrollLeft = zoom.x * viewport.scrollWidth - viewport.clientWidth / 2
    viewport.scrollTop = zoom.y * viewport.scrollHeight - viewport.clientHeight / 2
  }, [zoom])

  const toggleZoom = (event: MouseEvent<HTMLButtonElement>): void => {
    if (zoom) {
      setZoom(null)
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    const image = imageRef.current
    const naturalW = image?.naturalWidth ?? 0
    const naturalH = image?.naturalHeight ?? 0
    if (box.width <= 0 || box.height <= 0 || naturalW <= 0 || naturalH <= 0) {
      setZoom({ width: Math.max(box.width, 1) * ZOOM_FACTOR, x: 0.5, y: 0 })
      return
    }
    // `object-fit: contain` letterboxes the photo: work out where it really is on screen.
    const fit = Math.min(box.width / naturalW, box.height / naturalH)
    const shownW = naturalW * fit
    const shownH = naturalH * fit
    const fromPointer = event.detail > 0
    setZoom({
      width: Math.max(shownW * ZOOM_FACTOR, box.width * 1.5),
      x: fromPointer ? clamp01((event.clientX - box.left - (box.width - shownW) / 2) / shownW) : 0.5,
      y: fromPointer ? clamp01((event.clientY - box.top - (box.height - shownH) / 2) / shownH) : 0,
    })
  }

  const broken = url === null || failedUrl === url

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="tall"
      fill
      title="Your bill photo"
      description={broken ? undefined : zoom ? 'Tap to see the whole bill.' : 'Tap anywhere to zoom in.'}
    >
      {broken ? (
        <EmptyState
          size="sm"
          headingLevel={3}
          icon={<ImageOff />}
          title="Photo not available"
          text="Photos aren't kept after a refresh — your items are all still here."
        />
      ) : (
        <div ref={viewportRef} className={cx(styles.viewport, zoom && styles.zoomed)}>
          <button
            type="button"
            className={styles.zoomButton}
            style={zoom ? { width: `${Math.round(zoom.width)}px` } : undefined}
            aria-label={zoom ? 'Zoom out' : 'Zoom in'}
            aria-pressed={zoom !== null}
            onClick={toggleZoom}
          >
            <img
              ref={imageRef}
              src={url}
              alt="Photo of the bill"
              className={styles.image}
              draggable={false}
              onError={() => setFailedUrl(url)}
            />
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
