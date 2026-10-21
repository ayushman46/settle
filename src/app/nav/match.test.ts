import { describe, expect, it } from 'vitest'
import { matchPath, matchRoute } from './match'

describe('matchPath', () => {
  it('matches literal paths exactly', () => {
    expect(matchPath('/app', '/app')).toEqual({})
    expect(matchPath('/app/groups', '/app/groups')).toEqual({})
    expect(matchPath('/', '/')).toEqual({})
    expect(matchPath('/app', '/app/groups')).toBeNull()
    expect(matchPath('/app/groups', '/app')).toBeNull()
    expect(matchPath('/app/groups', '/app/group')).toBeNull()
    expect(matchPath('/', '/app')).toBeNull()
  })

  it('captures params', () => {
    expect(matchPath('/app/groups/:id', '/app/groups/g1')).toEqual({ id: 'g1' })
    expect(matchPath('/app/split/:id/edit', '/app/split/e-42/edit')).toEqual({ id: 'e-42' })
    expect(matchPath('/app/:section/:id', '/app/friends/f9')).toEqual({ section: 'friends', id: 'f9' })
    expect(matchPath('/app/groups/:id', '/app/groups')).toBeNull()
    expect(matchPath('/app/groups/:id', '/app/groups/g1/settle')).toBeNull()
  })

  it('decodes params, and refuses malformed ones', () => {
    expect(matchPath('/app/friends/:id', '/app/friends/Riya%20S')).toEqual({ id: 'Riya S' })
    expect(matchPath('/app/friends/:id', '/app/friends/%E0%A4%B0')).toEqual({ id: 'र' })
    expect(matchPath('/app/friends/:id', '/app/friends/%E0%A4')).toBeNull()
    expect(matchPath('/app/friends/:id', '/app/friends//')).toBeNull()
  })

  it('ignores one trailing slash, the query and the hash', () => {
    expect(matchPath('/app/groups', '/app/groups/')).toEqual({})
    expect(matchPath('/app/groups/', '/app/groups')).toEqual({})
    expect(matchPath('/app/', '/app')).toEqual({})
    expect(matchPath('/app/groups/:id', '/app/groups/g1?tab=balances#top')).toEqual({ id: 'g1' })
    expect(matchPath('/pay', '/pay#eJyrVg')).toEqual({})
    expect(matchPath('/app/groups', '/app//groups')).toBeNull()
  })

  it('is case-sensitive', () => {
    expect(matchPath('/app/groups', '/App/Groups')).toBeNull()
  })

  it('matches the rest of the path with a trailing *', () => {
    expect(matchPath('/app/*', '/app')).toEqual({ '*': '' })
    expect(matchPath('/app/*', '/app/')).toEqual({ '*': '' })
    expect(matchPath('/app/*', '/app/groups/g1')).toEqual({ '*': 'groups/g1' })
    expect(matchPath('/app/*', '/app/friends/Riya%20S')).toEqual({ '*': 'friends/Riya S' })
    expect(matchPath('/app/*', '/application')).toBeNull()
    expect(matchPath('/app/*', '/app/%E0%A4')).toBeNull()
    expect(matchPath('*', '/anything/at/all')).toEqual({ '*': 'anything/at/all' })
    expect(matchPath('/app/groups/:id/*', '/app/groups/g1/settle')).toEqual({ id: 'g1', '*': 'settle' })
  })

  it('treats * anywhere but the end as a literal', () => {
    expect(matchPath('/app/*/edit', '/app/x/edit')).toBeNull()
    expect(matchPath('/app/*/edit', '/app/*/edit')).toEqual({})
  })
})

describe('matchRoute', () => {
  const ROUTES = ['/app', '/app/groups', '/app/groups/:id', '/app/groups/:id/settle', '/app/*'] as const

  it('returns the first matching pattern with params, query and hash', () => {
    const match = matchRoute(ROUTES, { path: '/app/groups/g1', search: '?tab=balances&x=1', hash: '#top' })
    expect(match.pattern).toBe('/app/groups/:id')
    expect(match.params).toEqual({ id: 'g1' })
    expect(match.path).toBe('/app/groups/g1')
    expect(match.query.get('tab')).toBe('balances')
    expect(match.query.get('x')).toBe('1')
    expect(match.hash).toBe('#top')
  })

  it('order decides between overlapping patterns', () => {
    expect(matchRoute(ROUTES, { path: '/app/insights', search: '', hash: '' })).toMatchObject({
      pattern: '/app/*',
      params: { '*': 'insights' },
    })
    expect(matchRoute(['/app/*', '/app/groups'], { path: '/app/groups', search: '', hash: '' }).pattern).toBe('/app/*')
  })

  it('reports no match', () => {
    const match = matchRoute(['/app', '/pay'], { path: '/nope', search: '?a=1', hash: '' })
    expect(match.pattern).toBeNull()
    expect(match.params).toEqual({})
    expect(match.query.get('a')).toBe('1')
  })
})
