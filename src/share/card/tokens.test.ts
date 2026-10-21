/**
 * Share cards can't read CSS variables, so `theme.ts` copies the v3 tokens. This test fails as
 * soon as the two drift apart — update `theme.ts` to match `src/styles/tokens.css`.
 */
import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../../domain/types'
import { readCssBlocks } from '../../styles/contrast'
import { AVATAR_COLORS, CARD_ACCENTS, CARD_THEMES, CATEGORY_COLORS, type CardThemeName } from './theme'

// Vitest stubs CSS imports (even `?raw`), so the stylesheet is read from disk. The client
// tsconfig has no Node types; the two functions used are typed here.
const [FS_MODULE, URL_MODULE] = ['node:fs', 'node:url']
const fs = (await import(/* @vite-ignore */ FS_MODULE)) as { readFileSync: (path: string, encoding: 'utf8') => string }
const { fileURLToPath } = (await import(/* @vite-ignore */ URL_MODULE)) as { fileURLToPath: (url: string) => string }
// A variable, not a literal: Vite rewrites `new URL('literal', import.meta.url)` into an asset URL.
const TOKENS = '../../styles/tokens.css'
const blocks = readCssBlocks(fs.readFileSync(fileURLToPath(new URL(TOKENS, import.meta.url).href), 'utf8'))

function decls(selector: string): Record<string, string> {
  const found = blocks.find((b) => b.selector === selector && b.media === null)
  if (!found) throw new Error(`No ${selector} block in tokens.css`)
  return Object.fromEntries(Object.entries(found.decls).map(([k, v]) => [k, v.toLowerCase()]))
}

const VARS: Readonly<Record<CardThemeName, Record<string, string>>> = {
  light: decls(':root'),
  dark: { ...decls(':root'), ...decls(":root[data-theme='dark']") },
}

const THEME_KEYS = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  ink: '--ink',
  ink2: '--ink-2',
  line: '--line',
  lineStrong: '--line-strong',
  accent: '--accent',
  onAccent: '--on-accent',
  positive: '--positive',
} as const

describe('share-card colours match the design tokens', () => {
  it.each(['light', 'dark'] as const)('%s theme', (name) => {
    for (const [key, token] of Object.entries(THEME_KEYS)) {
      expect(CARD_THEMES[name][key as keyof typeof THEME_KEYS], `${name} ${token}`).toBe(VARS[name][token])
    }
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_COLORS[name][id].bg, `${name} --cat-${id}-bg`).toBe(VARS[name][`--cat-${id}-bg`])
      expect(CATEGORY_COLORS[name][id].ink, `${name} --cat-${id}-ink`).toBe(VARS[name][`--cat-${id}-ink`])
    }
  })

  it('avatars', () => {
    AVATAR_COLORS.forEach((color, i) => {
      expect(color.bg, `--avatar-${i}-bg`).toBe(VARS.light[`--avatar-${i}-bg`])
      expect(color.ink, `--avatar-${i}-ink`).toBe(VARS.light[`--avatar-${i}-ink`])
    })
  })

  it('the lime edge is the light accent ink', () => {
    expect(CARD_THEMES.light.accentEdge).toBe(VARS.light['--accent-ink-light'])
  })

  it('accent palettes', () => {
    for (const [accent, palette] of Object.entries(CARD_ACCENTS)) {
      const vars = accent === 'lime' ? VARS.light : decls(`:root[data-accent='${accent}']`)
      expect(palette.accent, `${accent} --accent`).toBe(vars['--accent'])
      expect(palette.inkLight, `${accent} --accent-ink-light`).toBe(vars['--accent-ink-light'])
    }
  })
})
