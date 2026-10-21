import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../domain/types'
import { contrastRatio, parseColor, readCssBlocks, resolveValue, tokenColor, toHex, type Rgba } from './contrast'

/*
 * Stylesheets are read from disk: Vitest stubs CSS imports (even `?raw`) to empty strings. The
 * client tsconfig has no Node types, so the two fs functions used are typed here.
 */
interface Fs {
  readFileSync: (path: string, encoding: 'utf8') => string
  readdirSync: (path: string) => string[]
}
interface NodeUrl {
  fileURLToPath: (url: string) => string
}
const [FS_MODULE, URL_MODULE] = ['node:fs', 'node:url']
const fs = (await import(/* @vite-ignore */ FS_MODULE)) as Fs
const { fileURLToPath } = (await import(/* @vite-ignore */ URL_MODULE)) as NodeUrl
const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url).href)
const read = (relative: string): string => fs.readFileSync(path(relative), 'utf8')

const css = read('./tokens.css')

/** Every stylesheet the design system owns, as source text (path → CSS). */
const SHEETS: Record<string, string> = Object.fromEntries([
  ['styles/global.css', read('./global.css')],
  ...fs
    .readdirSync(path('../components/'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => [`components/${f}`, read(`../components/${f}`)]),
])

const blocks = readCssBlocks(css)

const THEMES = ['light', 'dark'] as const
const ACCENTS = ['lime', 'mint', 'sky', 'violet', 'coral'] as const
type Theme = (typeof THEMES)[number]
type Accent = (typeof ACCENTS)[number]

function block(selector: string, media: string | null = null): Record<string, string> {
  const found = blocks.find((b) => b.selector === selector && b.media === media)
  if (!found) throw new Error(`tokens.css has no block ${selector} ${media ?? ''}`)
  return found.decls
}

const BASE = block(':root')
const DARK = block(":root[data-theme='dark']")
const DARK_SYSTEM = block(":root:not([data-theme='light'])", '@media(prefers-color-scheme:dark)')

function tokens(theme: Theme, accent: Accent): Record<string, string> {
  return {
    ...BASE,
    ...(theme === 'dark' ? DARK : {}),
    ...(accent === 'lime' ? {} : block(`:root[data-accent='${accent}']`)),
  }
}

interface Pair {
  fg: string
  bg: string
  /** Opaque token a translucent `bg` is composited over (what scrolls underneath). */
  over?: string
  /** 4.5 for text, 3 for UI boundaries and meaningful graphics (WCAG 1.4.3 / 1.4.11). */
  min: 4.5 | 3
  use: string
}

const text = (fg: string, bg: string, use: string, over?: string): Pair => ({ fg, bg, use, min: 4.5, over })
const ui = (fg: string, bg: string, use: string, over?: string): Pair => ({ fg, bg, use, min: 3, over })

const PAIRS: readonly Pair[] = [
  ...['--bg', '--surface', '--surface-2', '--surface-3'].map((bg) => text('--ink', bg, 'Primary text')),
  ...['--bg', '--surface', '--surface-2', '--surface-3'].map((bg) => text('--ink-2', bg, 'Secondary text')),
  ...['--bg', '--surface', '--surface-2'].map((bg) => text('--ink-placeholder', bg, 'Placeholders')),
  text('--ink', '--header-bg', 'Sticky header over the canvas', '--bg'),
  text('--ink', '--header-bg', 'Sticky header over a dark card', '--balance-card-bg'),
  text('--on-primary', '--primary', 'Primary button'),
  text('--on-primary', '--primary-hover', 'Primary button (hover)'),
  text('--on-accent', '--accent', 'Accent fill'),
  text('--on-accent', '--accent-hover', 'Accent fill (hover)'),
  text('--on-accent', '--amount-selection', 'Selected amount text'),
  text('--ink', '--accent-soft', 'Text on accent tint'),
  ...['--bg', '--surface', '--surface-2', '--accent-soft'].map((bg) => text('--accent-ink', bg, 'Accent-coloured text')),
  ...['--bg', '--surface', '--positive-soft'].map((bg) => text('--positive', bg, 'Positive amounts')),
  ...['--bg', '--surface', '--negative-soft'].map((bg) => text('--negative', bg, 'Negative amounts, errors')),
  ...['--bg', '--surface', '--warning-soft'].map((bg) => text('--warning-ink', bg, 'Warnings')),
  ...['--pro-1', '--pro-2', '--pro-3'].map((bg) => text('--on-pro', bg, 'Pro gradient')),
  text('--balance-card-ink', '--balance-card-bg', 'Balance card'),
  text('--balance-card-ink-2', '--balance-card-bg', 'Balance card secondary'),
  text('--balance-card-ink-2', '--balance-card-glow', 'Balance card secondary over its glow', '--balance-card-bg'),
  text('--tabbar-ink', '--tabbar-bg', 'Tab label over the canvas', '--bg'),
  text('--tabbar-ink', '--tabbar-bg', 'Tab label over a dark card', '--balance-card-bg'),
  text('--tabbar-ink', '--tabbar-bg', 'Tab label over ink content', '--primary'),
  text('--tabbar-ink-active', '--tabbar-bg', 'Active tab label', '--bg'),
  ui('--tabbar-icon-active', '--tabbar-pill', 'Active tab icon on its pill'),
  ui('--tabbar-pill', '--tabbar-bg', 'Active tab pill', '--bg'),
  text('--qr-ink', '--qr-paper', 'QR modules'),
  ...CATEGORY_IDS.map((id) => text(`--cat-${id}-ink`, `--cat-${id}-bg`, `Category tile: ${id}`)),
  ...CATEGORY_IDS.map((id) => ui(`--cat-${id}-ink`, '--surface', `Chart segment: ${id}`)),
  ...Array.from({ length: 8 }, (_, i) => text(`--avatar-${i}-ink`, `--avatar-${i}-bg`, `Avatar ${i}`)),
  ...['--bg', '--surface', '--surface-2'].map((bg) => ui('--ink-3', bg, 'Field boundaries, icons')),
  ...['--bg', '--surface', '--surface-2'].map((bg) => ui('--focus-ring', bg, 'Focus ring')),
  ui('--primary', '--bg', 'Primary button edge'),
  ui('--switch-on-track', '--surface', 'Switch on'),
  ui('--switch-on-thumb', '--switch-on-track', 'Switch thumb (on)'),
  ui('--switch-off-track', '--surface', 'Switch off'),
  ui('--switch-off-thumb', '--switch-off-track', 'Switch thumb (off)'),
  ui('--chart-bar', '--surface', 'Chart bars'),
  ui('--chart-bar-active', '--surface', 'Highlighted chart bar'),
  ui('--ring-fill', '--surface', 'Progress ring'),
]

function ratio(pair: Pair, decls: Record<string, string>): number {
  const fg = tokenColor(pair.fg, decls)
  const bg = tokenColor(pair.bg, decls)
  const backdrop: Rgba | undefined = pair.over ? tokenColor(pair.over, decls) : undefined
  return contrastRatio(fg, bg, backdrop)
}

const label = (p: Pair): string => `${p.fg} on ${p.bg}${p.over ? ` (over ${p.over})` : ''}`

describe('tokens.css structure', () => {
  it('keeps the system-dark block identical to the explicit dark theme', () => {
    expect(DARK_SYSTEM).toEqual(DARK)
  })

  it('keeps every v2 token name', () => {
    const v2 = [
      '--bg', '--surface', '--surface-2', '--surface-3', '--scrim', '--ink', '--ink-2', '--ink-3',
      '--ink-placeholder', '--line', '--line-strong', '--primary', '--primary-hover', '--on-primary',
      '--accent', '--accent-soft', '--on-accent', '--accent-ink', '--positive', '--positive-soft',
      '--negative', '--negative-soft', '--warning-ink', '--warning-soft', '--focus-ring',
      '--font-sans', '--font-mono', '--text-display', '--text-title', '--text-headline', '--text-body',
      '--text-label', '--text-caption', '--text-micro', '--tracking-tight', '--tracking-display',
      '--s-1', '--s-2', '--s-3', '--s-4', '--s-5', '--s-6', '--s-8', '--s-10', '--s-12', '--s-16',
      '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-pill', '--shadow-sm', '--shadow-md', '--shadow-lg',
      '--shadow-sheet', '--ease-out', '--ease-spring', '--dur-1', '--dur-2', '--dur-3', '--app-max',
      '--gutter', '--tap', '--btn-h', '--safe-top', '--safe-bottom',
      ...Array.from({ length: 8 }, (_, i) => [`--avatar-${i}-bg`, `--avatar-${i}-ink`]).flat(),
    ]
    expect(v2.filter((name) => BASE[name] === undefined)).toEqual([])
  })

  it('defines a tint and an ink for every category in both themes', () => {
    for (const id of CATEGORY_IDS) {
      for (const decls of [BASE, DARK]) {
        expect(parseColor(decls[`--cat-${id}-bg`] ?? '')).not.toBeNull()
        expect(parseColor(decls[`--cat-${id}-ink`] ?? '')).not.toBeNull()
      }
    }
  })

  it('gives every accent palette the same set of tokens', () => {
    const keys = ['--accent', '--accent-hover', '--accent-soft-light', '--accent-soft-dark', '--accent-ink-light', '--accent-ink-dark']
    for (const accent of ACCENTS.filter((a) => a !== 'lime')) {
      expect(Object.keys(block(`:root[data-accent='${accent}']`)).sort()).toEqual([...keys].sort())
    }
    for (const key of keys) expect(BASE[key]).toBeDefined()
  })

  it('resolves every token reference in every theme and accent', () => {
    for (const theme of THEMES) {
      for (const accent of ACCENTS) {
        const decls = tokens(theme, accent)
        for (const value of Object.values(decls)) expect(() => resolveValue(value, decls)).not.toThrow()
      }
    }
  })
})

describe('design-system CSS', () => {
  it('reads every stylesheet', () => {
    expect(Object.keys(SHEETS).length).toBeGreaterThan(25)
  })

  it('only references declared tokens (or locals / fallbacks)', () => {
    const missing: string[] = []
    for (const [file, raw] of Object.entries(SHEETS)) {
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, '')
      const local = new Set(Array.from(source.matchAll(/(--[\w-]+)\s*:/g), (m) => m[1]))
      for (const m of source.matchAll(/var\((--[\w-]+)\s*(,)?/g)) {
        const name = m[1] ?? ''
        if (m[2] === ',' || local.has(name) || BASE[name] !== undefined) continue
        missing.push(`${file}: ${name}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('never branches on the system colour scheme (themes come from tokens)', () => {
    const offenders = Object.entries(SHEETS)
      .filter(([, source]) => source.includes('prefers-color-scheme'))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})

describe('WCAG contrast', () => {
  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      it(`meets AA in ${theme} with the ${accent} accent`, () => {
        const decls = tokens(theme, accent)
        const failures = PAIRS.map((p) => ({ pair: label(p), ratio: ratio(p, decls), min: p.min }))
          .filter((r) => r.ratio < r.min)
          .map((r) => `${r.pair}: ${r.ratio.toFixed(2)} < ${r.min}`)
        expect(failures).toEqual([])
      })
    }
  }

  it('is documented in contrast.md (run `npx vitest run src/styles -u` after changing tokens)', async () => {
    const fmt = (n: number): string => n.toFixed(2)
    const lines = [
      '# Settle colour contrast (WCAG 2.2 AA)',
      '',
      'Generated by `src/styles/tokens.test.ts` from `tokens.css` — do not edit by hand.',
      'Text needs 4.5:1, UI boundaries and meaningful graphics 3:1. Translucent backgrounds are',
      'composited over the token in brackets (what can scroll underneath).',
      '',
      '## Default accent (lime)',
      '',
      '| Pair | Use | Min | Light | Dark |',
      '| --- | --- | ---: | ---: | ---: |',
    ]
    const light = tokens('light', 'lime')
    const dark = tokens('dark', 'lime')
    for (const p of PAIRS) {
      lines.push(`| \`${label(p)}\` | ${p.use} | ${p.min} | ${fmt(ratio(p, light))} | ${fmt(ratio(p, dark))} |`)
    }
    lines.push('', '## Accent palettes (pairs that change with the accent)', '', '| Accent | Pair | Min | Light | Dark |', '| --- | --- | ---: | ---: | ---: |')
    for (const accent of ACCENTS.filter((a) => a !== 'lime')) {
      const l = tokens('light', accent)
      const d = tokens('dark', accent)
      for (const p of PAIRS) {
        const changed = [ratio(p, l) !== ratio(p, light), ratio(p, d) !== ratio(p, dark)].some(Boolean)
        if (changed) lines.push(`| ${accent} (\`${toHex(tokenColor('--accent', l))}\`) | \`${label(p)}\` | ${p.min} | ${fmt(ratio(p, l))} | ${fmt(ratio(p, d))} |`)
      }
    }
    lines.push(
      '',
      '## Notes',
      '',
      '- `--ink-3` is never used for text (it is for icons, chevrons, field boundaries and disabled states).',
      '- Lime and the other accent fills are too light for text on white; they always carry `--on-accent`',
      '  text, and accent-coloured text uses `--accent-ink`.',
      '- Selected chips and people use the accent fill *plus* a check mark, so the state never relies on',
      '  the fill alone.',
      '',
    )
    await expect(lines.join('\n')).toMatchFileSnapshot('./contrast.md')
  })
})
