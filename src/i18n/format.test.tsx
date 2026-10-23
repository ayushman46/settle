import { render } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EN } from './en'
import { formatCount, formatMessage, formatRich, parseMessage } from './format'
import { LANGUAGES, intlLocale, isLanguageCode } from './languages'
import { useLang, useT } from './react'
import { getLanguage, hasMessage, registerCatalog, resetI18nForTests, setLanguage, t, tx } from './runtime'

afterEach(() => {
  resetI18nForTests()
})

describe('formatMessage — the ICU subset', () => {
  it('fills arguments; numbers in Indian format with Latin digits', () => {
    expect(formatMessage('{name} owes you {amount}', { name: 'Riya', amount: '₹500' })).toBe('Riya owes you ₹500')
    expect(formatMessage('{n} people', { n: 1234567 })).toBe('12,34,567 people')
    expect(formatMessage('{n, number} paise', { n: 100000 })).toBe('1,00,000 paise')
    expect(formatMessage('plain text')).toBe('plain text')
    expect(formatMessage('')).toBe('')
  })

  it('plural: exact =N first, then the plural rule, with # as the count', () => {
    const msg = '{count, plural, =0 {Free AI splits used today} one {# free split today} other {# free splits today}}'
    expect(formatMessage(msg, { count: 0 })).toBe('Free AI splits used today')
    expect(formatMessage(msg, { count: 1 })).toBe('1 free split today')
    expect(formatMessage(msg, { count: 3 })).toBe('3 free splits today')
    expect(formatMessage(msg, { count: 100000 })).toBe('1,00,000 free splits today')
  })

  it('plural rules follow the language: Hindi says one for 0 and 1', () => {
    const msg = '{count, plural, one {# स्प्लिट बचा} other {# स्प्लिट बचे}}'
    expect(formatMessage(msg, { count: 0 }, 'hi-IN')).toBe('0 स्प्लिट बचा')
    expect(formatMessage(msg, { count: 1 }, 'hi-IN')).toBe('1 स्प्लिट बचा')
    expect(formatMessage(msg, { count: 2 }, 'hi-IN')).toBe('2 स्प्लिट बचे')
    expect(formatMessage(msg, { count: 0 }, 'en-IN')).toBe('0 स्प्लिट बचे')
  })

  it('select: the exact key, else other; nested plural and arguments inside', () => {
    const msg = '{who, select, me {You are marked as paid} other {{name} is marked as paid}}'
    expect(formatMessage(msg, { who: 'me' })).toBe('You are marked as paid')
    expect(formatMessage(msg, { who: 'friend', name: 'Sam' })).toBe('Sam is marked as paid')
    const nested = '{who, select, me {You owe {count, plural, one {# person} other {# people}}} other {{name} owes {count, plural, one {# person} other {# people}}}}'
    expect(formatMessage(nested, { who: 'me', count: 2 })).toBe('You owe 2 people')
    expect(formatMessage(nested, { who: 'x', name: 'Riya', count: 1 })).toBe('Riya owes 1 person')
  })

  it('keeps # literal outside a plural, and a plural without a number falls back to other', () => {
    expect(formatMessage('Order #12')).toBe('Order #12')
    expect(formatMessage('{n, plural, one {one} other {many}}', { n: 'lots' })).toBe('many')
  })

  it('leaves a missing value as {name}', () => {
    expect(formatMessage('Hi {name}, pay {amount}', { name: 'Riya' })).toBe('Hi Riya, pay {amount}')
  })

  it('treats malformed pieces as text instead of throwing', () => {
    expect(formatMessage('a } b')).toBe('a } b')
    expect(formatMessage('{count, plural, one {x}', { count: 1 })).toBe('{count, plural, one {x}')
    expect(formatMessage('{x, weird, a {b}} c', { x: 1 })).toBe('{x, weird, a {b}} c')
    expect(formatMessage('5 < 6 and <b>bold')).toBe('5 < 6 and <b>bold')
  })

  it('renders tags as their text in plain output', () => {
    expect(formatMessage('Check <b>{name}</b> before you pay.', { name: 'Ayush' })).toBe('Check Ayush before you pay.')
  })

  it('caches parsed messages', () => {
    const msg = '{a} and {b} — cache me'
    expect(parseMessage(msg)).toBe(parseMessage(msg))
  })

  it('formats counts in Indian style', () => {
    expect(formatCount(123456.5)).toBe('1,23,456.5')
    expect(formatCount(-1000)).toBe('-1,000')
  })
})

describe('formatRich — tags', () => {
  it('hands tag contents to renderers; unknown tags render their text', () => {
    const out = formatRich<string>('Check <b>{name}</b> — <i>now</i>', { name: 'Ayush' }, 'en-IN', { b: (chunk) => `[${chunk.join('')}]` })
    expect(out).toEqual(['Check [Ayush] — now'])
  })

  it('nests tags and plurals', () => {
    const out = formatRich<string>('<b>{n, plural, one {# item} other {# items}}</b> left', { n: 3 }, 'en-IN', { b: (c) => `*${c.join('')}*` })
    expect(out.join('')).toBe('*3 items* left')
  })
})

describe('the runtime (English only until Phase 3)', () => {
  it('t() reads the English catalog', () => {
    expect(t('home.quick.scan')).toBe('Scan bill')
    expect(t('common.count.people', { count: 1 })).toBe('1 person')
    expect(t('common.count.people', { count: 4 })).toBe('4 people')
    expect(getLanguage()).toBe('en')
  })

  it('falls back to English, then to the key itself', async () => {
    registerCatalog('hi', { 'home.quick.scan': 'बिल स्कैन' })
    expect(await setLanguage('hi')).toBe(true)
    expect(t('home.quick.scan')).toBe('बिल स्कैन')
    expect(t('home.quick.split')).toBe('Split amount')
    expect(t('no.such.key' as never)).toBe('no.such.key')
  })

  it('setLanguage to English always works (nothing to load)', async () => {
    expect(await setLanguage('en')).toBe(true)
    expect(getLanguage()).toBe('en')
  })

  it('tx() renders rich text as React nodes', () => {
    registerCatalog('en', { 'home.quick.more': 'See <b>more</b>' } as never)
    const { container } = render(<p>{tx('home.quick.more', {}, { b: (chunk) => <strong>{chunk}</strong> })}</p>)
    expect(container.innerHTML).toBe('<p>See <strong>more</strong></p>')
    registerCatalog('en', {})
  })

  it('useT / useLang re-render on a language change', async () => {
    registerCatalog('hi', { 'home.quick.scan': 'बिल स्कैन' })
    const { result } = renderHook(() => ({ lang: useLang(), label: useT()('home.quick.scan') }))
    expect(result.current).toEqual({ lang: 'en', label: 'Scan bill' })
    await act(async () => {
      await setLanguage('hi')
    })
    expect(result.current).toEqual({ lang: 'hi', label: 'बिल स्कैन' })
  })

  it('knows its keys', () => {
    expect(hasMessage('home.more.title')).toBe(true)
    expect(hasMessage('home.nope')).toBe(false)
    expect(Object.keys(EN).every((key) => /^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(key))).toBe(true)
  })
})

describe('languages', () => {
  it('lists the eight languages with their locales', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi', 'bn', 'mr', 'ta', 'te', 'kn', 'gu'])
    expect(intlLocale('ta')).toBe('ta-IN')
    expect(isLanguageCode('gu')).toBe(true)
    expect(isLanguageCode('fr')).toBe(false)
  })
})
