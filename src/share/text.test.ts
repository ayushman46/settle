import { describe, expect, it } from 'vitest'
import { cleanText, ellipsize, firstName, hashString, utf8Length } from './text'

describe('cleanText', () => {
  it('collapses whitespace and strips control, format and bidi characters', () => {
    expect(cleanText('  Dinner\n\tat   Toit  ', 60)).toBe('Dinner at Toit')
    expect(cleanText('‮evil‬ name​', 60)).toBe('evil name')
    expect(cleanText('Sam\u0000\u0007', 60)).toBe('Sam')
    expect(cleanText('co­op', 60)).toBe('coop')
    expect(cleanText('a b', 60)).toBe('a b')
  })

  it('drops lone surrogates but keeps emoji sequences whole', () => {
    expect(cleanText('ok\uD800', 60)).toBe('ok')
    expect(cleanText('👩‍💻 Riya', 60)).toBe('👩‍💻 Riya')
  })

  it('normalizes to NFC', () => {
    expect(cleanText('José', 60)).toBe('José')
  })

  it('caps by characters and code units without splitting a character', () => {
    expect(cleanText('abcdef', 3)).toBe('abc')
    expect(cleanText('🍕🍕🍕🍕', 10, 5)).toBe('🍕🍕')
    expect(cleanText('👨‍👩‍👧‍👦👨‍👩‍👧‍👦', 10, 12)).toBe('👨‍👩‍👧‍👦')
    expect(cleanText('ab cd', 3)).toBe('ab')
  })

  it('is idempotent', () => {
    for (const value of ['  a  b ', '🍕'.repeat(50), 'x‮y', 'José '.repeat(20), '👨‍👩‍👧‍👦'.repeat(9)]) {
      const once = cleanText(value, 12, 30)
      expect(cleanText(once, 12, 30)).toBe(once)
    }
  })
})

describe('ellipsize', () => {
  it('adds an ellipsis only when it cuts, counting it in the cap', () => {
    expect(ellipsize('Dinner at Toit', 20)).toBe('Dinner at Toit')
    expect(ellipsize('Dinner at Toit', 8)).toBe('Dinner…')
    expect(Array.from(ellipsize('Dinner at Toit', 8))).toHaveLength(7)
    expect(ellipsize('🦄🦄🦄🦄🦄', 3)).toBe('🦄🦄…')
    expect(ellipsize('🦄🦄🦄🦄🦄', 10, 5)).toBe('🦄🦄…')
    expect(ellipsize('abc', 1)).toBe('a…')
  })
})

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('Neha Sharma')).toBe('Neha')
    expect(firstName('  Riya ')).toBe('Riya')
    expect(firstName('Sam')).toBe('Sam')
    expect(firstName('')).toBe('')
  })
})

describe('hashString', () => {
  it('is a stable 32-bit FNV-1a', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('a')).toBe(0xe40c292c)
    expect(hashString('foobar')).toBe(0xbf9cf968)
    expect(hashString('Riya')).toBe(hashString('Riya'))
    expect(hashString('Riya')).not.toBe(hashString('Riyb'))
  })
})

describe('utf8Length', () => {
  it('counts encoded bytes', () => {
    expect(utf8Length('abc')).toBe(3)
    expect(utf8Length('₹')).toBe(3)
    expect(utf8Length('🍕')).toBe(4)
  })
})
