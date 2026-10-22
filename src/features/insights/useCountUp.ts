/** A big number that glides to its value — from zero on first paint, then from wherever it is. */
import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 700

function motionAllowed(): boolean {
  try {
    if (typeof window.matchMedia !== 'function' || typeof window.requestAnimationFrame !== 'function') return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * `target`, eased in steps of `step` minor units (whole rupees by default, so paise don't flicker);
 * the last frame is exact. Without motion (or reduced motion) it's always exactly `target`.
 */
export function useCountUp(target: number, step = 100): number {
  const [animated] = useState(motionAllowed)
  const [shown, setShown] = useState(animated ? 0 : target)
  const current = useRef(shown)

  useEffect(() => {
    if (!animated) return
    const from = current.current
    if (from === target) return
    let frame = 0
    let start: number | null = null
    const unit = Math.max(1, Math.round(step))
    const tick = (now: number): void => {
      start ??= now
      const t = Math.min(1, (now - start) / DURATION_MS)
      const value = t >= 1 ? target : Math.round((from + (target - from) * easeOutCubic(t)) / unit) * unit
      current.current = value
      setShown(value)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animated, target, step])

  return animated ? shown : target
}
