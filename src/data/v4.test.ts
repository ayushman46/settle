/**
 * Settle v4 data: loans, trip currency (fx), delivery fees, group trip settings, the profile
 * language, claim rounds and collections — schema round trips and repairs, the actions that
 * write them, backup v3 → v4 and v4 merges, and the CSV columns.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { ME_ID, type ClaimRound, type Expense, type Pool } from '../domain/types'
import { clearAllData, exportBackup, importBackup, parseBackup } from './backup'
import { duplicateExpenseDraft, expenseDraftIssue, saveExpense } from './expenses'
import { addFriend } from './friends'
import { createGroup, updateGroup } from './groups'
import { updateProfile } from './profile'
import {
  claimRoundSchema,
  claimRoundsSchema,
  cleanBillFees,
  cleanExpenseKind,
  cleanFx,
  expenseSchema,
  groupSchema,
  isCanonicalExpense,
  poolSchema,
  poolsSchema,
  profileSchema,
} from './schemas'
import { flushAllStores } from './store'
import { claimsStore, expensesStore, groupsStore, poolsStore, profileStore, STORAGE_KEYS } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

const parse = <T,>(schema: z.core.$ZodType<T>, value: unknown): T | null => {
  const out = z.safeParse(schema, structuredClone(value))
  return out.success ? out.data : null
}

const THB_FX = { amount: 125000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' } as const

const base: Expense = {
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
  paidBack: {},
  recurringId: null,
  source: 'manual',
}

const loan: Expense = { ...base, id: 'l1', kind: 'loan', title: 'Cash', participants: [{ friendId: 'a', input: null }], shares: { a: 1000 } }

const bill: Expense = {
  ...base,
  id: 'b1',
  kind: 'bill',
  mode: 'items',
  bill: {
    meta: { merchant: 'Swiggy', date: null, subtotal: 900, tax: null, serviceCharge: null, discount: null, tip: null, total: 1000 },
    items: [{ id: 'i1', name: 'Biryani', quantity: 1, amount: 900 }],
    assignments: { i1: { [ME_ID]: 1, a: 1 } },
    warnings: [],
  },
}

/* ------------------------------------------------------------------ expense kind */

describe('expense kind: loans', () => {
  it('keeps a loan that is 1:1 with no bill, and the fast path agrees', () => {
    expect(parse(expenseSchema, loan)?.kind).toBe('loan')
    expect(isCanonicalExpense(structuredClone(loan))).toBe(true)
  })

  it('reads a loan that is not 1:1 (or has a bill) as a plain split, like older versions do', () => {
    expect(parse(expenseSchema, { ...loan, participants: base.participants, shares: base.shares })?.kind).toBe('split')
    expect(parse(expenseSchema, { ...loan, participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 1000 } })?.kind).toBe('split')
    expect(parse(expenseSchema, { ...bill, kind: 'loan' })?.kind).toBe('split')
    for (const raw of [{ ...loan, participants: base.participants, shares: base.shares }, { ...bill, kind: 'loan' }]) {
      expect(isCanonicalExpense(structuredClone(raw))).toBe(false)
    }
  })

  it('cleanExpenseKind follows the same rule', () => {
    const one = { participants: [{ friendId: 'a', input: null }], payerId: ME_ID, bill: null }
    expect(cleanExpenseKind('loan', one)).toBe('loan')
    expect(cleanExpenseKind('loan', { ...one, payerId: 'a' })).toBe('split')
    expect(cleanExpenseKind('bill', one)).toBe('split')
    expect(cleanExpenseKind('bill', { ...one, bill: bill.bill })).toBe('bill')
    expect(cleanExpenseKind('weird', one)).toBe('split')
  })
})

describe('saveExpense: loans', () => {
  beforeEach(resetDataForTests)

  it('saves a 1:1 loan as equal, unrounded and without a bill', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const e = saveExpense(draft({ kind: 'loan', title: 'Cash', total: 50000, mode: 'shares', roundedToWhole: true, bill: bill.bill, participants: [{ friendId: riya, input: 3 }] }))
    expect(e).toMatchObject({ kind: 'loan', mode: 'equal', roundedToWhole: false, bill: null, shares: { [riya]: 50000 } })
    expect(isCanonicalExpense(JSON.parse(JSON.stringify(e)))).toBe(true)
  })

  it('saves "they lent me" (the friend paid, I borrowed)', () => {
    const kabir = addFriend({ name: 'Kabir' }).id
    const e = saveExpense(draft({ kind: 'loan', payerId: kabir, total: 200000, participants: [{ friendId: ME_ID, input: null }] }))
    expect(e).toMatchObject({ kind: 'loan', payerId: kabir, shares: { [ME_ID]: 200000 } })
  })

  it('saves a loan drafted with more than one person as a split', () => {
    const riya = addFriend({ name: 'Riya' }).id
    expect(saveExpense(draft({ kind: 'loan', with: [riya] })).kind).toBe('split')
  })

  it('duplicates keep the kind', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const e = saveExpense(draft({ kind: 'loan', participants: [{ friendId: riya, input: null }] }))
    expect(duplicateExpenseDraft(e.id).kind).toBe('loan')
  })
})

/* ------------------------------------------------------------------ trip currency */

describe('expense fx', () => {
  it('round-trips a valid snapshot and takes the fast path', () => {
    const raw = { ...base, fx: THB_FX }
    expect(parse(expenseSchema, raw)?.fx).toEqual(THB_FX)
    expect(isCanonicalExpense(structuredClone(raw))).toBe(true)
  })

  it('stores no fx key for plain expenses (older records keep their exact shape)', () => {
    const out = parse(expenseSchema, base)
    expect(out && Object.hasOwn(out, 'fx')).toBe(false)
    const nulled = parse(expenseSchema, { ...base, fx: null })
    expect(nulled && Object.hasOwn(nulled, 'fx')).toBe(false)
    expect(isCanonicalExpense({ ...structuredClone(base), fx: null })).toBe(false)
  })

  it.each([
    ['unknown currency', { currency: 'XYZ' }],
    ['the expense currency', { currency: 'INR' }],
    ['lower-case code', { currency: 'thb' }],
    ['zero amount', { amount: 0 }],
    ['fractional amount', { amount: 1.5 }],
    ['rate with exponent', { rate: '1e3' }],
    ['zero rate', { rate: '0' }],
    ['negative rate', { rate: '-2' }],
    ['13 decimals', { rate: '1.1234567890123' }],
    ['numeric rate', { rate: 2.41 }],
    ['unknown source', { source: 'guess' }],
  ])('drops a snapshot with %s', (_name, patch) => {
    const raw = { ...base, fx: { ...THB_FX, ...patch } }
    const out = parse(expenseSchema, raw)
    expect(out).not.toBeNull()
    expect(out && Object.hasOwn(out, 'fx')).toBe(false)
    expect(isCanonicalExpense(structuredClone(raw))).toBe(false)
  })

  it('repairs a bad rate date to null (kept for manual rates)', () => {
    expect(cleanFx({ ...THB_FX, rateDate: 'yesterday' }, 'INR')).toEqual({ ...THB_FX, rateDate: null })
    expect(cleanFx({ ...THB_FX, source: 'manual_rate', rateDate: null }, 'INR')?.rateDate).toBeNull()
    expect(isCanonicalExpense({ ...structuredClone(base), fx: { ...THB_FX, rateDate: 'yesterday' } })).toBe(false)
    expect(isCanonicalExpense({ ...structuredClone(base), fx: { ...THB_FX, extra: 1 } })).toBe(false)
  })
})

describe('saveExpense: fx', () => {
  beforeEach(resetDataForTests)

  it('recomputes the total from the frozen rate (never trusts a mismatched total)', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const sam = addFriend({ name: 'Sam' }).id
    const e = saveExpense(draft({ total: 99, with: [riya, sam], fx: THB_FX }))
    expect(e.total).toBe(301344)
    expect(e.shares).toEqual({ [ME_ID]: 100448, [riya]: 100448, [sam]: 100448 })
    expect(e.fx).toEqual(THB_FX)
    expect(isCanonicalExpense(JSON.parse(JSON.stringify(e)))).toBe(true)
  })

  it('keeps the typed total for "what your bank charged"', () => {
    const e = saveExpense(draft({ total: 310420, fx: { ...THB_FX, rate: '2.48336', rateDate: null, source: 'manual_total' } }))
    expect(e.total).toBe(310420)
    expect(e.fx?.source).toBe('manual_total')
  })

  it('drops an invalid snapshot and saves the typed total', () => {
    const e = saveExpense(draft({ total: 5000, fx: { ...THB_FX, currency: 'INR' } }))
    expect(e.total).toBe(5000)
    expect(Object.hasOwn(e, 'fx')).toBe(false)
  })

  it('rejects a conversion that comes to nothing', () => {
    expect(expenseDraftIssue(draft({ fx: { ...THB_FX, amount: 1, currency: 'IDR', rate: '0.0001' } }))).toBe('bad_total')
  })

  it('editing without fx removes it', () => {
    const e = saveExpense(draft({ fx: THB_FX }))
    const edited = saveExpense({ ...draft({ total: 4000 }), id: e.id })
    expect(Object.hasOwn(edited, 'fx')).toBe(false)
    expect(edited.total).toBe(4000)
  })

  it('a group currency change relabels its expenses and drops their fx (the rate was into the old currency)', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const g = createGroup({ name: 'Bangkok', emoji: '🛺', kind: 'trip', currency: 'INR', memberIds: [riya], travelCurrency: 'THB' })
    const e = saveExpense(draft({ groupId: g.id, with: [riya], fx: THB_FX }))
    updateGroup(g.id, { currency: 'USD' })
    const after = expensesStore.get().find((x) => x.id === e.id)
    expect(after?.currency).toBe('USD')
    expect(after && Object.hasOwn(after, 'fx')).toBe(false)
    expect(groupsStore.get()[0]?.travelCurrency).toBe('THB')
  })
})

/* ------------------------------------------------------------------ delivery fees */

describe('bill fees and fee split', () => {
  const fees = [
    { id: 'f1', kind: 'delivery', label: 'Delivery partner fee', amount: 3500 },
    { id: 'f2', kind: 'platform', label: 'Platform fee', amount: 1000 },
  ]

  it('round-trips fees and the fee split on the fast path', () => {
    const raw = { ...bill, bill: { ...bill.bill, feeSplit: 'equal', meta: { ...bill.bill?.meta, fees } } }
    const out = parse(expenseSchema, raw)
    expect(out?.bill?.meta.fees).toEqual(fees)
    expect(out?.bill?.feeSplit).toBe('equal')
    expect(isCanonicalExpense(structuredClone(raw))).toBe(true)
  })

  it('leaves older bills exactly as they were (no fees key, no feeSplit key)', () => {
    const out = parse(expenseSchema, bill)
    expect(out?.bill && Object.hasOwn(out.bill, 'feeSplit')).toBe(false)
    expect(out?.bill && Object.hasOwn(out.bill.meta, 'fees')).toBe(false)
    expect(isCanonicalExpense(structuredClone(bill))).toBe(true)
  })

  it('cleans fees one by one', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, kind: 'other', label: `Fee ${i}`, amount: 100 }))
    expect(cleanBillFees(many)).toHaveLength(15)
    expect(
      cleanBillFees([
        { id: 'a', kind: 'rain', label: '  Rain   fee ', amount: 2500 },
        { id: 'a', kind: 'tip', label: 'Dup id', amount: 100 },
        { id: 'b', kind: 'tip', label: '', amount: 2000 },
        { id: 'c', kind: 'tip', label: 'Zero', amount: 0 },
        { id: 'd', kind: 'tip', label: 'Float', amount: 1.5 },
        { id: '', kind: 'tip', label: 'No id', amount: 100 },
        { id: 'e', kind: 'tip', label: 'x'.repeat(50), amount: 100 },
        'junk',
      ]),
    ).toEqual([
      { id: 'a', kind: 'other', label: 'Rain fee', amount: 2500 },
      { id: 'b', kind: 'tip', label: 'Fee', amount: 2000 },
      { id: 'e', kind: 'tip', label: 'x'.repeat(40), amount: 100 },
    ])
    expect(cleanBillFees('nope')).toEqual([])
  })

  it.each([
    ['an invalid fee split', { feeSplit: 'half' }, false],
    ['an empty fee list', { meta: { ...bill.bill?.meta, fees: [] } }, false],
    ['a fee needing repair', { meta: { ...bill.bill?.meta, fees: [{ ...fees[0], label: ' Delivery ' }] } }, false],
    ['proportional stated explicitly', { feeSplit: 'proportional' }, true],
  ])('fast path and schema agree on %s', (_name, patch, canonical) => {
    const raw = { ...bill, bill: { ...bill.bill, ...patch } }
    expect(isCanonicalExpense(structuredClone(raw))).toBe(canonical)
    const out = parse(expenseSchema, raw)
    expect(out).not.toBeNull()
    if (canonical) expect(out).toEqual(raw)
  })
})

/* ------------------------------------------------------------------ groups & profile */

describe('group trip settings', () => {
  beforeEach(resetDataForTests)

  it('schema: missing → null, invalid → null, equal to the currency → null', () => {
    const g = { id: 'g', name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [], settlements: [], createdAt: 1, updatedAt: 1, archived: false }
    expect(parse(groupSchema, g)).toMatchObject({ travelCurrency: null, roundSize: null })
    expect(parse(groupSchema, { ...g, travelCurrency: 'THB', roundSize: 120000 })).toMatchObject({ travelCurrency: 'THB', roundSize: 120000 })
    expect(parse(groupSchema, { ...g, travelCurrency: 'INR', roundSize: 0 })).toMatchObject({ travelCurrency: null, roundSize: null })
    expect(parse(groupSchema, { ...g, travelCurrency: 'XXQ', roundSize: 1.5 })).toMatchObject({ travelCurrency: null, roundSize: null })
  })

  it('createGroup and updateGroup set, clear and validate them', () => {
    const g = createGroup({ name: 'Bangkok', emoji: '🛺', kind: 'trip', currency: 'INR', memberIds: [] })
    expect(g).toMatchObject({ travelCurrency: null, roundSize: null })
    expect(updateGroup(g.id, { travelCurrency: 'THB', roundSize: 150000 })).toMatchObject({ travelCurrency: 'THB', roundSize: 150000 })
    expect(updateGroup(g.id, { roundSize: -5 })).toMatchObject({ roundSize: 150000 })
    expect(updateGroup(g.id, { travelCurrency: 'INR' })).toMatchObject({ travelCurrency: null })
    expect(updateGroup(g.id, { travelCurrency: 'THB', roundSize: null })).toMatchObject({ travelCurrency: 'THB', roundSize: null })
    // Switching the group's own currency to the travel currency clears it.
    expect(updateGroup(g.id, { currency: 'THB' })).toMatchObject({ currency: 'THB', travelCurrency: null })
  })
})

describe('profile language', () => {
  beforeEach(resetDataForTests)

  it('defaults to automatic and repairs unknown codes', () => {
    expect(profileStore.get().language).toBeNull()
    expect(parse(profileSchema, { name: 'A', language: 'hi' })?.language).toBe('hi')
    expect(parse(profileSchema, { name: 'A', language: 'fr' })?.language).toBeNull()
    expect(parse(profileSchema, { name: 'A' })?.language).toBeNull()
  })

  it('updateProfile sets, clears and ignores bad values', () => {
    expect(updateProfile({ language: 'ta' }).language).toBe('ta')
    expect(updateProfile({ language: 'xx' as never }).language).toBe('ta')
    expect(updateProfile({ name: 'Ayush' }).language).toBe('ta')
    expect(updateProfile({ language: null }).language).toBeNull()
  })
})

/* ------------------------------------------------------------------ claims */

const round: ClaimRound = {
  id: 'r1abcdefgh',
  secret: 'AAAAAAAAAAAAAAAAAAAAAA',
  expenseId: 'b1',
  itemIds: ['i1', 'i2', 'i3'],
  itemsHash: 'e2738144e47b',
  peopleIds: [ME_ID, 'a', 'b'],
  fixedItemIds: ['i3'],
  ownPicks: [{ item: 0, num: 1, den: 2 }],
  replies: [
    {
      id: 'reply000000000aa',
      personIndex: 1,
      name: 'Riya',
      friendId: 'a',
      picks: [
        { item: 0, num: 1, den: 2 },
        { item: 1, num: 1, den: 1 },
      ],
      nothing: false,
      paid: 50000,
      sentAt: 100,
      receivedAt: 200,
      state: 'active',
    },
  ],
  decisions: { i1: { kind: 'as_claimed' }, i2: { kind: 'assign', shares: { a: 2, b: 1 } } },
  createdAt: 50,
  updatedAt: 300,
  appliedAt: null,
}

describe('claim rounds', () => {
  it('round-trips a valid round', () => {
    expect(parse(claimRoundSchema, round)).toEqual(round)
  })

  it('rejects rounds that cannot be verified or indexed', () => {
    expect(parse(claimRoundSchema, { ...round, secret: 'short' })).toBeNull()
    expect(parse(claimRoundSchema, { ...round, itemsHash: 'XYZ' })).toBeNull()
    expect(parse(claimRoundSchema, { ...round, itemIds: [] })).toBeNull()
    expect(parse(claimRoundSchema, { ...round, itemIds: ['i1', 'i1', 'i3'] })).toBeNull()
    expect(parse(claimRoundSchema, { ...round, peopleIds: [ME_ID, 7] })).toBeNull()
  })

  it('drops bad picks, replies and decisions one at a time', () => {
    const out = parse(claimRoundSchema, {
      ...round,
      fixedItemIds: ['i3', 'nope'],
      ownPicks: [
        { item: 0, num: 1, den: 2 },
        { item: 0, num: 1, den: 3 }, // second pick for the same item
        { item: 3, num: 1, den: 1 }, // no such item
        { item: 1, num: 3, den: 2 }, // more than the whole
        { item: 2, num: 1, den: 100 }, // den too big
        { item: 2, num: 0, den: 2 },
      ],
      replies: [
        ...round.replies,
        { ...round.replies[0], name: 'Dup' },
        { ...round.replies[0], id: 'other', personIndex: 9, name: '  ', paid: -1, state: 'weird' },
        { id: 'nofriend' },
      ],
      decisions: { i1: { kind: 'magic' }, i2: { kind: 'assign', shares: { a: 0, b: 1.5 } }, nope: { kind: 'scale_up' }, i3: { kind: 'rest_everyone' } },
      appliedAt: Number.NaN,
    })
    expect(out?.fixedItemIds).toEqual(['i3'])
    expect(out?.ownPicks).toEqual([{ item: 0, num: 1, den: 2 }])
    expect(out?.replies.map((r) => r.id)).toEqual(['reply000000000aa', 'other'])
    expect(out?.replies[1]).toMatchObject({ personIndex: null, name: 'Someone', paid: null, state: 'active' })
    expect(out?.decisions).toEqual({ i3: { kind: 'rest_everyone' } })
    expect(out?.appliedAt).toBeNull()
  })

  it('caps replies per round and rounds per store', () => {
    const replies = Array.from({ length: 120 }, (_, i) => ({ ...round.replies[0], id: `r${i}` }))
    expect(parse(claimRoundSchema, { ...round, replies })?.replies).toHaveLength(100)
    const rounds = Array.from({ length: 205 }, (_, i) => ({ ...round, id: `round${i}` }))
    expect(parse(claimRoundsSchema, rounds)).toHaveLength(200)
  })
})

/* ------------------------------------------------------------------ pools */

const pool: Pool = {
  id: 'p1',
  title: "Riya's farewell",
  occasion: 'farewell',
  emoji: '👋',
  currency: 'INR',
  mode: 'fixed',
  perPerson: 50000,
  target: null,
  memberIds: ['a', 'b'],
  expectedCount: null,
  deadline: '2026-10-30',
  note: 'A Kindle for Riya 🎁',
  showAmounts: true,
  contributions: [
    { id: 'c1', friendId: 'a', name: 'Sam', amount: 50000, date: '2026-10-22', method: 'upi', via: 'reply', replyId: 'rid1', createdAt: 5 },
    { id: 'c2', friendId: null, name: 'Priya from HR', amount: 30000, date: '2026-10-22', method: 'cash', via: 'tick', replyId: null, createdAt: 6 },
  ],
  secret: 'BBBBBBBBBBBBBBBBBBBBBB',
  createdAt: 1,
  updatedAt: 9,
  closedAt: null,
}

describe('pools', () => {
  it('round-trips a valid pool', () => {
    expect(parse(poolSchema, pool)).toEqual(pool)
  })

  it('turns a fixed pool without an amount into pay-what-you-want', () => {
    expect(parse(poolSchema, { ...pool, perPerson: 0, target: 9 })).toMatchObject({ mode: 'target', perPerson: null, target: 9 })
    expect(parse(poolSchema, { ...pool, mode: 'target', target: -1 })).toMatchObject({ mode: 'target', perPerson: null, target: null })
  })

  it('repairs fields to their documented ranges', () => {
    const out = parse(poolSchema, {
      ...pool,
      title: '   ',
      occasion: 'nope',
      emoji: '',
      currency: 'XYZ',
      memberIds: ['a', 'a', ME_ID, '', 7, 'b'],
      expectedCount: 1,
      deadline: '30 Oct',
      note: 'x'.repeat(200),
      showAmounts: 'yes',
      secret: 'bad',
      contributions: [...pool.contributions, { id: 'c3', name: '', amount: 0 }, { id: 'c4', friendId: ME_ID, name: ' Me ', amount: 100, via: 'tick', replyId: 'x', date: 'nope', createdAt: 0 }],
      closedAt: -5,
    })
    expect(out).toMatchObject({ title: 'Collection', occasion: 'other', emoji: '✨', memberIds: ['a', 'b'], expectedCount: null, deadline: null, closedAt: null, showAmounts: true })
    expect(out?.note).toHaveLength(140)
    expect(out?.currency).toMatch(/^[A-Z]{3}$/)
    expect(out?.secret).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(out?.contributions.map((c) => c.id)).toEqual(['c1', 'c2', 'c4'])
    expect(out?.contributions[2]).toMatchObject({ friendId: null, name: 'Me', replyId: null })
    expect(out?.contributions[2]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses the occasion for an empty title and emoji', () => {
    expect(parse(poolSchema, { ...pool, occasion: 'shagun', title: '', emoji: '' })).toMatchObject({ title: 'Wedding shagun', emoji: '💍' })
    expect(parse(poolSchema, { ...pool, mode: 'target', showAmounts: undefined })?.showAmounts).toBe(false)
  })

  it('caps the list', () => {
    expect(parse(poolsSchema, Array.from({ length: 210 }, (_, i) => ({ ...pool, id: `p${i}` })))).toHaveLength(200)
  })
})

/* ------------------------------------------------------------------ stores & backup */

describe('stores, clear-all and backup v4', () => {
  beforeEach(resetDataForTests)

  it('persists claims and pools under their v4 keys and clearAllData wipes them', () => {
    claimsStore.set([round])
    poolsStore.set([pool])
    flushAllStores()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.claims) ?? '{}')).toMatchObject({ v: 1, data: [round] })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.pools) ?? '{}')).toMatchObject({ v: 1, data: [pool] })
    clearAllData()
    expect(window.localStorage.getItem(STORAGE_KEYS.claims)).toBeNull()
    expect(claimsStore.get()).toEqual([])
    expect(poolsStore.get()).toEqual([])
  })

  it('exports version 4 with pools and claims, and round-trips', () => {
    poolsStore.set([pool])
    claimsStore.set([round])
    const file = exportBackup()
    expect(file).toMatchObject({ app: 'settle', version: 4, pools: [pool], claims: [round] })
    expect(parseBackup(JSON.parse(JSON.stringify(file)))).toEqual(file)
  })

  it('imports a version 3 file (no pools or claims) as a v4 one', () => {
    const v3 = { ...JSON.parse(JSON.stringify(exportBackup())), version: 3 }
    delete v3.pools
    delete v3.claims
    const parsed = parseBackup(v3)
    expect(parsed).toMatchObject({ version: 4, pools: [], claims: [] })
    poolsStore.set([pool])
    importBackup(parsed!, 'replace')
    expect(poolsStore.get()).toEqual([])
  })

  it('replace sets both lists and counts them', () => {
    poolsStore.set([pool])
    claimsStore.set([round])
    const file = exportBackup()
    clearAllData()
    const result = importBackup(file, 'replace')
    expect(result.added).toBe(2)
    expect(poolsStore.get()).toEqual([pool])
    expect(claimsStore.get()).toEqual([round])
  })

  it('merge: newer edits win, and contributions and replies from both copies are kept', () => {
    const localPool: Pool = { ...pool, title: 'Local title', updatedAt: 20, contributions: [pool.contributions[0]!] }
    const localRound: ClaimRound = { ...round, updatedAt: 400, replies: [] }
    poolsStore.set([localPool])
    claimsStore.set([localRound])
    const extraContribution = { ...pool.contributions[1]!, id: 'c9' }
    const file = {
      ...exportBackup(),
      pools: [{ ...pool, title: 'Older title', updatedAt: 10, contributions: [...pool.contributions, extraContribution] }, { ...pool, id: 'p2' }],
      claims: [{ ...round, updatedAt: 100 }],
    }
    const result = importBackup(file, 'merge')
    const merged = poolsStore.get().find((p) => p.id === 'p1')
    expect(merged?.title).toBe('Local title')
    expect(merged?.contributions.map((c) => c.id)).toEqual(['c1', 'c2', 'c9'])
    expect(poolsStore.get().map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(claimsStore.get()[0]?.replies.map((r) => r.id)).toEqual(['reply000000000aa'])
    expect(claimsStore.get()[0]?.updatedAt).toBe(400)
    expect(result.added).toBeGreaterThanOrEqual(1)
    expect(result.updated).toBeGreaterThanOrEqual(2)
  })

  it('merge: an identical copy changes nothing', () => {
    poolsStore.set([pool])
    claimsStore.set([round])
    const result = importBackup(exportBackup(), 'merge')
    expect(result).toEqual({ added: 0, updated: 0 })
    expect(poolsStore.get()).toEqual([pool])
  })

  it('merge maps people matched by name in pools and claims', () => {
    const riya = addFriend({ name: 'Riya' })
    const theirs = { ...riya, id: 'their-riya' }
    const file = {
      ...exportBackup(),
      friends: [...exportBackup().friends.filter((f) => f.id !== riya.id), theirs],
      pools: [{ ...pool, memberIds: ['their-riya'], contributions: [{ ...pool.contributions[0]!, friendId: 'their-riya' }] }],
      claims: [{ ...round, peopleIds: [ME_ID, 'their-riya'], replies: [{ ...round.replies[0]!, friendId: 'their-riya' }], decisions: { i2: { kind: 'assign' as const, shares: { 'their-riya': 1 } } } }],
    }
    importBackup(file, 'merge')
    expect(poolsStore.get()[0]?.memberIds).toEqual([riya.id])
    expect(poolsStore.get()[0]?.contributions[0]?.friendId).toBe(riya.id)
    expect(claimsStore.get()[0]?.peopleIds).toEqual([ME_ID, riya.id])
    expect(claimsStore.get()[0]?.replies[0]?.friendId).toBe(riya.id)
    expect(claimsStore.get()[0]?.decisions.i2).toEqual({ kind: 'assign', shares: { [riya.id]: 1 } })
  })
})
