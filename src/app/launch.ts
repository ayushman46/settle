/**
 * Where a visit to `/` should land. The sales page is for newcomers; someone opening Settle from
 * their home screen (an installed app) — or a returning user on their phone — wants the app.
 */
import { hasData } from '../data/hooks'
import { profileStore } from '../data/stores'

function matches(query: string, win: Window): boolean {
  try {
    return typeof win.matchMedia === 'function' && win.matchMedia(query).matches
  } catch {
    return false
  }
}

/** Running as an installed app (Android/desktop display modes, or iOS's home-screen web app). */
export function isInstalledApp(win: Window = window): boolean {
  if (['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((mode) => matches(`(display-mode: ${mode})`, win))) {
    return true
  }
  return (win.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** A phone-like device: a touch screen as the main pointer and no desktop-wide window. */
export function isPhoneLike(win: Window = window): boolean {
  return matches('(pointer: coarse)', win) && !matches('(min-width: 1024px)', win)
}

/** Someone who has used Settle on this device before (finished onboarding, or has splits). */
export function isReturningUser(): boolean {
  try {
    return profileStore.get().onboarded || hasData()
  } catch {
    return false
  }
}

/** True when `/` should open the app instead of the sales page. */
export function shouldOpenApp(win: Window = window): boolean {
  return isInstalledApp(win) || (isReturningUser() && isPhoneLike(win))
}
