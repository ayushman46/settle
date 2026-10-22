/** In-page jumps ("See how it works") without adding history entries the app's Back would trip over. */

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Scrolls the section with `id` into view (smoothly unless reduced motion is on) and moves focus
 * to its heading, so keyboard and screen-reader users land there too. False when there's no such
 * section on the page.
 */
export function scrollToSection(id: string): boolean {
  const section = document.getElementById(id)
  if (!section) return false
  if (typeof section.scrollIntoView === 'function') {
    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }
  const heading = section.matches('h1, h2, h3') ? section : section.querySelector<HTMLElement>('h1, h2, h3')
  const target = heading ?? section
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
  return true
}
