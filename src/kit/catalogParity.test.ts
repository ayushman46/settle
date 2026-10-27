/**
 * The shared-UI namespaces (ui, kit, app, share, api) are complete in Hindi: every English key has
 * a Hindi message (no fallback to English on these screens), no stray keys, and each Hindi message
 * hands the code the same placeholders and tags. The repo-wide `src/i18n/parity.test.ts` only
 * lists missing keys; this one fails on them, for the namespaces x-shared owns.
 */
import { describe, expect, it } from 'vitest'
import { parseMessage, type Node } from '../i18n/format'
import type { Messages } from '../i18n/types'
import { api as enApi } from '../i18n/en/api'
import { app as enApp } from '../i18n/en/app'
import { kit as enKit } from '../i18n/en/kit'
import { share as enShare } from '../i18n/en/share'
import { ui as enUi } from '../i18n/en/ui'
import { api as hiApi } from '../i18n/hi/api'
import { app as hiApp } from '../i18n/hi/app'
import { kit as hiKit } from '../i18n/hi/kit'
import { share as hiShare } from '../i18n/hi/share'
import { ui as hiUi } from '../i18n/hi/ui'

const NAMESPACES: ReadonlyArray<[name: string, en: Messages, hi: Messages]> = [
  ['ui', enUi, hiUi],
  ['kit', enKit, hiKit],
  ['app', enApp, hiApp],
  ['share', enShare, hiShare],
  ['api', enApi, hiApi],
]

/** Argument names (plain, number, plural, select) and tag names a message uses, sorted. */
function signature(message: string): string {
  const args = new Set<string>()
  const tags = new Set<string>()
  const visit = (nodes: readonly Node[]): void => {
    for (const node of nodes) {
      if (typeof node === 'string') continue
      if (node.k === 'arg' || node.k === 'number') args.add(node.name)
      else if (node.k === 'plural' || node.k === 'select') {
        args.add(node.name)
        for (const branch of Object.values(node.cases)) visit(branch)
      } else if (node.k === 'tag') {
        tags.add(node.name)
        visit(node.children)
      }
    }
  }
  visit(parseMessage(message))
  return `${[...args].sort().join(',')}|${[...tags].sort().join(',')}`
}

describe.each(NAMESPACES)('the %s namespace', (name, en, hi) => {
  it('has a Hindi message for every English key, and no others', () => {
    const missing = Object.keys(en).filter((key) => !Object.hasOwn(hi, key))
    const extra = Object.keys(hi).filter((key) => !Object.hasOwn(en, key))
    expect(missing).toEqual([])
    expect(extra).toEqual([])
  })

  it('keeps every key in its own namespace', () => {
    expect([...Object.keys(en), ...Object.keys(hi)].filter((key) => !key.startsWith(`${name}.`))).toEqual([])
  })

  it('gives the code the same placeholders and tags in Hindi', () => {
    const different = Object.entries(en)
      .filter(([key, message]) => Object.hasOwn(hi, key) && signature(message) !== signature(hi[key] as string))
      .map(([key]) => key)
    expect(different).toEqual([])
  })

  it('has no empty or untranslated-looking Hindi messages', () => {
    const empty = Object.entries(hi).filter(([, message]) => message.trim() === '').map(([key]) => key)
    expect(empty).toEqual([])
    // Mostly Latin text where English isn't (allowed: brand, UPI, QR, app names, placeholders, and
    // “quoted” labels and messages as the UPI apps show them, in English).
    const latinOnly = Object.entries(hi)
      .filter(([key, message]) => {
        // ICU keywords (plural categories, select) are code, not copy.
        const words = message
          .replace(/\b(?:plural|select|zero|one|two|few|many|other)\b/g, '')
          .replace(/“[^”]*”/g, '')
          .replace(/\{[^}]*\}|<\/?\w+>|name@bank|Settle|Made with|UPI|ID|QR|PIN|Pro|GPay|PhonePe|Paytm|BHIM|WhatsApp|SMS|AI|JPG|PNG|MB/g, '')
        return /[A-Za-z]{3,}/.test(words) && en[key] !== message
      })
      .map(([key]) => key)
    expect(latinOnly).toEqual([])
  })
})
