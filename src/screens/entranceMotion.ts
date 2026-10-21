/** Motion helpers for the screens: the result's count-up and the reduced-motion check. */
import { useEffect, useState } from 'react'

/** How long totals take to count up when the result first appears. */
export const COUNT_UP_MS = 520

/**
 * True when it's fine to animate: the person hasn't asked for reduced motion and the browser can
 * tell us so (when it can't — or there's no `requestAnimationFrame` — we stay still).
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

/**
 * Eased progress (0 → 1) of a one-off entrance animation that starts on mount. Re-renders don't
 * restart it. Without motion it is 1 from the first render.
 */
export function useEntranceProgress(durationMs: number = COUNT_UP_MS): number {
  const [animated] = useState(motionAllowed)
  const [progress, setProgress] = useState(animated ? 0 : 1)

  useEffect(() => {
    if (!animated) return
    let frame = 0
    let start: number | null = null
    const tick = (now: number): void => {
      start ??= now
      const t = Math.min(1, (now - start) / Math.max(1, durationMs))
      setProgress(easeOutCubic(t))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animated, durationMs])

  return progress
}

/** `value` scaled by an entrance `progress`, as a whole number of minor units. */
export function countUp(value: number, progress: number): number {
  return progress >= 1 ? value : Math.round(value * progress)
}
