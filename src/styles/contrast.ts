/**
 * WCAG 2.2 contrast maths plus a tiny reader for `tokens.css`, so the palette's contrast is
 * computed (and enforced by `tokens.test.ts`) instead of eyeballed.
 *
 * Supports the colour syntax the tokens use: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (comma
 * or space syntax, optional `/ alpha`), `color-mix(in srgb, A p%, B q%)` and `var(--x, fallback)`.
 */

export interface Rgba {
  /** 0..255 */
  r: number
  g: number
  b: number
  /** 0..1 */
  a: number
}

/* ------------------------------------------------------------------ colour parsing */

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, n))
}

function parseHex(value: string): Rgba | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value)
  if (!m?.[1]) return null
  let h = m[1]
  if (h.length <= 4) h = Array.from(h, (c) => c + c).join('')
  const byte = (i: number): number => Number.parseInt(h.slice(i, i + 2), 16)
  return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) / 255 : 1 }
}

function parseChannel(text: string): number | null {
  const t = text.trim()
  if (t.endsWith('%')) {
    const n = Number.parseFloat(t)
    return Number.isFinite(n) ? clampByte((n / 100) * 255) : null
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? clampByte(n) : null
}

function parseAlpha(text: string | undefined): number | null {
  if (text === undefined) return 1
  const t = text.trim()
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return null
  return Math.min(1, Math.max(0, t.endsWith('%') ? n / 100 : n))
}

function parseRgbFunction(value: string): Rgba | null {
  const m = /^rgba?\((.*)\)$/i.exec(value)
  if (!m?.[1]) return null
  const body = m[1].trim()
  let channels: string[]
  let alpha: string | undefined
  if (body.includes(',')) {
    const parts = body.split(',')
    channels = parts.slice(0, 3)
    alpha = parts[3]
  } else {
    const [rgb, a] = body.split('/')
    channels = (rgb ?? '').trim().split(/\s+/)
    alpha = a
  }
  if (channels.length !== 3) return null
  const [r, g, b] = channels.map(parseChannel)
  const a = parseAlpha(alpha)
  if (r == null || g == null || b == null || a == null) return null
  return { r, g, b, a }
}

/** Splits on top-level commas (not the ones inside nested parentheses). */
export function splitTopLevel(text: string, separator = ','): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim())
}

function parseColorMix(value: string): Rgba | null {
  const m = /^color-mix\((.*)\)$/i.exec(value)
  if (!m?.[1]) return null
  const [space, first, second] = splitTopLevel(m[1])
  if (space?.replace(/\s+/g, ' ').toLowerCase() !== 'in srgb' || first === undefined || second === undefined) return null
  const stop = (text: string): { color: Rgba | null; pct: number | null } => {
    const pm = /\s([\d.]+)%$/.exec(text)
    const pct = pm?.[1] ? Number.parseFloat(pm[1]) : null
    const colorText = pm ? text.slice(0, pm.index).trim() : text
    return { color: parseColor(colorText), pct }
  }
  const a = stop(first)
  const b = stop(second)
  const ca = a.color
  const cb = b.color
  if (!ca || !cb) return null
  let pa = a.pct
  let pb = b.pct
  if (pa === null && pb === null) {
    pa = 50
    pb = 50
  } else if (pa === null) pa = 100 - (pb ?? 0)
  else if (pb === null) pb = 100 - pa
  const total = (pa ?? 0) + (pb ?? 0)
  if (total <= 0) return null
  const wa = (pa ?? 0) / total
  const wb = (pb ?? 0) / total
  // CSS Color 5: premultiplied interpolation in the gamma-encoded sRGB space.
  const alpha = ca.a * wa + cb.a * wb
  const mix = (x: number, y: number): number => (alpha === 0 ? 0 : (x * ca.a * wa + y * cb.a * wb) / alpha)
  const result: Rgba = { r: mix(ca.r, cb.r), g: mix(ca.g, cb.g), b: mix(ca.b, cb.b), a: alpha }
  // Percentages summing below 100% scale the alpha down.
  if (total < 100) result.a *= total / 100
  return result
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

const NAMED: Readonly<Record<string, Rgba>> = {
  white: WHITE,
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
}

/** Parses a resolved CSS colour (no `var()`); null when unsupported. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim()
  const named = NAMED[v.toLowerCase()]
  if (named) return { ...named }
  return parseHex(v) ?? parseRgbFunction(v) ?? parseColorMix(v)
}

/* ------------------------------------------------------------------ WCAG maths */

function channelToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(c: Rgba): number {
  return 0.2126 * channelToLinear(c.r) + 0.7152 * channelToLinear(c.g) + 0.0722 * channelToLinear(c.b)
}

/** `top` painted over an opaque `bottom` (source-over). */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  }
}

/** Contrast ratio (1..21). Translucent colours are composited onto `backdrop` (default white) first. */
export function contrastRatio(fg: Rgba, bg: Rgba, backdrop: Rgba = WHITE): number {
  const solidBg = bg.a < 1 ? composite(bg, backdrop) : bg
  const solidFg = fg.a < 1 ? composite(fg, solidBg) : fg
  const l1 = relativeLuminance(solidFg)
  const l2 = relativeLuminance(solidBg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function toHex(c: Rgba): string {
  const byte = (n: number): string => Math.round(clampByte(n)).toString(16).padStart(2, '0')
  return `#${byte(c.r)}${byte(c.g)}${byte(c.b)}${c.a < 1 ? byte(c.a * 255) : ''}`.toUpperCase()
}

/* ------------------------------------------------------------------ tokens.css reader */

export interface CssBlock {
  /** Normalised selector (whitespace removed, double quotes → single). */
  selector: string
  /** Normalised at-rule prelude it sits in (e.g. "@media(prefers-color-scheme:dark)"), or null. */
  media: string | null
  /** Custom properties declared in the block, in source order. */
  decls: Record<string, string>
}

function normalise(text: string): string {
  return text.replace(/\s+/g, '').replace(/"/g, "'")
}

/** Reads every rule block (one level of at-rule nesting) and its custom-property declarations. */
export function readCssBlocks(css: string): CssBlock[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: CssBlock[] = []
  const walk = (source: string, media: string | null): void => {
    let i = 0
    while (i < source.length) {
      const open = source.indexOf('{', i)
      if (open === -1) return
      const prelude = source.slice(i, open).trim()
      let depth = 1
      let j = open + 1
      while (j < source.length && depth > 0) {
        if (source[j] === '{') depth++
        else if (source[j] === '}') depth--
        j++
      }
      const body = source.slice(open + 1, j - 1)
      if (prelude.startsWith('@')) {
        walk(body, normalise(prelude))
      } else {
        const decls: Record<string, string> = {}
        for (const part of splitTopLevel(body, ';')) {
          const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(part)
          if (m?.[1] && m[2] !== undefined) decls[m[1]] = m[2].trim().replace(/\s+/g, ' ')
        }
        blocks.push({ selector: normalise(prelude), media, decls })
      }
      i = j
    }
  }
  walk(text, null)
  return blocks
}

/** Resolves `var(--x)` / `var(--x, fallback)` references (recursively) against `decls`. */
export function resolveValue(value: string, decls: Readonly<Record<string, string>>, seen: ReadonlySet<string> = new Set()): string {
  let out = ''
  let i = 0
  while (i < value.length) {
    const at = value.indexOf('var(', i)
    if (at === -1) {
      out += value.slice(i)
      break
    }
    out += value.slice(i, at)
    let depth = 1
    let j = at + 4
    while (j < value.length && depth > 0) {
      if (value[j] === '(') depth++
      else if (value[j] === ')') depth--
      j++
    }
    const inner = value.slice(at + 4, j - 1)
    const [name = '', ...rest] = splitTopLevel(inner)
    const fallback = rest.length > 0 ? rest.join(',') : undefined
    const own = decls[name]
    if (own !== undefined && !seen.has(name)) {
      out += resolveValue(own, decls, new Set([...seen, name]))
    } else if (fallback !== undefined) {
      out += resolveValue(fallback, decls, seen)
    } else {
      throw new Error(`Unresolved custom property ${name}`)
    }
    i = j
  }
  return out
}

/** The parsed colour of token `name` after resolving references; throws if it isn't a colour. */
export function tokenColor(name: string, decls: Readonly<Record<string, string>>): Rgba {
  const raw = decls[name]
  if (raw === undefined) throw new Error(`Missing token ${name}`)
  const color = parseColor(resolveValue(raw, decls))
  if (!color) throw new Error(`Token ${name} is not a colour: ${raw}`)
  return color
}
