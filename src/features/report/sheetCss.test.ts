/**
 * The A4 sheet's layout can't be measured in jsdom, so its stylesheet is checked as text: the table
 * never breaks a word mid-word, the phone preview scrolls inside its own box at a paper-like width,
 * and the printed sheet drops that width and keeps clear of the page edge.
 */
import { describe, expect, it } from 'vitest'

// Read from disk: Vitest stubs CSS imports (even `?raw`). The client tsconfig has no Node types.
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
const CSS_PATH = './Report.module.css'
const css = fs.readFileSync(fileURLToPath(new URL(CSS_PATH, import.meta.url).href), 'utf8').split(String.fromCharCode(13)).join('')

/** The body of the first rule whose selector list is exactly `selector` (outside or inside @media print). */
function rule(source: string, selector: string): string {
  const at = source.indexOf(`${selector} {`)
  if (at < 0) return ''
  return source.slice(at, source.indexOf('}', at))
}

const print = css.slice(css.indexOf('@media print'))
const screen = css.slice(0, css.indexOf('@media print'))

describe('the claim sheet’s stylesheet', () => {
  it('table cells break inside a word only when the word can’t fit, and headers never wrap', () => {
    const cells = rule(screen, '.sheetTable th,\n.sheetTable td')
    expect(cells).toContain('overflow-wrap: break-word')
    expect(cells).not.toContain('anywhere')
    expect(rule(screen, '.sheetTable thead th')).toContain('white-space: nowrap')
  })

  it('on screen the sheet keeps a paper-like width and scrolls sideways inside its own box', () => {
    expect(rule(screen, '.sheet')).toContain('min-width: 600px')
    const area = rule(screen, '.printArea')
    expect(area).toContain('overflow-x: auto')
    expect(area).toContain('min-width: 0')
  })

  it('printed, the sheet fits the page width with a hair of padding so nothing is clipped', () => {
    const sheet = rule(print, '  .sheet')
    expect(sheet).toContain('min-width: 0')
    expect(sheet).toContain('width: 100%')
    expect(sheet).toMatch(/padding: 0 1mm/)
  })
})
