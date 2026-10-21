/* eslint-disable react-refresh/only-export-components -- the router's hooks, functions and Link are one unit; an edit here just reloads the page in dev. */
/**
 * Settle's path router (History API). Pages, bottom sheets and the bill flow's steps share one
 * history trail (`./nav/historyDriver.ts`), so the system/Android Back button always closes the
 * top-most sheet first, then steps back through the bill flow, then returns to the previous
 * screen — and only leaves the app from its first screen. Reloads restore the screen.
 *
 *   const { pattern, params } = useRoute(ROUTES)        // first matching pattern
 *   navigate('/app/groups/g1')                          // push (scrolls to the top)
 *   navigate('/app', { replace: true })                 // swap out the page on screen
 *   goBack('/app/groups')                               // back a page, or there when nothing is beneath
 *   <Link to="/app/friends">People</Link>               // a real link; plain clicks stay in the app
 */
import {
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type JSX,
  type MouseEvent,
  type Ref,
} from 'react'
import { resolveDestination } from './nav/entry'
import {
  historyDriver,
  resetHistoryDriver,
  watchHistory,
  type NavDirection,
  type NavigateOptions,
  type NavLocation,
} from './nav/historyDriver'
import { matchPath, matchRoute, type RouteMatch } from './nav/match'

export { matchPath, matchRoute, type RouteMatch }
export type { NavDirection, NavigateOptions, NavLocation }
export { useBackClose } from './nav/useBackClose'

const readLocation = (): NavLocation => historyDriver().location()
const readDirection = (): NavDirection => historyDriver().direction()

/** The page on screen. Re-renders on page changes only (not on sheets or bill-flow steps). */
export function useLocation(): NavLocation {
  return useSyncExternalStore(watchHistory, readLocation, readLocation)
}

/**
 * Which way the last change of page went: `forward` (a push, or Forward), `back` (Back,
 * `goBack`), or `none` (the first page of the visit, or a replace — e.g. a tab switch).
 */
export function useNavDirection(): NavDirection {
  return useSyncExternalStore(watchHistory, readDirection, readDirection)
}

function firstMatch<T extends string>(table: readonly T[], path: string): { pattern: T | null; params: Record<string, string> } {
  for (const pattern of table) {
    const params = matchPath(pattern, path)
    if (params) return { pattern, params }
  }
  return { pattern: null, params: {} }
}

/** The first pattern of `table` that matches the current path, with its params. */
export function useRoute<T extends string>(table: readonly T[]): { pattern: T | null; params: Record<string, string> } {
  const { path } = useLocation()
  return useMemo(() => firstMatch(table, path), [table, path])
}

/** Like `useRoute`, plus the query and hash. */
export function useRouteMatch<T extends string>(table: readonly T[]): RouteMatch & { pattern: T | null } {
  const location = useLocation()
  return useMemo(() => matchRoute(table, location), [table, location])
}

/** The current query (`?group=g1&from=scan`). */
export function useSearchParams(): URLSearchParams {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

/**
 * Goes to `to` (a path like `/app/groups/g1?tab=balances`; other origins get a full navigation).
 * Open sheets close first, leaving no history entries behind. A push scrolls to the top; a
 * replace swaps out the page on screen (inside the bill flow: the whole flow). Going to the page
 * already on screen adds no entry.
 */
export function navigate(to: string, options?: NavigateOptions): void {
  historyDriver().navigate(to, options)
}

/**
 * Back one page (closing any sheets over it; from the bill flow, leaving the whole flow — its own
 * Back steps through it) when the app has a page beneath this one; else replaces this page with
 * `fallback` — so a deep link's back arrow never leaves the app.
 */
export function goBack(fallback?: string): void {
  historyDriver().back(fallback ?? '/app')
}

/**
 * Replaces the page on screen with `to` before it paints — for unknown paths, the onboarding
 * gate and sending installed users from `/` to `/app`. Renders nothing.
 */
export function Redirect({ to }: { to: string }): null {
  useLayoutEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return null
}

/** True when the page on show has one of the app's pages beneath it, so `goBack` stays in the app (read at call time). */
export function canGoBack(): boolean {
  return historyDriver().canGoBack()
}

/** Forgets all navigation state, as after a reload (tests). */
export function resetNavForTests(): void {
  resetHistoryDriver()
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** Where the link goes (becomes its `href`). */
  to: string
  /** Replace the page on screen instead of adding one. */
  replace?: boolean
  ref?: Ref<HTMLAnchorElement>
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/**
 * A real `<a href>` (open in a new tab, copy link and long-press all work) that keeps plain
 * left-clicks and Enter inside the app. Modified clicks, other targets, downloads, other origins
 * and clicks an `onClick` already handled are left to the browser.
 */
export function Link({ to, replace = false, onClick, target, download, ref, ...rest }: LinkProps): JSX.Element {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event)
    if (event.defaultPrevented || !isPlainLeftClick(event)) return
    if ((target !== undefined && target !== '_self') || download !== undefined) return
    if (!resolveDestination(to, window.location)?.internal) return
    event.preventDefault()
    navigate(to, { replace })
  }
  return <a {...rest} ref={ref} href={to} target={target} download={download} onClick={handleClick} />
}
