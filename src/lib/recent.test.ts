import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRecentNames, MAX_RECENT_NAMES, RECENT_NAMES_KEY, rememberNames } from './recent'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recent names', () => {
  it('starts empty', () => {
    expect(getRecentNames()).toEqual([])
  })

  it('remembers most-recent-first without duplicates', () => {
    rememberNames(['Aisha', 'Ben'])
    rememberNames(['Cara', 'ben'])
    expect(getRecentNames()).toEqual(['Cara', 'ben', 'Aisha'])
  })

  it('normalises and drops blanks', () => {
    rememberNames(['  Dev  Patel ', '', '   '])
    expect(getRecentNames()).toEqual(['Dev Patel'])
  })

  it('keeps at most 12', () => {
    rememberNames(Array.from({ length: 20 }, (_, i) => `Person ${i}`))
    const names = getRecentNames()
    expect(names).toHaveLength(MAX_RECENT_NAMES)
    expect(names[0]).toBe('Person 0')
  })

  it('survives corrupt or unexpected storage', () => {
    window.localStorage.setItem(RECENT_NAMES_KEY, '{not json')
    expect(getRecentNames()).toEqual([])
    window.localStorage.setItem(RECENT_NAMES_KEY, JSON.stringify({ a: 1 }))
    expect(getRecentNames()).toEqual([])
    window.localStorage.setItem(RECENT_NAMES_KEY, JSON.stringify(['Ok', 5, null, 'ok']))
    expect(getRecentNames()).toEqual(['Ok'])
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getRecentNames()).toEqual([])
    expect(() => rememberNames(['A'])).not.toThrow()
  })
})
