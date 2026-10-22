/**
 * Where onboarding sends people when it's done. Someone who opened a deep link or a home-screen
 * shortcut first ("Scan bill" → `/app/bill`) lands on welcome with `?next=`, and carries on there
 * afterwards — but only ever to one of the app's own pages.
 */
import { matchPath } from '../../app/router'

export const WELCOME_PATH = '/app/welcome'
export const HOME_PATH = '/app'

const BASE = 'https://settle.invalid'

/** True for `/app` and the pages under it (not other sites, not the welcome page itself). */
function isAppPage(pathname: string): boolean {
  return /^\/app(?:\/|$)/.test(pathname) && matchPath(WELCOME_PATH, pathname) === null
}

/** The page to open after onboarding for a `next` value — Home unless it's one of ours. */
export function onboardingDestination(next: string | null | undefined): string {
  if (!next) return HOME_PATH
  try {
    const url = new URL(next, BASE)
    if (url.origin !== BASE || !next.startsWith('/') || !isAppPage(url.pathname)) return HOME_PATH
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return HOME_PATH
  }
}

/** The welcome page's address for someone who was on their way to `target` (path + query + hash). */
export function welcomePath(target: string): string {
  const destination = onboardingDestination(target)
  return destination === HOME_PATH ? WELCOME_PATH : `${WELCOME_PATH}?next=${encodeURIComponent(destination)}`
}
