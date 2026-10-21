/**
 * Fitting text into a fixed-size image: truncation with "…", word wrapping and shrink-to-fit.
 * Pure — the caller supplies `measure` (a canvas in the app, a fake in tests).
 */
import { graphemes } from '../../lib/people'

export const FONT_FAMILY = '"Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export interface TextStyle {
  /** Pixels. */
  size: number
  weight: 400 | 500 | 600 | 700
  /** Letter spacing in pixels (negative tightens). */
  tracking?: number
}

/** Width of `text` in pixels when drawn in `style`. */
export type Measure = (text: string, style: TextStyle) => number

/** CSS font shorthand for a style. */
export function fontOf(style: TextStyle): string {
  return `${style.weight} ${style.size}px ${FONT_FAMILY}`
}

const ELLIPSIS = '…'

/**
 * `text` if it fits in `maxWidth`, otherwise the longest prefix (whole characters, trailing space
 * trimmed) + "…" that does. Empty when not even "…" fits.
 */
export function fitText(text: string, maxWidth: number, style: TextStyle, measure: Measure): string {
  if (measure(text, style) <= maxWidth) return text
  const chars = graphemes(text)
  let lo = 0
  let hi = chars.length - 1
  let best = ''
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const candidate = `${chars.slice(0, mid).join('').trimEnd()}${ELLIPSIS}`
    if (measure(candidate, style) <= maxWidth) {
      best = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

/**
 * Like `fitText`, but backs up to the last word break when the cut lands mid-word and the break
 * keeps most of the line ("Toit with…" rather than "Toit with t…").
 */
export function fitWords(text: string, maxWidth: number, style: TextStyle, measure: Measure): string {
  const fitted = fitText(text, maxWidth, style, measure)
  if (!fitted.endsWith(ELLIPSIS) || fitted === text) return fitted
  const body = fitted.slice(0, -ELLIPSIS.length)
  const next = text.charAt(body.length)
  if (next === '' || /\s/.test(next)) return fitted
  const space = body.lastIndexOf(' ')
  return space > body.length * 0.6 ? `${body.slice(0, space).trimEnd()}${ELLIPSIS}` : fitted
}

/** Splits a word that is wider than a line into line-sized pieces. */
function breakWord(word: string, maxWidth: number, style: TextStyle, measure: Measure): string[] {
  const pieces: string[] = []
  let current = ''
  for (const ch of graphemes(word)) {
    if (current && measure(current + ch, style) > maxWidth) {
      pieces.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  if (current) pieces.push(current)
  return pieces
}

/**
 * Greedy word wrap into at most `maxLines` lines. Words wider than a line are broken; when the
 * text doesn't fit, the last line carries as much as fits and ends with "…". Whitespace is
 * collapsed. Empty text → [].
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, style: TextStyle, measure: Measure): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0 || maxLines < 1) return []
  const lines: string[] = []
  const fits = (value: string) => measure(value, style) <= maxWidth
  /** Fills the final line with everything left, cut with "…" (at a word break when one is close). */
  const finish = (rest: string) => [...lines, fitWords(rest, maxWidth, style, measure)]

  let current = ''
  for (let w = 0; w < words.length; w++) {
    const word = words[w] ?? ''
    const candidate = current ? `${current} ${word}` : word
    if (fits(candidate)) {
      current = candidate
      continue
    }
    if (current) {
      if (lines.length === maxLines - 1) return finish([current, ...words.slice(w)].join(' '))
      lines.push(current)
    }
    if (fits(word)) {
      current = word
      continue
    }
    const pieces = breakWord(word, maxWidth, style, measure)
    for (let k = 0; k < pieces.length - 1; k++) {
      if (lines.length === maxLines - 1) return finish([pieces.slice(k).join(''), ...words.slice(w + 1)].join(' '))
      lines.push(pieces[k] ?? '')
    }
    current = pieces[pieces.length - 1] ?? ''
  }
  if (current) lines.push(current)
  return lines
}

/**
 * The largest size from `max` down to `min` (in `step`s) at which `text` fits `maxWidth` on one
 * line; `min` if even that doesn't fit (then pair it with `fitText`).
 */
export function fitFontSize(
  text: string,
  maxWidth: number,
  range: { max: number; min: number; step?: number },
  styleAt: (size: number) => TextStyle,
  measure: Measure,
): number {
  const step = Math.max(1, range.step ?? 2)
  for (let size = range.max; size > range.min; size -= step) {
    if (measure(text, styleAt(size)) <= maxWidth) return size
  }
  return range.min
}
