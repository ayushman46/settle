import { describe, expect, it } from 'vitest'
import { APP_ROUTES, isAppPath, matchAppRoute, publicPage, WELCOME_PATTERN } from './routes'

describe('the app route table', () => {
  it('matches every app page to one route', () => {
    const cases: Array<[string, string]> = [
      ['/app', '/app'],
      ['/app/', '/app'],
      ['/app/welcome', WELCOME_PATTERN],
      ['/app/groups', '/app/groups'],
      ['/app/groups/g1', '/app/groups/:id'],
      ['/app/groups/g1/settle', '/app/groups/:id/settle'],
      ['/app/activity', '/app/activity'],
      ['/app/you', '/app/you'],
      ['/app/split/new', '/app/split/new'],
      ['/app/split/e1/edit', '/app/split/:id/edit'],
      ['/app/expense/e1', '/app/expense/:id'],
      ['/app/bill', '/app/bill'],
      ['/app/friends', '/app/friends'],
      ['/app/friends/f1', '/app/friends/:id'],
      ['/app/insights', '/app/insights'],
      ['/app/recurring', '/app/recurring'],
      ['/app/recurring/new', '/app/recurring/new'],
      ['/app/recurring/r1', '/app/recurring/:id'],
      ['/app/pro', '/app/pro'],
    ]
    for (const [path, pattern] of cases) expect(matchAppRoute(path)?.pattern, path).toBe(pattern)
  })

  it('knows nothing of other app paths', () => {
    expect(matchAppRoute('/app/nope')).toBeNull()
    expect(matchAppRoute('/app/groups/g1/members')).toBeNull()
    expect(matchAppRoute('/app/split')).toBeNull()
  })

  it('marks exactly the four tab roots', () => {
    expect(APP_ROUTES.filter((r) => r.tab !== null).map((r) => [r.pattern, r.tab])).toEqual([
      ['/app', 'home'],
      ['/app/groups', 'groups'],
      ['/app/activity', 'activity'],
      ['/app/you', 'you'],
    ])
  })

  it('titles every page except the bill flow, which titles its own steps', () => {
    expect(APP_ROUTES.filter((r) => r.title === null).map((r) => r.pattern)).toEqual(['/app/bill'])
  })

  it('lists each pattern once', () => {
    const patterns = APP_ROUTES.map((r) => r.pattern)
    expect(new Set(patterns).size).toBe(patterns.length)
  })
})

describe('public pages', () => {
  it('finds the four public pages, with or without a trailing slash', () => {
    expect(publicPage('/')?.key).toBe('landing')
    expect(publicPage('/pay')?.key).toBe('pay')
    expect(publicPage('/privacy/')?.key).toBe('privacy')
    expect(publicPage('/terms')?.key).toBe('terms')
    expect(publicPage('/pricing')).toBeNull()
    expect(publicPage('/toString')).toBeNull()
    expect(publicPage('/__proto__')).toBeNull()
  })

  it('tells app paths apart', () => {
    expect(isAppPath('/app')).toBe(true)
    expect(isAppPath('/app/groups')).toBe(true)
    expect(isAppPath('/apple')).toBe(false)
    expect(isAppPath('/')).toBe(false)
    expect(isAppPath('/pay')).toBe(false)
  })
})
