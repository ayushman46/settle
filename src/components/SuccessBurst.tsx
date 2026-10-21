import { useCallback, useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { pushOverlay } from './overlayStack'
import styles from './SuccessBurst.module.css'

export interface SuccessBurstProps {
  /** "Split saved", "Pro unlocked"… */
  title: string
  subtitle?: ReactNode
  /** Big line under the check, e.g. a `Money`. */
  amount?: ReactNode
  /** Called once, when the moment is over (or the person taps / presses a key to skip it). */
  onDone?: () => void
  /** How long the moment lasts (ms). Default 1200. */
  duration?: number
  className?: string
}

/** Confetti flecks: angle (deg), distance (px), size (px), colour token, delay (ms). */
const FLECKS: ReadonlyArray<[number, number, number, string, number]> = [
  [0, 124, 11, '--accent', 0],
  [30, 140, 8, '--pro-3', 40],
  [60, 116, 10, '--avatar-0-bg', 20],
  [90, 134, 12, '--pro-2', 60],
  [120, 120, 8, '--accent', 30],
  [150, 142, 11, '--avatar-3-bg', 10],
  [180, 126, 9, '--pro-1', 50],
  [210, 136, 8, '--avatar-5-bg', 20],
  [240, 118, 12, '--accent', 40],
  [270, 140, 9, '--pro-3', 0],
  [300, 122, 8, '--avatar-4-bg', 30],
  [330, 134, 11, '--pro-2', 60],
]

/**
 * Full-screen "done!" moment: an accent disc pops in, the check draws itself, rings ripple out and
 * confetti flecks burst, with a success haptic (~1.2s). Static under reduced motion. It takes
 * focus (so screen readers announce its title), makes the page behind inert, and any tap or key
 * skips it. Mount it to play it; unmount it in `onDone`.
 */
export function SuccessBurst({ title, subtitle, amount, onDone, duration = 1200, className }: SuccessBurstProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const latest = useRef(onDone)
  const titleId = useId()

  useLayoutEffect(() => {
    latest.current = onDone
  })

  const finish = useCallback((): void => {
    if (done.current) return
    done.current = true
    latest.current?.()
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const release = pushOverlay(root)
    root.focus({ preventScroll: true })
    return () => {
      release()
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    haptic('success')
    const timer = setTimeout(finish, Math.max(0, duration))
    return () => clearTimeout(timer)
  }, [duration, finish])

  return createPortal(
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onClick={finish}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          return
        }
        event.preventDefault()
        finish()
      }}
    >
      <div className={styles.stage} aria-hidden="true">
        <span className={styles.ring} />
        <span className={cx(styles.ring, styles.ring2)} />
        <span className={cx(styles.ring, styles.ring3)} />
        {FLECKS.map(([angle, distance, size, color, delay], i) => (
          <span
            key={i}
            className={styles.fleck}
            style={
              {
                '--a': `${angle}deg`,
                '--d': `${distance}px`,
                '--s': `${size}px`,
                '--c': `var(${color})`,
                '--delay': `${delay}ms`,
              } as CSSProperties
            }
          />
        ))}
        <svg viewBox="0 0 96 96" className={styles.badge} focusable="false">
          <circle className={styles.disc} cx="48" cy="48" r="44" />
          <path className={styles.check} d="M29 49.5 42 62 67 35" pathLength={1} />
        </svg>
      </div>
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {amount != null && <div className={styles.amount}>{amount}</div>}
        {subtitle != null && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </div>,
    document.body,
  )
}
