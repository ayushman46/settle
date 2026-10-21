/**
 * Path patterns for the route table: literal segments, `:name` params (one non-empty segment,
 * URL-decoded) and a trailing `*` that matches the rest of the path (zero or more segments,
 * available as `params['*']`). A single trailing slash is ignored and matching is case-sensitive.
 *
 *   matchPath('/app/groups/:id', '/app/groups/g1')   → { id: 'g1' }
 *   matchPath('/app/*', '/app/groups/g1')            → { '*': 'groups/g1' }
 *   matchPath('/app/groups/:id', '/app/groups')      → null
 */
import type { NavLocation } from './historyDriver'

export interface RouteMatch {
  path: string
  /** The first pattern of the table that matched; null when none did. */
  pattern: string | null
  params: Record<string, string>
  query: URLSearchParams
  /** Including the `#`, or ''. */
  hash: string
}

/** A path's segments, ignoring any query/hash, the leading slash and one trailing slash. */
function segments(path: string): string[] {
  const end = path.search(/[?#]/)
  let bare = end === -1 ? path : path.slice(0, end)
  if (bare.startsWith('/')) bare = bare.slice(1)
  if (bare.endsWith('/')) bare = bare.slice(0, -1)
  return bare === '' ? [] : bare.split('/')
}

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** The params of `path` under `pattern`, or null when it doesn't match. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = segments(pattern)
  const have = segments(path)
  const params: Record<string, string> = {}
  for (let index = 0; index < want.length; index++) {
    const expected = want[index] ?? ''
    if (expected === '*' && index === want.length - 1) {
      const rest: string[] = []
      for (const segment of have.slice(index)) {
        const value = decode(segment)
        if (value === null) return null
        rest.push(value)
      }
      params['*'] = rest.join('/')
      return params
    }
    const actual = have[index]
    if (actual === undefined) return null
    if (expected.startsWith(':')) {
      const value = decode(actual)
      if (value === null || value === '') return null
      params[expected.slice(1)] = value
    } else if (expected !== actual) {
      return null
    }
  }
  return have.length === want.length ? params : null
}

/** The first pattern of `table` matching `location`, with its params, query and hash. */
export function matchRoute<T extends string>(
  table: readonly T[],
  location: NavLocation,
): RouteMatch & { pattern: T | null } {
  const query = new URLSearchParams(location.search)
  for (const pattern of table) {
    const params = matchPath(pattern, location.path)
    if (params) return { path: location.path, pattern, params, query, hash: location.hash }
  }
  return { path: location.path, pattern: null, params: {}, query, hash: location.hash }
}
