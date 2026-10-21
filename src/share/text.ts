/** Text clean-up shared by pay links, nudges and share cards. */
import { graphemes } from '../lib/people'

/** Zero-width joiner: glues emoji sequences (👩‍💻), so it survives the clean-up. */
const ZWJ = '‍'

/**
 * Display-safe single-line text: NFC, whitespace collapsed, control/format characters (incl.
 * bidi overrides that could disguise an amount) and lone surrogates removed, then capped at
 * `maxGraphemes` user-perceived characters and `maxUnits` UTF-16 code units, never splitting a
 * character. Idempotent: `cleanText(cleanText(x)) === cleanText(x)`.
 */
export function cleanText(value: string, maxGraphemes: number, maxUnits: number = maxGraphemes * 4): string {
  const cleaned = value
    .normalize('NFC')
    .replace(/[\p{Cf}\p{Cs}]/gu, (c) => (c === ZWJ ? c : ''))
    .replace(/[\s\p{Cc}]+/gu, ' ')
    .trim()
  if (cleaned.length <= maxGraphemes && cleaned.length <= maxUnits) return cleaned
  let out = ''
  let count = 0
  for (const g of graphemes(cleaned)) {
    if (count >= maxGraphemes || out.length + g.length > maxUnits) break
    out += g
    count++
  }
  return out.trim()
}

/** Like `cleanText`, but ends with "…" when something had to be cut (the "…" counts towards the caps). */
export function ellipsize(value: string, maxGraphemes: number, maxUnits: number = Number.MAX_SAFE_INTEGER): string {
  const cleaned = cleanText(value, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  if (cleaned.length <= maxUnits && graphemes(cleaned).length <= maxGraphemes) return cleaned
  const cut = cleanText(cleaned, Math.max(1, maxGraphemes - 1), Math.max(1, maxUnits - 1)).trimEnd()
  return `${cut}…`
}

/** First word of a name ("Riya Sharma" → "Riya"); the whole name if it has one word. */
export function firstName(name: string): string {
  const trimmed = name.trim()
  const space = trimmed.search(/\s/)
  return space === -1 ? trimmed : trimmed.slice(0, space)
}

/** 32-bit FNV-1a hash of a string — stable across runs and engines, for deterministic picks. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** UTF-8 byte length of a string. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length
}
