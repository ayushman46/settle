/** Live media queries for kit components (e.g. hide "Open UPI app" on computers). */
import { useCallback, useSyncExternalStore } from 'react'

/** A mouse or trackpad is the main pointer: a computer, where UPI apps can't be opened. */
export const FINE_POINTER = '(hover: hover) and (pointer: fine)'

/** A touch screen is the main pointer: a phone, where files go to the share sheet (not a download). */
export const TOUCH_FIRST = '(hover: none) and (pointer: coarse)'

/** The system asks for dark mode (what the app follows when its theme is "System"). */
export const DARK_SCHEME = '(prefers-color-scheme: dark)'

function list(query: string): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  } catch {
    return null
  }
}

/** Whether `query` matches now, re-rendering when it changes. False wherever it can't be asked. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = list(query)
      if (!mql || typeof mql.addEventListener !== 'function') return () => undefined
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const snapshot = useCallback(() => list(query)?.matches === true, [query])
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
