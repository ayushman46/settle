/**
 * Key parity for the money screens' catalogs (bill, split, expense, recurring, state): every English
 * key has a Hindi translation and nothing else, with the same placeholders and tags, and every
 * message parses — so a Hindi phone never sees a broken `{amount}`.
 */
import { describe, expect, it } from 'vitest'
import { parseMessage, type Node } from '../../i18n/format'
import { bill as enBill } from '../../i18n/en/bill'
import { expense as enExpense } from '../../i18n/en/expense'
import { recurring as enRecurring } from '../../i18n/en/recurring'
import { split as enSplit } from '../../i18n/en/split'
import { state as enState } from '../../i18n/en/state'
import { bill as hiBill } from '../../i18n/hi/bill'
import { expense as hiExpense } from '../../i18n/hi/expense'
import { recurring as hiRecurring } from '../../i18n/hi/recurring'
import { split as hiSplit } from '../../i18n/hi/split'
import { state as hiState } from '../../i18n/hi/state'
import type { Messages } from '../../i18n/types'

const NAMESPACES: ReadonlyArray<readonly [string, Messages, Messages]> = [
  ['bill', enBill, hiBill],
  ['split', enSplit, hiSplit],
  ['expense', enExpense, hiExpense],
  ['recurring', enRecurring, hiRecurring],
  ['state', enState, hiState],
]

/** Every argument (`arg:name`, `plural:count`, …) and tag (`tag:b`) a message uses, sorted. */
function signature(message: string): string[] {
  const out = new Set<string>()
  const walk = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (typeof node === 'string' || node.k === 'pound') continue
      if (node.k === 'tag') {
        out.add(`tag:${node.name}`)
        walk(node.children)
      } else if (node.k === 'plural' || node.k === 'select') {
        out.add(`${node.k}:${node.name}`)
        for (const nodes of Object.values(node.cases)) walk(nodes)
      } else {
        // `{n}` and `{n, number}` are the same value to a translator.
        out.add(`arg:${node.name}`)
      }
    }
  }
  walk(parseMessage(message))
  return [...out].sort()
}

/** Plural cases a message offers (Hindi needs `one` and `other`; `=N` cases are extra). */
function pluralCases(message: string): string[][] {
  const out: string[][] = []
  const walk = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (typeof node === 'string' || node.k === 'pound' || node.k === 'arg' || node.k === 'number') continue
      if (node.k === 'tag') walk(node.children)
      else {
        if (node.k === 'plural') out.push(Object.keys(node.cases))
        for (const nodes of Object.values(node.cases)) walk(nodes)
      }
    }
  }
  walk(parseMessage(message))
  return out
}

describe.each(NAMESPACES)('the %s catalog', (ns, en, hi) => {
  it(`keys all start with "${ns}."`, () => {
    for (const key of Object.keys(en)) expect(key.startsWith(`${ns}.`), key).toBe(true)
  })

  it('Hindi has every English key and no others', () => {
    const missing = Object.keys(en).filter((key) => !Object.hasOwn(hi, key))
    const extra = Object.keys(hi).filter((key) => !Object.hasOwn(en, key))
    expect(missing).toEqual([])
    expect(extra).toEqual([])
  })

  it('Hindi keeps the same placeholders and tags, and no message is empty', () => {
    for (const [key, english] of Object.entries(en)) {
      const hindi = hi[key]
      if (hindi === undefined) continue
      expect(hindi.trim(), key).not.toBe('')
      expect(signature(hindi), key).toEqual(signature(english))
    }
  })

  it('Hindi plurals cover one and other', () => {
    for (const [key, hindi] of Object.entries(hi)) {
      for (const cases of pluralCases(hindi)) {
        expect(cases, key).toContain('one')
        expect(cases, key).toContain('other')
      }
    }
  })
})
