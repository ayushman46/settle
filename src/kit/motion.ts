/** Motion for kit components: the reduced-motion check and amounts that glide to a new value. */
import { useEffect, useRef, useState } from 'react'

/** How long an amount takes to glide to its new value. */
export const COUNT_UP_MS = 640

/**
 * True when it's fine to animate: the person hasn't asked for reduced motion and the browser can
 * tell us so (when it can't — or there's no `requestAnimationFrame` — everything stays still).
 */
export function motionAllowed(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    if (typeof window.requestAnimationFrame !== 'function') return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export interface CountUpOptions {
  /** Count up from zero on mount (otherwise the first value shows as is). Default true. */
  intro?: boolean
  durationMs?: number
  /**
   * Shows in-between values in steps of this many minor units — e.g. 100 for whole rupees, so
   * paise don't flicker and the width doesn't jump while counting. The final value is exact.
   */
  step?: number
}

/**
 * `target`, eased in whole minor units: from 0 on mount (with `intro`), then from wherever it is
 * to each new target. Without motion it is always exactly `target`.
 */
export function useCountUp(
  target: number,
  { intro = true, durationMs = COUNT_UP_MS, step = 1 }: CountUpOptions = {},
): number {
  const [animated] = useState(motionAllowed)
  const [shown, setShown] = useState(() => (animated && intro ? 0 : target))
  const current = useRef(shown)

  useEffect(() => {
    if (!animated) return
    const from = current.current
    if (from === target) return
    let frame = 0
    let start: number | null = null
    const tick = (now: number): void => {
      start ??= now
      const t = Math.min(1, (now - start) / Math.max(1, durationMs))
      const unit = Number.isFinite(step) && step > 1 ? Math.round(step) : 1
      const value = t >= 1 ? target : Math.round((from + (target - from) * easeOutCubic(t)) / unit) * unit
      current.current = value
      setShown(value)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animated, target, durationMs, step])

  return animated ? shown : target
}
