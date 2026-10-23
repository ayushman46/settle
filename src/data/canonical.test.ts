/**
 * The loading fast paths (`isCanonicalExpense`, and `isCanonicalProfile` / `Friend` / `Group` /
 * `Recurring` for the small collections) must never change what is loaded: whenever one lets a
 * record skip the schema, the schema would have returned an equal record. Checked on hand-written
 * records, on every single-field change to them (valid and broken), on thousands of random
 * records, and on what the app itself saves.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { ME_ID, type Expense } from '../domain/types'
import { saveExpense } from './expenses'
import { addFriend, updateFriend } from './friends'
import { createGroup, recordSettlement, updateGroup } from './groups'
import { updateProfile } from './profile'
import { saveRecurring } from './recurring'
import {
  expenseSchema,
  expensesSchema,
  friendSchema,
  friendsSchema,
  groupSchema,
  groupsSchema,
  isCanonicalExpense,
  isCanonicalFriend,
  isCanonicalGroup,
  isCanonicalProfile,
  isCanonicalRecurring,
  profileSchema,
  recurringListSchema,
  recurringSchema,
  withMe,
} from './schemas'
import { flushAllStores } from './store'
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

const THB_FX = { amount: 125000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' }

/** v4: a cash loan (1:1, no bill). */
const loan = {
  ...split,
  id: 'e4',
  kind: 'loan',
  title: 'Cash',
  participants: [{ friendId: 'a', input: null }],
  shares: { a: 1000 },
  paidBack: {},
}

/** v4: a trip expense paid in baht, settled in rupees. */
const abroad = { ...split, id: 'e5', total: 301344, shares: { [ME_ID]: 150672, a: 150672 }, paidBack: {}, fx: THB_FX }

const FEES = [
  { id: 'f1', kind: 'delivery', label: 'Delivery partner fee', amount: 35 },
  { id: 'f2', kind: 'platform', label: 'Platform fee', amount: 10 },
]

/** v4: a delivery order with fees shared equally. */
const delivery = { ...bill, id: 'e6', bill: { ...bill.bill, feeSplit: 'equal', meta: { ...bill.bill.meta, fees: FEES } } }

const BASES = [split, bill, percent, loan, abroad, delivery]

/** One change at a time: kept-valid edits and every way a field can be off. */
const VARIANTS: Record<string, readonly unknown[]> = {
  id: ['', 'x'.repeat(200), 'x'.repeat(201), 7, null],
  kind: ['bill', 'split', 'loan', 'other', null, undefined],
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
    { ...bill.bill, feeSplit: 'equal' },
    { ...bill.bill, feeSplit: 'proportional' },
    { ...bill.bill, feeSplit: 'half' },
    { ...bill.bill, feeSplit: null },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: FEES } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: null } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [{ ...FEES[0], kind: 'rain' }] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [{ ...FEES[0], label: ' Delivery' }] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [{ ...FEES[0], label: '' }] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [{ ...FEES[0], amount: 0 }] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [FEES[0], FEES[0]] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: [{ ...FEES[0], extra: 1 }] } },
    { ...bill.bill, meta: { ...bill.bill.meta, fees: Array.from({ length: 16 }, (_, i) => ({ ...FEES[0], id: `f${i}` })) } },
    'bill',
  ],
  fx: [
    THB_FX,
    { ...THB_FX, source: 'manual_total', rateDate: null },
    { ...THB_FX, currency: 'INR' },
    { ...THB_FX, currency: 'XYZ' },
    { ...THB_FX, amount: 0 },
    { ...THB_FX, rate: '1e3' },
    { ...THB_FX, rate: '0' },
    { ...THB_FX, rate: 2.41 },
    { ...THB_FX, rateDate: 'yesterday' },
    { ...THB_FX, source: 'guess' },
    { ...THB_FX, extra: 1 },
    null,
    undefined,
    'fx',
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
    expect(accepted).toBeGreaterThan(60)
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
      saveExpense(draft({ kind: 'loan', participants: [{ friendId: 'a', input: null }] }))
      saveExpense(draft({ with: ['a'], fx: { amount: 125000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' } }))
      expensesStore.flush()
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.expenses) ?? '{}') as { data: unknown[] }
      expect(stored.data).toHaveLength(5)
      for (const record of stored.data) expect(expectSafe(record)).toBe(true)
    })
  })
})

/* ------------------------------------------------------------------ the small collections */

/**
 * One collection's fast path under test: `slow` is what its schema makes of a record without the
 * fast path (null when it rejects it).
 */
interface Collection {
  name: string
  isCanonical: (raw: unknown) => boolean
  slow: (raw: unknown) => unknown
  bases: readonly object[]
  variants: Record<string, readonly unknown[]>
}

function slowly<T>(schema: z.core.$ZodType<T>): (raw: unknown) => T | null {
  return (raw) => {
    const parsed = z.safeParse(schema, clone(raw))
    return parsed.success ? parsed.data : null
  }
}

const SETTLEMENT = { id: 's1', fromId: 'a', toId: ME_ID, amount: 50000, date: '2026-10-20', createdAt: 15, method: 'upi' }
const NAMES = ['', ' Riya', 'Riya ', 'Ri  ya', 'Ri\tya', 'x'.repeat(24), 'x'.repeat(25), 'René', 'René', 'a​b', '\u{1F469}‍\u{1F4BB} Dev', 7, null]
const UPI_IDS = [null, 'riya@oksbi', 'Riya@OKSBI', ' riya@oksbi', 'ri ya@oksbi', 'riya', '', 7]
const TIMESTAMPS = [0, -0, -1, 1, 1.5, 1e15, Number.NaN, Number.POSITIVE_INFINITY, '10', null]
const PEOPLE = [
  [],
  [{ friendId: ME_ID, input: null }],
  [{ friendId: ME_ID, input: null }, { friendId: ME_ID, input: null }],
  [{ friendId: ME_ID, input: 1.5 }, { friendId: 'a', input: -3 }],
  [{ friendId: ME_ID, input: -0 }],
  [{ friendId: ME_ID, input: Number.NaN }],
  [{ friendId: ME_ID, input: null, extra: 1 }],
  [{ friendId: ME_ID }],
  [{ friendId: '', input: null }],
  Array.from({ length: 100 }, (_, i) => ({ friendId: `p${i}`, input: null })),
  Array.from({ length: 101 }, (_, i) => ({ friendId: `p${i}`, input: null })),
  'nope',
]

const COLLECTIONS: readonly Collection[] = [
  {
    name: 'profile',
    isCanonical: isCanonicalProfile,
    // profileSchema has the fast path built in; an unknown extra key keeps a record off it, and
    // the schema drops that key, so this is the schema's own answer for `raw`.
    slow: (raw) => slowly(profileSchema)({ ...(raw as object), offFastPath: 1 }),
    bases: [
      { name: 'Asha', upiId: 'asha@okhdfc', currency: 'INR', theme: 'system', accent: 'lime', haptics: true, onboarded: true, createdAt: 1_700_000_000_000, language: null },
      { name: '', upiId: null, currency: 'KWD', theme: 'dark', accent: 'coral', haptics: false, onboarded: false, createdAt: 5, language: 'hi' },
    ],
    variants: {
      name: NAMES,
      upiId: UPI_IDS,
      currency: ['INR', 'USD', 'KWD', 'BTN', 'inr', 'XYZ', 'RUPEES', '', 7, null],
      theme: ['system', 'light', 'dark', 'sepia', null],
      accent: ['lime', 'mint', 'sky', 'violet', 'coral', 'pink', null],
      haptics: [true, false, 0, null],
      onboarded: [true, false, 'yes', undefined],
      createdAt: TIMESTAMPS,
      language: [null, 'en', 'hi', 'ta', 'gu', 'xx', 'HI', 7, undefined],
    },
  },
  {
    name: 'friend',
    isCanonical: isCanonicalFriend,
    slow: slowly(friendSchema),
    bases: [
      { id: ME_ID, name: 'Me', color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0 },
      { id: 'f1', name: 'Riya Sharma', color: 7, upiId: 'riya@oksbi', phone: '+919876543210', createdAt: 1700, lastUsedAt: 1800 },
    ],
    variants: {
      id: ['', 'x'.repeat(200), 'x'.repeat(201), 7, null],
      name: NAMES,
      color: [0, 3, 7, 8, -1, -0, 1.5, '3', Number.NaN, null],
      upiId: UPI_IDS,
      phone: [null, '+919876543210', '9876543210', '+91 98765-43210', '98765 43210', '123', `+${'9'.repeat(16)}`, '', 7],
      createdAt: TIMESTAMPS,
      lastUsedAt: TIMESTAMPS,
    },
  },
  {
    name: 'group',
    isCanonical: isCanonicalGroup,
    slow: slowly(groupSchema),
    bases: [
      {
        id: 'g1',
        name: 'Goa trip',
        emoji: '\u{1F3D6}️',
        kind: 'trip',
        currency: 'INR',
        memberIds: [ME_ID, 'a', 'b'],
        settlements: [SETTLEMENT, { ...SETTLEMENT, id: 's2', fromId: ME_ID, toId: 'b', method: 'cash', createdAt: 0 }],
        createdAt: 10,
        updatedAt: 20,
        archived: false,
        travelCurrency: 'THB',
        roundSize: 150000,
      },
      { id: 'g2', name: 'Flat 4B', emoji: '\u{1F3E0}', kind: 'home', currency: 'XYZ', memberIds: [ME_ID], settlements: [], createdAt: 0, updatedAt: 0, archived: true, travelCurrency: null, roundSize: null },
    ],
    variants: {
      id: ['', 'x'.repeat(201), 7],
      name: ['', ' Goa', 'Goa ', 'G  oa', 'x'.repeat(40), 'x'.repeat(41), 'Goa\u0007', 'Group', 'Line\nbreak', 7, null],
      emoji: [
        '\u{1F465}', // one code point (surrogate pair)
        '✈️', // with a variation selector
        '✈',
        '\u{1F468}‍\u{1F469}‍\u{1F467}', // a ZWJ family
        '\u{1F1EE}\u{1F1F3}', // a flag
        '\u{1F44D}\u{1F3FD}', // a skin tone
        'a',
        'ab',
        ' ',
        '',
        ' \u{1F465}',
        '\u{1F465} ',
        '\u{1F465}\u{1F465}',
        '‍',
        '​',
        '\ud83d', // a lone surrogate
        '\ud83d\ud83d',
        ' ',
        '﻿',
        '\n',
        7,
        null,
      ],
      kind: ['trip', 'home', 'couple', 'event', 'other', 'party', null],
      currency: ['INR', 'USD', 'XYZ', 'inr', 'IN', 7],
      memberIds: [
        [ME_ID],
        [ME_ID, 'a', 'b'],
        ['a', ME_ID],
        ['a'],
        [ME_ID, ME_ID],
        [ME_ID, 'a', 'a'],
        [ME_ID, ''],
        [ME_ID, 7],
        [ME_ID, 'x'.repeat(300)],
        [],
        [ME_ID, ...Array.from({ length: 99 }, (_, i) => `m${i}`)],
        [ME_ID, ...Array.from({ length: 100 }, (_, i) => `m${i}`)],
        'nope',
        null,
      ],
      settlements: [
        [],
        [SETTLEMENT],
        [SETTLEMENT, SETTLEMENT],
        [{ ...SETTLEMENT, fromId: ME_ID }],
        [{ ...SETTLEMENT, amount: 0 }],
        [{ ...SETTLEMENT, amount: 1.5 }],
        [{ ...SETTLEMENT, amount: 1e12 + 1 }],
        [{ ...SETTLEMENT, date: '' }],
        [{ ...SETTLEMENT, date: '2026-02-30' }],
        [{ ...SETTLEMENT, method: 'card' }],
        [{ ...SETTLEMENT, createdAt: -1 }],
        [{ ...SETTLEMENT, createdAt: 1.5 }],
        [{ ...SETTLEMENT, id: '' }],
        [{ ...SETTLEMENT, extra: 1 }],
        [{ id: 's1' }],
        'nope',
        null,
      ],
      createdAt: TIMESTAMPS,
      updatedAt: [0, 5, 10, 11, 25, -0, 1.5, Number.NaN, null],
      archived: [true, false, 0, null],
      travelCurrency: [null, 'THB', 'INR', 'XYZ', 'thb', '', 7, undefined],
      roundSize: [null, 1, 150000, 0, -1, 1.5, 1e12, 1e12 + 1, '100', undefined],
    },
  },
  {
    name: 'recurring',
    isCanonical: isCanonicalRecurring,
    slow: slowly(recurringSchema),
    bases: [
      {
        id: 'r1',
        title: 'Rent',
        category: 'rent',
        currency: 'INR',
        total: 3_200_000,
        payerId: ME_ID,
        mode: 'percent',
        participants: [
          { friendId: ME_ID, input: 4000 },
          { friendId: 'a', input: 3000 },
          { friendId: 'b', input: 3000 },
        ],
        dayOfMonth: 5,
        groupId: null,
        lastCreatedPeriod: '2026-10',
        active: true,
        createdAt: 100,
      },
      {
        id: 'r2',
        title: 'Wi-Fi \u{1F4F6}',
        category: 'utilities',
        currency: 'USD',
        total: 1,
        payerId: 'a',
        mode: 'equal',
        participants: [{ friendId: 'a', input: null }],
        dayOfMonth: 28,
        groupId: 'g1',
        lastCreatedPeriod: null,
        active: false,
        createdAt: 0,
      },
    ],
    variants: {
      id: ['', 'x'.repeat(201), 7, null],
      title: ['', ' Rent', 'Rent ', 'Re  nt', 'x'.repeat(80), 'x'.repeat(81), 'Line\nbreak', 7, null],
      category: ['rent', 'food', 'nope', null],
      currency: ['INR', 'XYZ', 'inr', 7],
      total: [1, 0, -5, 1.5, 1e12, 1e12 + 1, '100', null],
      payerId: ['a', 'zz', '', 7],
      mode: ['equal', 'exact', 'percent', 'shares', 'items', null],
      participants: PEOPLE,
      dayOfMonth: [1, 28, 29, 0, -1, 5.5, -0, Number.NaN, '5', null],
      groupId: ['g1', '', null, 7, undefined],
      lastCreatedPeriod: [null, '2026-10', '2026-13', '2026-00', '2026-10-01', '', 7],
      active: [true, false, 0, null],
      createdAt: TIMESTAMPS,
    },
  },
]

const collection = (name: string): Collection => {
  const found = COLLECTIONS.find((c) => c.name === name)
  if (!found) throw new Error(name)
  return found
}

describe.each(COLLECTIONS)('the $name fast path', ({ isCanonical, slow, bases, variants }) => {
  /** The property under test: a "yes" from the fast path means the schema returns the same record. */
  function safe(raw: unknown): boolean {
    if (!isCanonical(raw)) return false
    const out = slow(raw)
    expect(out, JSON.stringify(raw)).not.toBeNull()
    expect(same(out, raw), `fast path disagrees with the schema for ${JSON.stringify(raw)} → ${JSON.stringify(out)}`).toBe(true)
    return true
  }

  it('says yes to well-formed records, which the schema hands back unchanged', () => {
    for (const base of bases) expect(safe(base)).toBe(true)
  })

  it('never says yes where the schema would change or drop the record — one field at a time', () => {
    let accepted = 0
    let checked = 0
    for (const base of bases) {
      for (const [key, values] of Object.entries(variants)) {
        for (const value of values) {
          checked += 1
          if (safe(withField(base, key, value))) accepted += 1
        }
      }
      expect(isCanonical({ ...clone(base), extra: 1 })).toBe(false)
      const firstKey = Object.keys(base)[0] ?? ''
      expect(isCanonical(JSON.parse(JSON.stringify(base).replace(`"${firstKey}"`, `"__proto__":1,"${firstKey}"`)))).toBe(false)
      expect(isCanonical(Object.assign(Object.create({ inherited: 1 }) as object, clone(base)))).toBe(false)
    }
    // Both kinds of answer happen (the test isn't vacuous).
    expect(accepted).toBeGreaterThan(15)
    expect(checked - accepted).toBeGreaterThan(30)
  })

  it('agrees with the schema on thousands of random records', () => {
    let seed = 7654321
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const keys = Object.keys(variants)
    let accepted = 0
    for (let n = 0; n < 2000; n++) {
      let record = clone(bases[n % bases.length]) as Record<string, unknown>
      const changes = 1 + Math.floor(rand() * 3)
      for (let c = 0; c < changes; c++) {
        const key = keys[Math.floor(rand() * keys.length)] ?? 'id'
        const values = variants[key] ?? []
        record = withField(record, key, values[Math.floor(rand() * values.length)])
      }
      if (safe(record)) accepted += 1
    }
    expect(accepted).toBeGreaterThan(100)
  })
})

describe('the small collections load exactly as before', () => {
  /** What a list schema without the fast path keeps: each record through `item`, first of each id. */
  function slowList<T extends { id: string }>(item: z.core.$ZodType<T>, list: readonly unknown[]): T[] {
    const out: T[] = []
    for (const raw of list) {
      const parsed = z.safeParse(item, clone(raw))
      if (parsed.success && !out.some((v) => v.id === parsed.data.id)) out.push(parsed.data)
    }
    return out
  }

  function parsedOk<T>(schema: z.core.$ZodType<T>, value: unknown): T {
    const parsed = z.safeParse(schema, clone(value))
    if (!parsed.success) throw new Error(`rejected: ${JSON.stringify(value)}`)
    return parsed.data
  }

  it('friends: same records, same order, repeats and bad ones dropped, the owner first', () => {
    const [me, riya] = collection('friend').bases
    const list = [riya, { ...riya, name: '  Riya  ' }, { ...riya, id: 'f2', name: '' }, { ...riya, id: 'f3', upiId: 'RIYA@oksbi' }, me, { ...riya }]
    expect(same(parsedOk(friendsSchema, list), withMe(slowList(friendSchema, list)))).toBe(true)
    expect(same(parsedOk(friendsSchema, [riya]), [{ id: ME_ID, name: 'Me', color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0 }, riya])).toBe(true)
  })

  it('groups and recurring templates: same records, same order, repeats and bad ones dropped', () => {
    const [g1, g2] = collection('group').bases
    const groupList = [g2, { ...g1, name: ' Goa ' }, g1, { ...g2, id: 'g3', currency: 'inr' }, { ...g2, id: 'g4', memberIds: ['a'] }]
    expect(same(parsedOk(groupsSchema, groupList), slowList(groupSchema, groupList))).toBe(true)
    const [r1, r2] = collection('recurring').bases
    const recurringList = [r1, r2, { ...r1, title: 'Rent ' }, { ...r2, id: 'r3', dayOfMonth: 31 }, { ...r2, id: 'r4', total: 0 }]
    expect(same(parsedOk(recurringListSchema, recurringList), slowList(recurringSchema, recurringList))).toBe(true)
  })

  it('profile: a record off the fast path is repaired as before, and an unusable one still fails', () => {
    const [asha] = collection('profile').bases
    const repaired = parsedOk(profileSchema, { ...asha, name: '  Asha  ', upiId: 'ASHA@okhdfc', language: 'xx' })
    expect(repaired).toEqual({ ...asha, name: 'Asha', upiId: 'asha@okhdfc', language: null })
    expect(z.safeParse(profileSchema, 'nope').success).toBe(false)
    expect(z.safeParse(profileSchema, null).success).toBe(false)
  })

  describe('what the app saves', () => {
    beforeEach(resetDataForTests)
    afterEach(resetDataForTests)

    it('takes the fast path for the profile, friends, groups and templates the app stores', () => {
      updateProfile({ name: '  Asha  Rao ', upiId: 'Asha@OKHDFC', currency: 'USD', theme: 'dark', accent: 'mint', language: 'ta', onboarded: true })
      const riya = addFriend({ name: ' Riya   Sharma ', upiId: ' riya@oksbi ', phone: '+91 98765-43210' })
      const sam = addFriend({ name: 'Sam \u{1F468}‍\u{1F4BB}' })
      updateFriend(sam.id, { color: 5, phone: '98765 43210' })
      const trip = createGroup({ name: '  Goa   trip ', emoji: '\u{1F3D6}️', kind: 'trip', currency: 'INR', memberIds: [riya.id, sam.id], travelCurrency: 'THB' })
      createGroup({ name: '', emoji: '\u{1F468}‍\u{1F469}‍\u{1F467}', kind: 'home', currency: 'INR', memberIds: [] })
      createGroup({ name: 'Flat', emoji: ' ', kind: 'home', currency: 'INR', memberIds: [riya.id] })
      updateGroup(trip.id, { roundSize: 150000 })
      recordSettlement(trip.id, { fromId: riya.id, toId: ME_ID, amount: 50000, date: '2026-10-20', method: 'upi' })
      saveRecurring({
        title: '  Rent ',
        category: 'rent',
        currency: 'INR',
        total: 3_200_000,
        payerId: ME_ID,
        mode: 'percent',
        participants: [
          { friendId: ME_ID, input: 4000 },
          { friendId: riya.id, input: 6000 },
        ],
        dayOfMonth: 5,
        groupId: trip.id,
        active: true,
      })
      flushAllStores()
      const read = (key: string): unknown => (JSON.parse(window.localStorage.getItem(key) ?? '{}') as { data: unknown }).data
      const check = (name: string, record: unknown) => {
        const c = collection(name)
        expect(c.isCanonical(record), JSON.stringify(record)).toBe(true)
        expect(same(c.slow(record), record)).toBe(true)
      }

      check('profile', read(STORAGE_KEYS.profile))
      const storedFriends = read(STORAGE_KEYS.friends) as unknown[]
      expect(storedFriends).toHaveLength(3)
      for (const f of storedFriends) check('friend', f)
      const storedGroups = read(STORAGE_KEYS.groups) as unknown[]
      expect(storedGroups).toHaveLength(3)
      for (const g of storedGroups) check('group', g)
      const storedRecurring = read(STORAGE_KEYS.recurring) as unknown[]
      expect(storedRecurring).toHaveLength(1)
      for (const r of storedRecurring) check('recurring', r)
    })
  })
})
