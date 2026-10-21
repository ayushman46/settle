import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS, type AccentId } from '../../domain/types'
import { avatarColor, AVATAR_COLORS, CARD_ACCENTS, CARD_THEMES, cardTheme, CATEGORY_COLORS, withAlpha, type CardThemeName } from './theme'

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const THEMES: CardThemeName[] = ['light', 'dark']

describe('card palette contrast (WCAG 2.2 AA)', () => {
  it.each(THEMES)('%s: text on the card and the background is at least 4.5:1', (name) => {
    const t = CARD_THEMES[name]
    for (const surface of [t.surface, t.bg]) {
      expect(contrast(t.ink, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.ink2, surface)).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(t.positive, t.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('%s: graphics (paid tick, lime edge, category icons) are at least 3:1', (name) => {
    const t = CARD_THEMES[name]
    expect(contrast(t.onPositive, t.positive)).toBeGreaterThanOrEqual(3)
    expect(contrast(t.positive, t.surface)).toBeGreaterThanOrEqual(3)
    if (t.accentEdge) expect(contrast(t.accentEdge, t.surface2)).toBeGreaterThanOrEqual(3)
    for (const id of CATEGORY_IDS) {
      const c = CATEGORY_COLORS[name][id]
      expect(contrast(c.ink, c.bg), id).toBeGreaterThanOrEqual(3)
      // The category label is text on the card.
      expect(contrast(c.ink, t.surface), id).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('avatar initials are readable on every pastel', () => {
    for (const a of AVATAR_COLORS) expect(contrast(a.ink, a.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('has colours for every category in both themes', () => {
    for (const name of THEMES) expect(Object.keys(CATEGORY_COLORS[name]).sort()).toEqual([...CATEGORY_IDS].sort())
  })
})

describe('cardTheme (accent palettes)', () => {
  const ACCENTS = Object.keys(CARD_ACCENTS) as AccentId[]

  it('is the plain theme in lime', () => {
    for (const name of THEMES) expect(cardTheme(name)).toEqual(CARD_THEMES[name])
    for (const name of THEMES) expect(cardTheme(name, 'lime')).toEqual(CARD_THEMES[name])
  })

  it('swaps the accent fill (and the light edge) and nothing else', () => {
    for (const name of THEMES) {
      for (const accent of ACCENTS) {
        const t = cardTheme(name, accent)
        expect(t.accent).toBe(CARD_ACCENTS[accent].accent)
        expect(t.accentEdge).toBe(name === 'light' ? CARD_ACCENTS[accent].inkLight : null)
        expect({ ...t, accent: null, accentEdge: null }).toEqual({ ...CARD_THEMES[name], accent: null, accentEdge: null })
      }
    }
  })

  it('reads an unknown accent as lime', () => {
    expect(cardTheme('dark', 'neon' as AccentId)).toEqual(CARD_THEMES.dark)
  })

  it.each(THEMES)('%s: every accent keeps ink text readable and its edge visible', (name) => {
    for (const accent of ACCENTS) {
      const t = cardTheme(name, accent)
      expect(contrast(t.onAccent, t.accent), accent).toBeGreaterThanOrEqual(4.5)
      if (t.accentEdge) expect(contrast(t.accentEdge, t.surface2), accent).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('avatarColor', () => {
  it('wraps any integer into the palette', () => {
    expect(avatarColor(0)).toBe(AVATAR_COLORS[0])
    expect(avatarColor(9)).toBe(AVATAR_COLORS[1])
    expect(avatarColor(-1)).toBe(AVATAR_COLORS[7])
    expect(avatarColor(2.7)).toBe(AVATAR_COLORS[2])
    expect(avatarColor(Number.NaN)).toBe(AVATAR_COLORS[0])
  })
})

describe('withAlpha', () => {
  it('turns a hex colour into rgba', () => {
    expect(withAlpha('#cbf266', 0.5)).toBe('rgba(203, 242, 102, 0.5)')
    expect(withAlpha('#000000', 2)).toBe('rgba(0, 0, 0, 1)')
    expect(withAlpha('#FFFFFF', -1)).toBe('rgba(255, 255, 255, 0)')
    expect(withAlpha('red', 0.5)).toBe('red')
  })
})
