/**
 * Every language × every key: a translation must say the same thing to the code as the English —
 * same placeholders, same tags, well-formed plural/select — and live in the namespace its key
 * names. Missing translations are allowed (they fall back to English) but listed, per language.
 *
 * Languages are found the way the runtime finds them (`src/i18n/<lang>/index.ts`), so a new
 * language is checked the moment its folder exists.
 */
import { describe, expect, it } from 'vitest'
import type { LanguageCode } from '../domain/types'
import { EN } from './en'
import { parseMessage, type Node } from './format'
import { isLanguageCode } from './languages'
import type { Messages } from './types'

const languages = import.meta.glob<{ default: Messages }>('./{hi,bn,mr,ta,te,kn,gu}/index.ts', { eager: true })
const namespaceFiles = import.meta.glob<Record<string, Messages>>(
  ['./{en,hi,bn,mr,ta,te,kn,gu}/*.ts', '!./*/index.ts', '!./en/eager.ts', '!./**/*.test.ts'],
  { eager: true },
)

const english: Messages = EN

/** What the code hands a message: argument names (incl. plural/select) and tag names. */
function signature(message: string): { args: string[]; tags: string[]; problems: string[] } {
  const args = new Set<string>()
  const tags = new Set<string>()
  const problems: string[] = []
  const visit = (nodes: readonly Node[]): void => {
    for (const node of nodes) {
      if (typeof node === 'string') {
        if (/[{}]/.test(node)) problems.push(`stray brace in "${node}"`)
        continue
      }
      switch (node.k) {
        case 'arg':
        case 'number':
          args.add(node.name)
          break
        case 'pound':
          break
        case 'plural':
        case 'select':
          args.add(node.name)
          if (!('other' in node.cases)) problems.push(`{${node.name}, ${node.k}} has no "other" case`)
          for (const branch of Object.values(node.cases)) visit(branch)
          break
        case 'tag':
          tags.add(node.name)
          visit(node.children)
          break
      }
    }
  }
  visit(parseMessage(message))
  return { args: [...args].sort(), tags: [...tags].sort(), problems }
}

const codeOf = (path: string): string => path.split('/')[1] ?? ''

describe('the English catalog', () => {
  it('is well formed: plural/select with an "other" case, no stray braces', () => {
    const broken = Object.entries(english).flatMap(([key, message]) => signature(message).problems.map((p) => `${key}: ${p}`))
    expect(broken).toEqual([])
  })
})

describe('every namespace file', () => {
  it("holds only its own namespace's keys (`<ns>.…` in `<lang>/<ns>.ts`) — the build splits English by it", () => {
    const misplaced: string[] = []
    for (const [path, mod] of Object.entries(namespaceFiles)) {
      const ns = (path.split('/')[2] ?? '').replace(/\.ts$/, '')
      for (const messages of Object.values(mod)) {
        if (typeof messages !== 'object' || messages === null) continue
        for (const key of Object.keys(messages)) if (!key.startsWith(`${ns}.`)) misplaced.push(`${path}: ${key}`)
      }
    }
    expect(misplaced).toEqual([])
  })
})

describe.each(Object.entries(languages).map(([path, mod]) => [codeOf(path), mod.default] as const))('%s', (code, catalog) => {
  it('is one of the eight languages', () => {
    expect(isLanguageCode(code)).toBe(true)
    expect(code).not.toBe('en' satisfies LanguageCode)
  })

  it('translates only keys English has', () => {
    expect(Object.keys(catalog).filter((key) => !Object.hasOwn(english, key))).toEqual([])
  })

  it('keeps every placeholder and tag of the English, and is well formed', () => {
    const wrong: string[] = []
    for (const [key, message] of Object.entries(catalog)) {
      const source = english[key]
      if (source === undefined) continue
      if (message.trim() === '' && source.trim() !== '') {
        wrong.push(`${key}: empty (leave the key out to fall back to English)`)
        continue
      }
      const want = signature(source)
      const got = signature(message)
      if (want.args.join() !== got.args.join()) wrong.push(`${key}: placeholders {${got.args.join('}, {')}} ≠ English {${want.args.join('}, {')}}`)
      if (want.tags.join() !== got.tags.join()) wrong.push(`${key}: tags <${got.tags.join('>, <')}> ≠ English <${want.tags.join('>, <')}>`)
      for (const problem of got.problems) wrong.push(`${key}: ${problem}`)
    }
    expect(wrong).toEqual([])
  })

  it('lists what still falls back to English', () => {
    const missing = Object.keys(english).filter((key) => !Object.hasOwn(catalog, key))
    const total = Object.keys(english).length
    if (missing.length > 0) {
      const byNamespace = new Map<string, number>()
      for (const key of missing) {
        const ns = key.split('.')[0] ?? key
        byNamespace.set(ns, (byNamespace.get(ns) ?? 0) + 1)
      }
      const summary = [...byNamespace].map(([ns, n]) => `${ns} ${n}`).join(', ')
      console.info(`[i18n] ${code}: ${total - missing.length}/${total} translated; missing — ${summary}`)
    }
    expect(missing.length).toBeLessThanOrEqual(total)
  })
})
