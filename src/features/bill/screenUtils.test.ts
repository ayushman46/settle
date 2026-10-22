import { afterEach, describe, expect, it, vi } from 'vitest'
import { plural, revealElement, revokeUrl } from './screenUtils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('plural', () => {
  it('picks the right noun', () => {
    expect(plural(0, 'item')).toBe('0 items')
    expect(plural(1, 'item')).toBe('1 item')
    expect(plural(3, 'person', 'people')).toBe('3 people')
    expect(plural(1, 'person', 'people')).toBe('1 person')
  })
})

describe('revokeUrl', () => {
  it('frees blob URLs only and never throws', () => {
    const revoke = vi.fn(() => {
      throw new Error('already revoked')
    })
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }))
    expect(() => revokeUrl('blob:http://localhost/abc')).not.toThrow()
    revokeUrl('data:image/png;base64,AAAA')
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/abc')
  })
})

describe('revealElement', () => {
  it('scrolls when it can and never throws when it cannot', () => {
    const el = document.createElement('div')
    expect(() => revealElement(el)).not.toThrow()
    const scrollIntoView = vi.fn()
    el.scrollIntoView = scrollIntoView
    revealElement(el)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
    expect(() => revealElement(null)).not.toThrow()
  })

  it('scrolls smoothly when motion is welcome', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query })))
    const el = document.createElement('div')
    const scrollIntoView = vi.fn()
    el.scrollIntoView = scrollIntoView
    revealElement(el)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
  })
})
