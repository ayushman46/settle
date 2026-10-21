/**
 * Tiny vibration cues for touch devices (Android browsers; iOS Safari has no Vibration API).
 * Silent wherever vibration isn't available and for people who prefer reduced motion.
 */

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error'

/** Vibration patterns in milliseconds (vibrate, pause, vibrate...). */
export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, number | readonly number[]>> = {
  tap: 8,
  select: 12,
  success: [12, 60, 24],
  warning: [20, 40, 20],
  error: [40, 60, 40],
}

let reducedMotion: MediaQueryList | null | undefined

function prefersReducedMotion(): boolean {
  if (reducedMotion === undefined) {
    try {
      reducedMotion =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null
    } catch {
      reducedMotion = null
    }
  }
  return reducedMotion?.matches === true
}

/** Plays a short vibration for `kind`. Never throws. */
export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    if (prefersReducedMotion()) return
    const pattern = HAPTIC_PATTERNS[kind]
    navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    // Some browsers throw when vibrating without a user gesture — a cue is never worth an error.
  }
}

/** Forgets the cached media query (tests). */
export function resetHapticsForTests(): void {
  reducedMotion = undefined
}
