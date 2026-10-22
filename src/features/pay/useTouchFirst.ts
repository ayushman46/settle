import { useSyncExternalStore } from 'react'

/** Phones and tablets: no hover, a coarse pointer. Where a `upi://` link can open a UPI app. */
const QUERY = '(hover: none) and (pointer: coarse)'

function query(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null
  } catch {
    return null
  }
}

function subscribe(onChange: () => void): () => void {
  const list = query()
  if (!list) return () => {}
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return query()?.matches === true
}

/** True on touch-first devices (where we lead with "Pay with any UPI app"); false on desktops (QR first). */
export function useTouchFirst(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
