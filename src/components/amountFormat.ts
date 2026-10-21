/**
 * Live digit grouping for amount fields, like payments apps: the person types "2299.5" and sees
 * "2,299.5" (or "2.299,5", "2,29,950" — whatever their locale writes). The field's value stays
 * the raw text ("2299.5"); only what is shown changes, and edits on the shown text are mapped back.
 */

interface Symbols {
  /** Formats a whole number (as a BigInt) with the locale's grouping, ASCII digits. */
  format: Intl.NumberFormat
  /** The locale's decimal separator. */
  decimal: string
}

const symbolsCache = new Map<string, Symbols | null>()

function symbolsFor(locale: string | undefined): Symbols | null {
  const key = locale ?? ''
  const hit = symbolsCache.get(key)
  if (hit !== undefined) return hit
  const symbols = createSymbols(locale)
  symbolsCache.set(key, symbols)
  return symbols
}

function createSymbols(locale: string | undefined): Symbols | null {
  try {
    const format = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0, numberingSystem: 'latn' })
    const decimal =
      new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.'
    return { format, decimal }
  } catch {
    return null
  }
}

/** What an amount field shows for a raw value. */
export interface AmountLayout {
  text: string
  /** Per character of `text` (UTF-16 index): true for separators added for display (never typed). */
  added: boolean[]
}

function plain(raw: string): AmountLayout {
  return { text: raw, added: new Array<boolean>(raw.length).fill(false) }
}

/**
 * The shown text for `raw`: whole digits grouped and the separator shown as the locale's decimal
 * point. Anything that isn't a simple "digits[separator digits]" amount is shown as typed.
 */
export function layoutAmount(raw: string, locale?: string): AmountLayout {
  const match = /^(\d*)(?:([.,])(\d*))?$/.exec(raw)
  if (!match) return plain(raw)
  const whole = match[1] ?? ''
  const separator = match[2]
  const fraction = match[3] ?? ''
  // "007" would lose its zeros; leave unusual input alone.
  if (whole.length > 1 && whole.startsWith('0')) return plain(raw)
  const symbols = symbolsFor(locale)
  if (!symbols) return plain(raw)

  let text = ''
  const added: boolean[] = []
  if (whole !== '') {
    let digits = ''
    for (const part of symbols.format.formatToParts(BigInt(whole))) {
      if (part.type === 'integer') digits += part.value
      else if (part.type !== 'group') return plain(raw)
      text += part.value
      for (let i = 0; i < part.value.length; i++) added.push(part.type === 'group')
    }
    if (digits !== whole) return plain(raw)
  }
  if (separator !== undefined) {
    text += symbols.decimal + fraction
    for (let i = 0; i < symbols.decimal.length + fraction.length; i++) added.push(false)
    // A multi-character decimal sign would break the 1:1 mapping with the raw text.
    if (symbols.decimal.length !== 1) return plain(raw)
  }
  return { text, added }
}

/** Characters that can be part of an amount (what the field keeps). */
function isAmountChar(ch: string): boolean {
  return /[\p{Nd}.,٫٬]/u.test(ch)
}

function countAmountChars(text: string): number {
  let n = 0
  for (const ch of text) if (isAmountChar(ch)) n++
  return n
}

export interface AmountEdit {
  /** The raw text after the edit (not yet cleaned). */
  raw: string
  /** Where the caret belongs: after this many amount characters. */
  caret: number
  /** The text the edit put in (what was typed or pasted), as given. */
  inserted: string
}

/**
 * Maps an edit made on the shown text back onto the raw value. `next` is the input's new text,
 * `caret` its caret position (selectionEnd) and `inputType` the InputEvent's type, when known.
 * Deleting a grouping separator deletes the digit next to it, like payments apps do.
 */
export function applyAmountEdit(
  raw: string,
  next: string,
  caret: number | null,
  inputType: string | undefined,
  locale?: string,
): AmountEdit {
  const { text: prev, added } = layoutAmount(raw, locale)
  const rawIndex = (displayIndex: number): number => {
    let n = 0
    for (let i = 0; i < displayIndex; i++) if (!added[i]) n++
    return n
  }

  // Everything after the caret is unchanged text (when the browser tells us where it is).
  let suffix = -1
  if (caret !== null && caret >= 0 && caret <= next.length) {
    const tail = next.slice(caret)
    if (tail.length <= prev.length && prev.endsWith(tail)) suffix = tail.length
  }
  if (suffix < 0) {
    suffix = 0
    const max = Math.min(prev.length, next.length)
    while (suffix < max && prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++
  }
  let prefix = 0
  const maxPrefix = Math.min(prev.length - suffix, next.length - suffix)
  while (prefix < maxPrefix && prev[prefix] === next[prefix]) prefix++

  let start = rawIndex(prefix)
  let end = rawIndex(prev.length - suffix)
  const inserted = next.slice(prefix, next.length - suffix)
  const removedSomething = prefix < prev.length - suffix
  if (inserted === '' && removedSomething && start === end) {
    // Only a grouping separator went: take the digit beside it instead.
    if (inputType === 'deleteContentForward') end = Math.min(raw.length, end + 1)
    else start = Math.max(0, start - 1)
  }
  const before = raw.slice(0, start) + inserted
  return { raw: before + raw.slice(end), caret: countAmountChars(before), inserted }
}

/** The index in the shown text that sits after `count` amount characters. */
export function caretIndex(layout: AmountLayout, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < layout.text.length; i++) {
    if (!layout.added[i]) seen++
    if (seen >= count) return i + 1
  }
  return layout.text.length
}
