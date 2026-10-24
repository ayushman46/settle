import { describe, expect, it } from 'vitest'
import {
  DISMISS_MS,
  EMPTY_MEMORY,
  countVisit,
  dismissed,
  isStandalone,
  parseMemory,
  platformFor,
  showInstallCard,
  showInstallRow,
  type CardInput,
} from './installState'

const NOW = 1_800_000_000_000
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_MODE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

function card(overrides: Partial<CardInput> = {}): CardInput {
  return { standalone: false, platform: 'android', canPrompt: true, memory: EMPTY_MEMORY, splits: 0, now: NOW, ...overrides }
}

describe('platformFor', () => {
  it('tells iPhone, iPad (in desktop mode too) and Android apart', () => {
    expect(platformFor(IPHONE, 5)).toBe('ios')
    expect(platformFor(IPAD_DESKTOP_MODE, 5)).toBe('ios')
    expect(platformFor(IPAD_DESKTOP_MODE, 0)).toBe('desktop')
    expect(platformFor(ANDROID, 5)).toBe('android')
    expect(platformFor(WINDOWS, 0)).toBe('desktop')
    expect(platformFor('SomeBot/1.0', 0)).toBe('other')
  })
})

describe('isStandalone', () => {
  it('is true for the installed window (display-mode) or iOS navigator.standalone', () => {
    expect(isStandalone(true, undefined)).toBe(true)
    expect(isStandalone(false, true)).toBe(true)
    expect(isStandalone(false, false)).toBe(false)
    expect(isStandalone(false, undefined)).toBe(false)
  })
})

describe('parseMemory', () => {
  it('reads what we wrote and treats anything else as nothing stored', () => {
    expect(parseMemory(null)).toEqual(EMPTY_MEMORY)
    expect(parseMemory('{"visits":3,"dismissedAt":1700000000000}')).toEqual({ visits: 3, dismissedAt: 1_700_000_000_000 })
    expect(parseMemory('not json')).toEqual(EMPTY_MEMORY)
    expect(parseMemory('null')).toEqual(EMPTY_MEMORY)
    expect(parseMemory('{"visits":-1,"dismissedAt":"soon"}')).toEqual(EMPTY_MEMORY)
    expect(parseMemory('{"visits":2.5}')).toEqual({ visits: 0, dismissedAt: null })
  })
})

describe('showInstallCard', () => {
  it('never shows on first paint: no split and only one visit', () => {
    expect(showInstallCard(card({ memory: countVisit(EMPTY_MEMORY) }))).toBe(false)
  })

  it('shows after the first split', () => {
    expect(showInstallCard(card({ splits: 1 }))).toBe(true)
  })

  it('shows from the second visit', () => {
    expect(showInstallCard(card({ memory: { visits: 2, dismissedAt: null } }))).toBe(true)
  })

  it('never shows once installed (standalone)', () => {
    expect(showInstallCard(card({ standalone: true, splits: 4 }))).toBe(false)
  })

  it('stays away for 30 days after a dismissal, then comes back', () => {
    const memory = dismissed({ visits: 5, dismissedAt: null }, NOW)
    expect(showInstallCard(card({ memory, splits: 3, now: NOW + DISMISS_MS - 1 }))).toBe(false)
    expect(showInstallCard(card({ memory, splits: 3, now: NOW + DISMISS_MS }))).toBe(true)
  })

  it('needs the browser prompt or iPhone steps: desktop Safari and others get nothing', () => {
    expect(showInstallCard(card({ canPrompt: false, platform: 'desktop', splits: 2 }))).toBe(false)
    expect(showInstallCard(card({ canPrompt: false, platform: 'ios', splits: 2 }))).toBe(true)
    expect(showInstallCard(card({ canPrompt: false, platform: 'other', splits: 2 }))).toBe(false)
  })
})

describe('showInstallRow', () => {
  it('is there while installing is possible, and gone once installed', () => {
    expect(showInstallRow({ standalone: false, platform: 'android', canPrompt: true })).toBe(true)
    expect(showInstallRow({ standalone: false, platform: 'ios', canPrompt: false })).toBe(true)
    expect(showInstallRow({ standalone: false, platform: 'desktop', canPrompt: false })).toBe(false)
    expect(showInstallRow({ standalone: true, platform: 'ios', canPrompt: false })).toBe(false)
  })
})

describe('countVisit and dismissed', () => {
  it('count up without touching the other fields', () => {
    expect(countVisit({ visits: 1, dismissedAt: 7 })).toEqual({ visits: 2, dismissedAt: 7 })
    expect(dismissed({ visits: 1, dismissedAt: null }, NOW)).toEqual({ visits: 1, dismissedAt: NOW })
  })
})
