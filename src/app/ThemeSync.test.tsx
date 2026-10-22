import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateProfile } from '../data'
import { installPro, resetProScreens, testSigner } from '../features/pro/testing'
import { haptic, hapticsEnabled, resetHapticsForTests } from '../lib/haptics'
import { applyAppearance, applyStoredAppearance, clearAppearance, effectiveAccent, THEME_COLORS } from './appearance'
import { ThemeSync } from './ThemeSync'

const root = document.documentElement

function themeColors(): string[] {
  return [...document.head.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content') ?? '')
}

beforeEach(async () => {
  resetProScreens()
  await testSigner()
  // The two tags index.html ships with.
  document.head.innerHTML =
    '<meta name="theme-color" content="#F5F6F8" media="(prefers-color-scheme: light)">' +
    '<meta name="theme-color" content="#0B0C0E" media="(prefers-color-scheme: dark)">'
})

afterEach(() => {
  clearAppearance()
  document.head.innerHTML = ''
  vi.unstubAllGlobals()
  resetProScreens()
})

describe('applyAppearance', () => {
  it('leaves the system theme and lime as the plain defaults', () => {
    applyAppearance({ theme: 'system', accent: 'lime' })
    expect(root.hasAttribute('data-theme')).toBe(false)
    expect(root.hasAttribute('data-accent')).toBe(false)
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.dark])
  })

  it('writes a chosen theme and accent, and paints both theme-color tags to match', () => {
    applyAppearance({ theme: 'dark', accent: 'violet' })
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.getAttribute('data-accent')).toBe('violet')
    expect(themeColors()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark])

    applyAppearance({ theme: 'light', accent: 'lime' })
    expect(root.getAttribute('data-theme')).toBe('light')
    expect(root.hasAttribute('data-accent')).toBe(false)
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.light])
  })

  it('hands each theme-color tag its own colour back for the system theme', () => {
    applyAppearance({ theme: 'dark', accent: 'lime' })
    applyAppearance({ theme: 'system', accent: 'lime' })
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.dark])
  })

  it('only shows a Pro accent while themes are unlocked', () => {
    expect(effectiveAccent('coral', true)).toBe('coral')
    expect(effectiveAccent('coral', false)).toBe('lime')
  })
})

describe('applyStoredAppearance', () => {
  it('applies the saved theme before anything renders', () => {
    updateProfile({ theme: 'dark', accent: 'sky' })
    applyStoredAppearance()
    expect(root.getAttribute('data-theme')).toBe('dark')
    // No Pro on this device: the saved accent waits.
    expect(root.hasAttribute('data-accent')).toBe(false)
  })

  it('keeps a saved Pro accent when Pro is on', async () => {
    await installPro()
    updateProfile({ accent: 'mint' })
    applyStoredAppearance()
    expect(root.getAttribute('data-accent')).toBe('mint')
  })
})

describe('ThemeSync', () => {
  it('follows the profile as it changes, before paint', () => {
    render(<ThemeSync />)
    expect(root.hasAttribute('data-theme')).toBe(false)

    act(() => {
      updateProfile({ theme: 'dark' })
    })
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(themeColors()).toEqual([THEME_COLORS.dark, THEME_COLORS.dark])

    act(() => {
      updateProfile({ theme: 'system' })
    })
    expect(root.hasAttribute('data-theme')).toBe(false)
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.dark])
  })

  it('shows the saved accent with Pro, and lime without it', async () => {
    updateProfile({ accent: 'violet' })
    const free = render(<ThemeSync />)
    expect(root.hasAttribute('data-accent')).toBe(false)
    free.unmount()

    await installPro()
    render(<ThemeSync />)
    expect(root.getAttribute('data-accent')).toBe('violet')
    act(() => {
      updateProfile({ accent: 'coral' })
    })
    expect(root.getAttribute('data-accent')).toBe('coral')
  })

  it('puts the defaults back when it goes', () => {
    updateProfile({ theme: 'light' })
    const view = render(<ThemeSync />)
    expect(root.getAttribute('data-theme')).toBe('light')
    view.unmount()
    expect(root.hasAttribute('data-theme')).toBe(false)
    expect(themeColors()).toEqual([THEME_COLORS.light, THEME_COLORS.dark])
  })
})

describe('haptics', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate')
    resetHapticsForTests()
  })

  it('silences every cue while the Haptics switch is off, and brings them back', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query })))
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    resetHapticsForTests()
    const view = render(<ThemeSync />)
    haptic('tap')
    expect(vibrate).toHaveBeenCalledTimes(1)

    act(() => {
      updateProfile({ haptics: false })
    })
    expect(hapticsEnabled()).toBe(false)
    haptic('success')
    expect(vibrate).toHaveBeenCalledTimes(1)

    act(() => {
      updateProfile({ haptics: true })
    })
    haptic('success')
    expect(vibrate).toHaveBeenCalledTimes(2)

    // Turned off, then unmounted (tests, a remount): cues are on again rather than stuck off.
    act(() => {
      updateProfile({ haptics: false })
    })
    view.unmount()
    expect(hapticsEnabled()).toBe(true)
  })
})
