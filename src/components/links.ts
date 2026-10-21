/**
 * In-app links for design-system components that render real `<a href>`s (SectionHeader,
 * TabBar…). The app registers its router once (`setLinkNavigator(navigate)`); plain left-clicks
 * then navigate in place, while modified clicks (new tab, etc.) keep the browser's behaviour.
 * Until a navigator is registered, links simply load the page.
 */
import type { MouseEvent } from 'react'

export type LinkNavigator = (href: string) => void

let navigator: LinkNavigator | null = null

/** Registers (or clears, with null) the function that performs in-app navigation. */
export function setLinkNavigator(fn: LinkNavigator | null): void {
  navigator = fn
}

/** A primary-button click with no modifier keys, not already handled. */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/**
 * Click handler for an internal `<a href>`: hands plain left-clicks on same-tab links to
 * `onNavigate` (or the registered navigator) instead of loading the page.
 */
export function followLink(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate?: LinkNavigator): void {
  if (!isPlainLeftClick(event)) return
  const target = event.currentTarget.getAttribute('target')
  if (target && target !== '_self') return
  const go = onNavigate ?? navigator
  if (!go) return
  event.preventDefault()
  go(href)
}
