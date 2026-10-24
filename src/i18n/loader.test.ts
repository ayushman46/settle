/** The language loader: chunks load once, `setLanguage` resolves after they're in, failures stay put. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LanguageCode } from '../domain/types'
import type { Messages } from './types'

const chunks = vi.hoisted(() => {
  const calls: string[] = []
  const gates = new Map<string, { promise: Promise<void>; open: () => void }>()
  const gate = (code: string) => {
    let open = () => {}
    const promise = new Promise<void>((resolve) => {
      open = resolve
    })
    gates.set(code, { promise, open })
  }
  return { calls, gates, gate }
})

const CATALOGS: Partial<Record<LanguageCode, Messages | 'fails'>> = {
  hi: { 'home.quick.scan': 'बिल स्कैन', 'common.count.people': '{count, plural, one {# व्यक्ति} other {# लोग}}' },
  ta: { 'home.quick.scan': 'பில் ஸ்கேன்' },
  bn: 'fails',
}

vi.mock('./load', () => ({
  catalogLoader: (code: LanguageCode) => {
    const catalog = CATALOGS[code]
    if (code === 'en' || catalog === undefined) return null
    return async () => {
      chunks.calls.push(code)
      await chunks.gates.get(code)?.promise
      if (catalog === 'fails') throw new Error('offline')
      return catalog
    }
  },
  hasCatalog: (code: LanguageCode) => code === 'en' || CATALOGS[code] !== undefined,
}))

// The setup file already loaded the runtime (through the data layer), so load it again under the mock.
vi.resetModules()
const { getLanguage, loadLanguage, resetI18nForTests, setLanguage, subscribe, t } = await import('./runtime')

afterEach(() => {
  resetI18nForTests()
  chunks.calls.length = 0
  chunks.gates.clear()
})

describe('setLanguage', () => {
  it('resolves only after the chunk is in, then switches and tells subscribers', async () => {
    chunks.gate('hi')
    const seen: string[] = []
    const off = subscribe(() => seen.push(getLanguage()))
    const switching = setLanguage('hi')
    await Promise.resolve()
    // Still English while the chunk loads: no flash of keys or half a language.
    expect(getLanguage()).toBe('en')
    expect(t('home.quick.scan')).toBe('Scan bill')
    chunks.gates.get('hi')?.open()
    expect(await switching).toBe(true)
    expect(getLanguage()).toBe('hi')
    expect(t('home.quick.scan')).toBe('बिल स्कैन')
    expect(seen).toEqual(['hi'])
    off()
  })

  it('falls back to English, key by key, for what the language lacks', async () => {
    await setLanguage('hi')
    expect(t('home.quick.split')).toBe('Split amount')
    expect(t('common.count.people', { count: 3 })).toBe('3 लोग')
    expect(t('common.count.people', { count: 1 })).toBe('1 व्यक्ति')
  })

  it('sets <html lang>', async () => {
    await setLanguage('ta')
    expect(document.documentElement.lang).toBe('ta')
    await setLanguage('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('stays put when the chunk fails to load, and can try again', async () => {
    expect(await setLanguage('bn')).toBe(false)
    expect(getLanguage()).toBe('en')
    expect(await setLanguage('bn')).toBe(false)
    expect(chunks.calls).toEqual(['bn', 'bn'])
  })

  it('stays put for a language with no catalog at all', async () => {
    expect(await setLanguage('gu')).toBe(false)
    expect(getLanguage()).toBe('en')
  })

  it('loads a chunk once, however many times it is asked for', async () => {
    chunks.gate('hi')
    const a = loadLanguage('hi')
    const b = setLanguage('hi')
    chunks.gates.get('hi')?.open()
    expect(await a).toBe(true)
    expect(await b).toBe(true)
    await setLanguage('en')
    await setLanguage('hi')
    expect(chunks.calls).toEqual(['hi'])
  })

  it('the last choice wins when two chunks race', async () => {
    chunks.gate('hi')
    const first = setLanguage('hi')
    const second = setLanguage('ta')
    expect(await second).toBe(true)
    chunks.gates.get('hi')?.open()
    expect(await first).toBe(false)
    expect(getLanguage()).toBe('ta')
  })
})
