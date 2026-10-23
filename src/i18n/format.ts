/**
 * A small subset of ICU MessageFormat, enough for Settle's copy:
 *
 *   text {name}                                   → the value (numbers in Indian format, Latin digits)
 *   {count, plural, =0 {…} one {# item} other {# items}}   → `=N` first, then the language's plural rule; `#` = the count
 *   {who, select, me {You} other {{name}}}        → the exact key, else `other`
 *   {n, number}                                   → the number, Indian format
 *   <b>…</b>                                      → rich tags (for `tx`; plain text for `t`)
 *
 * No apostrophe escaping (UI copy never needs literal braces). Parsed messages are cached. A
 * missing value leaves `{name}` in place (and says so once in development).
 */
import type { Vars } from './types'

export type Node =
  | string
  | { k: 'arg'; name: string }
  | { k: 'number'; name: string }
  | { k: 'pound' }
  | { k: 'plural'; name: string; cases: Readonly<Record<string, Node[]>> }
  | { k: 'select'; name: string; cases: Readonly<Record<string, Node[]>> }
  | { k: 'tag'; name: string; children: Node[] }

class Parser {
  private i = 0
  constructor(private readonly src: string) {}

  /** Nodes up to `}` (when `inCases`), a closing tag, or the end. */
  parse(inPlural: boolean, closeTag: string | null): Node[] {
    const out: Node[] = []
    let text = ''
    const flush = () => {
      if (text) out.push(text)
      text = ''
    }
    while (this.i < this.src.length) {
      const ch = this.src[this.i] as string
      if (ch === '}') break
      if (ch === '{') {
        flush()
        out.push(this.argument(inPlural))
        continue
      }
      if (ch === '#' && inPlural) {
        flush()
        out.push({ k: 'pound' })
        this.i++
        continue
      }
      if (ch === '<') {
        if (closeTag !== null && this.src.startsWith(`</${closeTag}>`, this.i)) break
        const open = /^<([a-zA-Z][\w-]*)>/.exec(this.src.slice(this.i))
        if (open) {
          const name = open[1] as string
          const save = this.i
          this.i += open[0].length
          const children = this.parse(inPlural, name)
          if (this.src.startsWith(`</${name}>`, this.i)) {
            flush()
            this.i += name.length + 3
            out.push({ k: 'tag', name, children })
            continue
          }
          // No closing tag: it's just text.
          this.i = save
        }
      }
      text += ch
      this.i++
    }
    flush()
    return out
  }

  /** At a closing brace that closes nothing (top level): steps over it. */
  atStrayBrace(): boolean {
    if (this.src[this.i] !== '}') return false
    this.i++
    return true
  }

  private skipSpace(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i] as string)) this.i++
  }

  private word(): string {
    this.skipSpace()
    const m = /^[^\s,{}]+/.exec(this.src.slice(this.i))
    const w = m ? m[0] : ''
    this.i += w.length
    this.skipSpace()
    return w
  }

  /** After `{`: `{name}`, `{name, number}`, `{name, plural, …}` or `{name, select, …}`. */
  private argument(inPlural: boolean): Node {
    const start = this.i
    this.i++ // {
    const name = this.word()
    if (this.src[this.i] === '}') {
      this.i++
      return { k: 'arg', name }
    }
    if (this.src[this.i] !== ',') return this.fail(start)
    this.i++
    const type = this.word()
    if (type === 'number' && this.src[this.i] === '}') {
      this.i++
      return { k: 'number', name }
    }
    if ((type !== 'plural' && type !== 'select') || this.src[this.i] !== ',') return this.fail(start)
    this.i++
    const cases: Record<string, Node[]> = {}
    for (;;) {
      this.skipSpace()
      if (this.src[this.i] === '}') {
        this.i++
        break
      }
      const key = this.word()
      if (!key || this.src[this.i] !== '{') return this.fail(start)
      this.i++ // {
      cases[key] = this.parse(type === 'plural' || inPlural, null)
      if (this.src[this.i] !== '}') return this.fail(start)
      this.i++ // }
    }
    return type === 'plural' ? { k: 'plural', name, cases } : { k: 'select', name, cases }
  }

  /** Malformed: keep the rest of the argument as text. */
  private fail(start: number): Node {
    let depth = 0
    let j = start
    for (; j < this.src.length; j++) {
      const ch = this.src[j]
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) break
    }
    this.i = Math.min(this.src.length, j + 1)
    return this.src.slice(start, this.i)
  }
}

const astCache = new Map<string, Node[]>()

/** The parsed form of `message` (cached). */
export function parseMessage(message: string): Node[] {
  let ast = astCache.get(message)
  if (!ast) {
    const parser = new Parser(message)
    ast = []
    // A stray `}` at the top level is text.
    for (;;) {
      ast.push(...parser.parse(false, null))
      if (!parser.atStrayBrace()) break
      ast.push('}')
    }
    astCache.set(message, ast)
  }
  return ast
}

const counter = new Intl.NumberFormat('en-IN', { numberingSystem: 'latn', maximumFractionDigits: 2 })

/** A count in messages: Indian grouping, Latin digits ("1,23,456"). */
export function formatCount(n: number): string {
  return counter.format(n)
}

const pluralRules = new Map<string, Intl.PluralRules>()

function pluralCategory(n: number, locale: string): string {
  let rules = pluralRules.get(locale)
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale)
    } catch {
      rules = new Intl.PluralRules('en')
    }
    pluralRules.set(locale, rules)
  }
  return rules.select(n)
}

const warned = new Set<string>()

/** Development-only warnings, once each (never in tests or production). */
export function devWarn(message: string): void {
  const env = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env
  if (!env?.DEV || env.MODE === 'test' || warned.has(message)) return
  warned.add(message)
  console.warn(`[i18n] ${message}`)
}

function pickCase(cases: Readonly<Record<string, Node[]>>, key: string): Node[] {
  return cases[key] ?? cases.other ?? []
}

/** Walks the message, handing text and tags to `emit`. */
function walk<R>(nodes: readonly Node[], vars: Vars, locale: string, count: number | null, out: R[], tag: (name: string, children: R[]) => R, text: (s: string) => R): void {
  for (const node of nodes) {
    if (typeof node === 'string') {
      out.push(text(node))
      continue
    }
    switch (node.k) {
      case 'arg': {
        const value = vars[node.name]
        if (value === undefined) {
          devWarn(`missing value for {${node.name}}`)
          out.push(text(`{${node.name}}`))
        } else out.push(text(typeof value === 'number' ? formatCount(value) : value))
        break
      }
      case 'number': {
        const value = vars[node.name]
        out.push(text(typeof value === 'number' ? formatCount(value) : value === undefined ? `{${node.name}}` : String(value)))
        break
      }
      case 'pound':
        out.push(text(count === null ? '#' : formatCount(count)))
        break
      case 'plural': {
        const raw = vars[node.name]
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(n)) {
          devWarn(`plural {${node.name}} needs a number`)
          walk(pickCase(node.cases, 'other'), vars, locale, null, out, tag, text)
          break
        }
        const exact = node.cases[`=${n}`]
        walk(exact ?? pickCase(node.cases, pluralCategory(n, locale)), vars, locale, n, out, tag, text)
        break
      }
      case 'select': {
        const raw = vars[node.name]
        walk(pickCase(node.cases, raw === undefined ? 'other' : String(raw)), vars, locale, count, out, tag, text)
        break
      }
      case 'tag': {
        const children: R[] = []
        walk(node.children, vars, locale, count, children, tag, text)
        out.push(tag(node.name, children))
        break
      }
    }
  }
}

/** `message` with `vars` filled in, as plain text (tags keep only their text). `locale` drives plural rules. */
export function formatMessage(message: string, vars: Vars = {}, locale = 'en-IN'): string {
  const out: string[] = []
  walk(parseMessage(message), vars, locale, null, out, (_name, children) => children.join(''), (s) => s)
  return out.join('')
}

/**
 * `message` with `vars` filled in and its tags rendered by `tags` (an unknown tag renders its
 * text). Returns the pieces in order, for React to render as children.
 */
export function formatRich<R>(message: string, vars: Vars, locale: string, tags: Readonly<Record<string, (chunk: Array<R | string>) => R>>): Array<R | string> {
  const out: Array<R | string> = []
  walk<R | string>(
    parseMessage(message),
    vars,
    locale,
    null,
    out,
    (name, children) => {
      const render = tags[name]
      return render ? render(children) : children.map(String).join('')
    },
    (s) => s,
  )
  // Join neighbouring strings so React gets as few text nodes as possible.
  const merged: Array<R | string> = []
  for (const piece of out) {
    const last = merged[merged.length - 1]
    if (typeof piece === 'string' && typeof last === 'string') merged[merged.length - 1] = last + piece
    else merged.push(piece)
  }
  return merged
}
