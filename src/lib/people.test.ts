import { describe, expect, it } from 'vitest'
import type { Person } from '../types'
import { graphemes, initials, isDuplicateName, MAX_NAME_LENGTH, nameKey, nextColor, normalizeName } from './people'

const p = (id: string, name: string, color = 0): Person => ({ id, name, color })

describe('initials', () => {
  it('uses first + last word initials, upper-cased', () => {
    expect(initials('aisha')).toBe('A')
    expect(initials('Ben Carter')).toBe('BC')
    expect(initials('mary jane watson')).toBe('MW')
    expect(initials('  zoë   ')).toBe('Z')
    expect(initials('élodie durand')).toBe('ÉD')
  })

  it('is emoji- and symbol-safe', () => {
    expect(initials('👩‍💻 Dev')).toBe('👩‍💻D')
    expect(initials('🇮🇳')).toBe('🇮🇳')
    expect(initials('(Bob)')).toBe('B')
    expect(initials('李小龙')).toBe('李')
  })

  it('returns ? when there is nothing to show', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
    expect(initials('!!!')).toBe('?')
  })
})

describe('graphemes', () => {
  it('keeps emoji sequences whole', () => {
    expect(graphemes('a👩‍💻b')).toEqual(['a', '👩‍💻', 'b'])
  })
})

describe('nextColor', () => {
  it('picks the least-used colour, lowest first', () => {
    expect(nextColor([])).toBe(0)
    expect(nextColor([p('a', 'A', 0)])).toBe(1)
    expect(nextColor([p('a', 'A', 0), p('b', 'B', 2)])).toBe(1)
    const all = Array.from({ length: 8 }, (_, i) => p(String(i), 'X', i))
    expect(nextColor(all)).toBe(0)
    expect(nextColor([...all, p('z', 'Z', 0)])).toBe(1)
  })

  it('ignores invalid colours', () => {
    expect(nextColor([p('a', 'A', 99), p('b', 'B', -1), p('c', 'C', 0.5)])).toBe(0)
  })
})

describe('normalizeName', () => {
  it('trims, collapses spaces and drops control characters', () => {
    expect(normalizeName('  Ben   Carter ')).toBe('Ben Carter')
    expect(normalizeName('Ben\tCarter\n')).toBe('Ben Carter')
    expect(normalizeName('Be\u0000n​')).toBe('Ben')
    expect(normalizeName('👩‍💻')).toBe('👩‍💻')
  })

  it('caps the length in characters', () => {
    const long = 'A'.repeat(40)
    expect(normalizeName(long)).toHaveLength(MAX_NAME_LENGTH)
    expect(graphemes(normalizeName('😀'.repeat(30)))).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('nameKey / isDuplicateName', () => {
  const people = [p('1', 'José'), p('2', 'Ben Carter')]

  it('compares case- and accent-insensitively', () => {
    expect(nameKey('  JOSÉ ')).toBe('jose')
    expect(isDuplicateName('jose', people)).toBe(true)
    expect(isDuplicateName('ben  carter', people)).toBe(true)
    expect(isDuplicateName('Ben', people)).toBe(false)
    expect(isDuplicateName('   ', people)).toBe(false)
  })

  it('can skip one person (rename)', () => {
    expect(isDuplicateName('jose', people, '1')).toBe(false)
    expect(isDuplicateName('jose', people, '2')).toBe(true)
  })
})
