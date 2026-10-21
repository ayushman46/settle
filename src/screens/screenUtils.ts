/** Small helpers shared by the screens. */
import { motionAllowed } from './entranceMotion'

/** Below a tenth of a percent, the money amount says more than "0%". */
export const TINY_RATE = 0.001

/** "1 item", "3 items" (English copy; the app's text is English). */
export function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`
}

/** Frees an object URL. Ignores non-blob URLs and environments without the API. */
export function revokeUrl(url: string): void {
  if (!url.startsWith('blob:') || typeof URL.revokeObjectURL !== 'function') return
  try {
    URL.revokeObjectURL(url)
  } catch {
    // Already revoked.
  }
}

/** Scrolls `el` into view if it isn't (smoothly unless reduced motion). Safe where unsupported. */
export function revealElement(el: Element | null): void {
  if (!el || typeof el.scrollIntoView !== 'function') return
  try {
    el.scrollIntoView({ block: 'nearest', behavior: motionAllowed() ? 'smooth' : 'auto' })
  } catch {
    // Very old browsers without the options form: not worth more.
  }
}

/**
 * Puts keyboard focus on the screen's `<h1>` (focusable, see `PageTitle`) — where it goes when the
 * control that had it disappears, so it never drops to the page body.
 */
export function focusScreenHeading(): void {
  document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
}
