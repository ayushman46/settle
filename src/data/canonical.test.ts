/**
 * The loading fast path (`isCanonicalExpense`) must never change what is loaded: whenever it
 * lets a record skip the schema, the schema would have returned an equal record. Checked on
 * hand-written records, on every single-field change to them (valid and broken), on thousands
 * of random records, and on what the app itself saves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { ME_ID, type Expense } from '../domain/types'
import { saveExpense } from './expenses'
import { expenseSchema, expensesSchema, isCanonicalExpense } from './schemas'
import { expensesStore, STORAGE_KEYS } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

/** Deep equality where numbers compare with Object.is (so 0 and -0 differ) and key sets must match. */
function same(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

const clone = <T,>(value: T): T => structuredClone(value)

/** What the schema makes of `raw` (null when it rejects it). */
function viaSchema(raw: unknown): Expense | null {
  const parsed = z.safeParse(expenseSchema, raw)
  return parsed.success ? parsed.data : null
}

/** The property under test: a "yes" from the fast path means the schema returns the same record. */
function expectSafe(raw: unknown): boolean {
  if (!isCanonicalExpense(raw)) return false
  const out = viaSchema(clone(raw))
  expect(out, JSON.stringify(raw)).not.toBeNull()
  expect(same(out, raw), `fast path disagrees with the schema for ${JSON.stringify(raw)} → ${JSON.stringify(out)}`).toBe(true)
  return true
}

const split = {
  id: 'e1',
  kind: 'split',
  title: 'Dinner',
  category: 'food',
  currency: 'INR',
  total: 1000,
  date: '2026-10-21',
  createdAt: 10,
  updatedAt: 20,
  payerId: ME_ID,
  mode: 'equal',
  participants: [
    { friendId: ME_ID, input: null },
    { friendId: 'a', input: null },
  ],
  shares: { [ME_ID]: 500, a: 500 },
  roundedToWhole: false,
  note: null,
  groupId: null,
  bill: null,
  paidBack: { a: 15 },
  recurringId: null,
  source: 'manual',
}

const bill = {
  ...split,
  id: 'e2',
  kind: 'bill',
  title: 'Dinner at Toit',
  mode: 'items',
  total: 1050,
  participants: [
    { friendId: ME_ID, input: null },
    { friendId: 'a', input: null },
    { friendId: 'b', input: null },
  ],
  shares: { [ME_ID]: 350, a: 525, b: 175 },
  paidBack: {},
  note: 'Paid with GPay\n\nIncludes tip',
  groupId: 'g1',
  bill: {
    meta: { merchant: 'Toit', date: '2026-10-21', subtotal: 1000, tax: 50, serviceCharge: null, discount: null, tip: null, total: 1050 },
    items: [
      { id: 'i1', name: 'Naan', quantity: 2, amount: 400 },
      { id: 'i2', name: 'Paneer', quantity: 1, amount: 600 },
    ],
    assignments: { i1: { [ME_ID]: 1, a: 1 }, i2: { a: 1, b: 1, [ME_ID]: 1 } },
    warnings: ['Tax looked high'],
  },
  source: 'scan',
}

const percent = {
  ...split,
  id: 'e3',
  mode: 'percent',
  title: 'Rent 🏠 — October',
  category: 'rent',
  total: 3_000_000,
  payerId: 'a',
  participants: [
    { friendId: 'a', input: 5000 },
    { friendId: ME_ID, input: 2500 },
    { friendId: 'b', input: 2500 },
  ],
  shares: { a: 1_500_000, [ME_ID]: 750_000, b: 750_000 },
  paidBack: { [ME_ID]: 1_792_000_000_000 },
  recurringId: 'r1',
  roundedToWhole: true,
  source: 'recurring',
  createdAt: 0,
  updatedAt: 0,
}

const BASES = [split, bill, percent]

/** One change at a time: kept-valid edits and every way a field can be off. */
const VARIANTS: Record<string, readonly unknown[]> = {
  id: ['', 'x'.repeat(200), 'x'.repeat(201), 7, null],
  kind: ['bill', 'split', 'other', null, undefined],
  title: ['', ' Dinner', 'Dinner ', 'Din  ner', 'Din\tner', 'Din ner', 'Café', 'Café', 'x'.repeat(80), 'x'.repeat(81), 'a​b', 'a‍b', 'Line\nbreak', 7, null],
  category: ['food', 'travel', 'nope', null],
  currency: ['USD', 'inr', 'IN', 'INRR', 7],
  total: [1, 0, -5, 1.5, 1e12, 1e12 + 1, Number.MAX_SAFE_INTEGER, '1000', null, Number.NaN],
  date: ['2026-02-29', '2024-02-29', '2026-13-01', '2026-10-1', '', 7, null],
  createdAt: [0, -0, -1, 1.5, 25, 1e15, Number.NaN, Number.POSITIVE_INFINITY, '10', null],
  updatedAt: [0, 5, 10, 11, -0, 1.5, Number.NaN, null],
  payerId: ['a', 'b', '', 'zz', 7],
  mode: ['equal', 'exact', 'percent', 'shares', 'items', 'weird', null],
  participants: [
    [],
    [{ friendId: ME_ID, input: null }],
    [{ friendId: ME_ID, input: null }, { friendId: ME_ID, input: null }],
    [{ friendId: ME_ID, input: 1.5 }, { friendId: 'a', input: -3 }],
    [{ friendId: ME_ID, input: Number.NaN }],
    [{ friendId: ME_ID, input: null, extra: 1 }],
    [{ friendId: ME_ID }],
    [{ friendId: '', input: null }],
    Array.from({ length: 101 }, (_, i) => ({ friendId: `p${i}`, input: null })),
    'nope',
  ],
  shares: [{}, { [ME_ID]: 1000 }, { [ME_ID]: 500, a: 499 }, { [ME_ID]: 500.5, a: 499.5 }, { [ME_ID]: -500, a: 1500 }, { [ME_ID]: '500', a: 500 }, [], null],
  roundedToWhole: [true, 0, null],
  note: ['', ' Note', 'Note', 'a\n\n\nb', 'a\r\nb', 'x'.repeat(500), 'x'.repeat(501), 7],
  groupId: ['g9', '', 7],
  bill: [
    null,
    { meta: {}, items: [], assignments: {}, warnings: [] },
    { ...bill.bill, warnings: [7] },
    { ...bill.bill, items: [{ id: 'i1', name: 'Naan', quantity: 2, amount: 4.5 }] },
    { ...bill.bill, items: [{ id: 'i1', name: 'Naan', quantity: 2 }] },
    { ...bill.bill, assignments: { i1: { a: 'x' } } },
    { ...bill.bill, assignments: [] },
    { ...bill.bill, extra: true },
    { ...bill.bill, meta: { ...bill.bill.meta, tax: 1.5 } },
    { ...bill.bill, meta: { ...bill.bill.meta, merchant: 7 } },
    'bill',
  ],
  paidBack: [{}, { a: 1 }, { [ME_ID]: 1 }, { b: 1 }, { a: Number.NaN }, { a: '1' }, { constructor: 1 }, null],
  recurringId: ['r2', '', null, 7],
  source: ['scan', 'describe', 'nope', null],
}

function withField(base: object, key: string, value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = clone(base) as Record<string, unknown>
  if (value === undefined) delete out[key]
  else out[key] = clone(value)
  return out
}

describe('isCanonicalExpense (the loading fast path)', () => {
  it('says yes to well-formed records, which the schema hands back unchanged', () => {
    for (const base of BASES) expect(expectSafe(base)).toBe(true)
  })

  it('never says yes where the schema would change or drop the record — one field at a time', () => {
    let accepted = 0
    let checked = 0
    for (const base of BASES) {
      for (const [key, values] of Object.entries(VARIANTS)) {
        for (const value of values) {
          checked += 1
          if (expectSafe(withField(base, key, value))) accepted += 1
        }
      }
      // Extra and missing keys.
      expect(isCanonicalExpense({ ...clone(base), extra: 1 })).toBe(false)
      expect(isCanonicalExpense(JSON.parse(JSON.stringify(base).replace('"id"', '"__proto__":1,"id"')))).toBe(false)
    }
    // Both kinds of answer happen (the test isn't vacuous).
    expect(accepted).toBeGreaterThan(30)
    expect(checked - accepted).toBeGreaterThan(200)
  })

  it('agrees with the schema on thousands of random records', () => {
    let seed = 1234567
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const keys = Object.keys(VARIANTS)
    let accepted = 0
    for (let n = 0; n < 4000; n++) {
      let record: Record<string, unknown> = clone(BASES[n % BASES.length]) as Record<string, unknown>
      const changes = 1 + Math.floor(rand() * 3)
      for (let c = 0; c < changes; c++) {
        const key = keys[Math.floor(rand() * keys.length)] ?? 'id'
        const values = VARIANTS[key] ?? []
        record = withField(record, key, values[Math.floor(rand() * values.length)])
      }
      if (expectSafe(record)) accepted += 1
    }
    expect(accepted).toBeGreaterThan(100)
  })

  it('lists load exactly as before: same records, same order, repeats and bad ones dropped', () => {
    const list = [split, bill, { ...split, title: '  Dinner  ' }, { ...split }, { ...percent, total: -1 }, percent]
    const fast = z.safeParse(expensesSchema, clone(list))
    const slow = z.safeParse(z.array(expenseSchema), clone([split, bill, percent]))
    expect(fast.success && slow.success).toBe(true)
    if (fast.success && slow.success) expect(same(fast.data, slow.data)).toBe(true)
  })

  describe('what the app saves', () => {
    beforeEach(resetDataForTests)
    afterEach(resetDataForTests)

    it('takes the fast path for every expense the app stores', () => {
      saveExpense(draft({ with: ['a', 'b'] }))
      saveExpense(draft({ with: ['a'], title: '  Chai   & samosa ', note: ' Paid in cash \n\n\n thanks ', mode: 'shares', participants: [{ friendId: ME_ID, input: 2 }, { friendId: 'a', input: 1 }] }))
      saveExpense(draft({ with: ['a', 'b'], mode: 'exact', total: 999, participants: [{ friendId: ME_ID, input: 333 }, { friendId: 'a', input: 333 }, { friendId: 'b', input: 333 }], roundedToWhole: true }))
      expensesStore.flush()
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.expenses) ?? '{}') as { data: unknown[] }
      expect(stored.data).toHaveLength(3)
      for (const record of stored.data) expect(expectSafe(record)).toBe(true)
    })
  })
})
