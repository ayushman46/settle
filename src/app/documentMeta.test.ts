/**
 * The page's own metadata — index.html and the web manifest — kept in step with the brand and the
 * design tokens: names, the installed app's start page and shortcuts, and theme colours that
 * match the canvas in each theme (the browser chrome blends into the app).
 */
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import manifestText from '../../public/manifest.webmanifest?raw'
import { BRAND } from '../domain/types'
import { THEME_COLORS } from './appearance'
import { matchAppRoute } from './routes'

/*
 * tokens.css is read from disk: Vitest stubs CSS imports (even `?raw`) to empty strings. The
 * client tsconfig has no Node types, so the one fs function used is typed here.
 */
interface Fs {
  readFileSync: (path: string, encoding: 'utf8') => string
}
interface NodeUrl {
  fileURLToPath: (url: string) => string
}
const [FS_MODULE, URL_MODULE] = ['node:fs', 'node:url']
const fs = (await import(/* @vite-ignore */ FS_MODULE)) as Fs
const { fileURLToPath } = (await import(/* @vite-ignore */ URL_MODULE)) as NodeUrl
// A variable, not a literal: Vite rewrites `new URL('literal', import.meta.url)` into an asset URL.
const TOKENS_PATH = '../styles/tokens.css'
const tokens = fs.readFileSync(fileURLToPath(new URL(TOKENS_PATH, import.meta.url).href), 'utf8')

const page = new DOMParser().parseFromString(html, 'text/html')

interface Manifest {
  id: string
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  background_color: string
  theme_color: string
  icons: Array<{ src: string; purpose: string }>
  shortcuts: Array<{ name: string; short_name: string; url: string }>
}

const manifest = JSON.parse(manifestText) as Manifest

function meta(selector: string): string | null {
  return page.head.querySelector(selector)?.getAttribute('content') ?? null
}

/** `--bg` in the light :root block and in the dark block. */
function canvas(): { light: string; dark: string } {
  const light = /:root\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1]
  const dark = /:root\[data-theme='dark'\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1]
  return { light: (light ?? '').toUpperCase(), dark: (dark ?? '').toUpperCase() }
}

describe('index.html', () => {
  it('names the page after the brand, with its tagline', () => {
    expect(page.title).toBe(`${BRAND.name} — ${BRAND.tagline}`)
    expect(meta('meta[name="apple-mobile-web-app-title"]')).toBe(BRAND.name)
    expect(meta('meta[name="application-name"]')).toBe(BRAND.name)
    expect(meta('meta[property="og:site_name"]')).toBe(BRAND.name)
    expect(html).not.toMatch(/billsplit/i)
  })

  it('describes Settle for search results and link previews', () => {
    expect(meta('meta[name="description"]')).toMatch(/split.*UPI/i)
    expect(meta('meta[property="og:title"]')).toBe(`${BRAND.name} — ${BRAND.tagline}`)
    expect(meta('meta[property="og:description"]')).toMatch(/UPI/)
    expect(meta('meta[property="og:image"]')).toBe('/icon-512.png')
  })

  it('paints the browser chrome in the app’s canvas colour for each theme', () => {
    const { light, dark } = canvas()
    expect(light).toBe(THEME_COLORS.light)
    expect(dark).toBe(THEME_COLORS.dark)
    expect(meta('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toBe(THEME_COLORS.light)
    expect(meta('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toBe(THEME_COLORS.dark)
  })

  it('keeps the keyboard-aware viewport and links the manifest and icons', () => {
    expect(meta('meta[name="viewport"]')).toContain('interactive-widget=resizes-content')
    expect(meta('meta[name="viewport"]')).toContain('viewport-fit=cover')
    expect(page.head.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest')
    expect(page.head.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/icon.svg')
    expect(page.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/apple-touch-icon.png')
    expect(page.body.querySelector('#root')).not.toBeNull()
    expect(page.body.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/src/main.tsx')
  })
})

describe('web manifest', () => {
  it('installs as Settle and opens on the app', () => {
    expect(manifest.short_name).toBe(BRAND.name)
    expect(manifest.name).toMatch(new RegExp(`^${BRAND.name}`))
    expect(manifest.start_url).toBe('/app')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    // Unchanged from BillSplit, so phones that installed it update in place.
    expect(manifest.id).toBe('/')
  })

  it('starts on the light canvas', () => {
    expect(manifest.background_color).toBe(THEME_COLORS.light)
    expect(manifest.theme_color).toBe(THEME_COLORS.light)
  })

  it('offers Scan bill and Split amount shortcuts to real app pages', () => {
    expect(manifest.shortcuts.map((s) => [s.short_name, s.url])).toEqual([
      ['Scan bill', '/app/bill'],
      ['Split amount', '/app/split/new'],
    ])
    for (const shortcut of manifest.shortcuts) expect(matchAppRoute(shortcut.url)).not.toBeNull()
  })

  it('ships any-purpose and maskable icons', () => {
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
    expect(manifest.icons.some((i) => i.src === '/icon-512.png' && i.purpose === 'any')).toBe(true)
  })
})
