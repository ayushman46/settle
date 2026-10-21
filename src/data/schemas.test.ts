import { describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { ME_ID } from '../domain/types'
import {
  cleanEmoji,
  cleanMultiline,
  cleanPhone,
  cleanText,
  cleanUpiId,
  expenseSchema,
  expensesSchema,
  friendsSchema,
  groupSchema,
  profileSchema,
  recurringSchema,
  settledShares,
} from './schemas'

const parse = <T,>(schema: z.core.$ZodType<T>, value: unknown) => z.safeParse(schema, value)

const goodExpense = {
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

describe('cleaners', () => {
  it('tidy text, notes, UPI IDs, phones and emoji', () => {
    expect(cleanText('  a \n\t b  ', 10)).toBe('a b')
    expect(cleanText('👩‍💻👩‍💻👩‍💻', 2)).toBe('👩‍💻👩‍💻')
    expect(cleanText('x\u0000y​z', 10)).toBe('xyz')
    expect(cleanMultiline(' one \r\n\r\n\r\n two  \n three ', 100)).toBe('one\n\ntwo\nthree')
    expect(cleanUpiId(' Riya@OkAxis ')).toBe('riya@okaxis')
    expect(cleanUpiId('riya')).toBeNull()
    expect(cleanUpiId(undefined)).toBeNull()
    expect(cleanPhone('+91 98765 43210')).toBe('+919876543210')
    expect(cleanPhone('(022) 2345-6789')).toBe('02223456789')
    expect(cleanPhone('123')).toBeNull()
    expect(cleanPhone('1234567890123456')).toBeNull()
    expect(cleanEmoji('🏖️ beach')).toBe('🏖️')
    expect(cleanEmoji('   ')).toBe('👥')
    expect(cleanEmoji(null)).toBe('👥')
  })
})

describe('profileSchema', () => {
  it('fills every bad field with its default', () => {
    const r = parse(profileSchema, { name: 7, upiId: 'nope', currency: 'zzz', theme: 'neon', accent: 'gold', haptics: 'yes', onboarded: 1 })
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ name: '', upiId: null, theme: 'system', accent: 'lime', haptics: true, onboarded: false })
    expect(r.data?.currency).toMatch(/^[A-Z]{3}$/)
    expect(r.data?.createdAt).toBeGreaterThan(0)
    expect(parse(profileSchema, 'me').success).toBe(false)
  })
})

describe('friendsSchema', () => {
  it('repairs friends, drops unusable ones and duplicates, and always has ME first', () => {
    const r = parse(friendsSchema, [
      { id: 'a', name: '  Riya ', color: 42, upiId: 'RIYA@okaxis', phone: '98765 43210', createdAt: -5, lastUsedAt: 'x' },
      { id: 'b', name: '   ' },
      { id: 'a', name: 'Duplicate' },
      { id: ME_ID, name: 'Ayush', color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 },
      'junk',
    ])
    expect(r.data).toEqual([
      { id: ME_ID, name: 'Ayush', color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 },
      { id: 'a', name: 'Riya', color: 2, upiId: 'riya@okaxis', phone: '9876543210', createdAt: 0, lastUsedAt: 0 },
    ])
    expect(parse(friendsSchema, [])).toMatchObject({ success: true, data: [{ id: ME_ID, name: 'Me' }] })
  })
})

describe('expenseSchema', () => {
  it('accepts a good expense unchanged', () => {
    expect(parse(expenseSchema, goodExpense).data).toEqual(goodExpense)
  })

  it('recomputes shares that do not add up, falling back to equal when inputs are broken too', () => {
    expect(parse(expenseSchema, { ...goodExpense, shares: { [ME_ID]: 1, a: 1 } }).data?.shares).toEqual({ [ME_ID]: 500, a: 500 })
    const broken = parse(expenseSchema, { ...goodExpense, mode: 'exact', participants: [{ friendId: ME_ID, input: 1 }, { friendId: 'a', input: 1 }], shares: {} })
    expect(broken.data).toMatchObject({ mode: 'equal', shares: { [ME_ID]: 500, a: 500 } })
  })

  it('repairs soft fields', () => {
    const r = parse(expenseSchema, {
      ...goodExpense,
      title: ' ',
      category: 'crypto',
      date: 'yesterday',
      updatedAt: 1,
      note: ' a\n\n\n\nb ',
      source: 'telepathy',
      mode: 'items',
      bill: 'not a bill',
      paidBack: { a: 1, [ME_ID]: 2, ghost: 3 },
    })
    expect(r.data).toMatchObject({ title: 'Expense', category: 'other', note: 'a\n\nb', source: 'manual', mode: 'equal', kind: 'split', updatedAt: 10, paidBack: { a: 1 } })
    expect(r.data?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('rejects expenses that cannot be trusted', () => {
    expect(parse(expenseSchema, { ...goodExpense, total: 0 }).success).toBe(false)
    expect(parse(expenseSchema, { ...goodExpense, total: 10.5 }).success).toBe(false)
    expect(parse(expenseSchema, { ...goodExpense, participants: [] }).success).toBe(false)
    expect(parse(expenseSchema, { ...goodExpense, currency: 'rupees' }).success).toBe(false)
    expect(parse(expenseSchema, { ...goodExpense, payerId: '' }).success).toBe(false)
  })

  it('lists drop bad expenses one at a time', () => {
    const r = parse(expensesSchema, [goodExpense, { ...goodExpense, id: 'e2', total: -1 }, { ...goodExpense, id: 'e3' }, goodExpense])
    expect(r.data?.map((e) => e.id)).toEqual(['e1', 'e3'])
    expect(parse(expensesSchema, 'nope').success).toBe(false)
  })

  it('settledShares always adds up', () => {
    const s = settledShares({ total: 1000, currency: 'INR', mode: 'percent', participants: [{ friendId: 'a', input: 10 }], payerId: 'a', roundedToWhole: false, bill: null })
    expect(s).toEqual({ shares: { a: 1000 }, mode: 'equal' })
  })
})

describe('groupSchema & recurringSchema', () => {
  it('repairs groups and their payments', () => {
    const r = parse(groupSchema, {
      id: 'g',
      name: '',
      emoji: '',
      kind: 'spaceship',
      currency: 'INR',
      memberIds: ['a', 'a', '', 7],
      settlements: [
        { id: 's1', fromId: 'a', toId: ME_ID, amount: 100, date: 'x', createdAt: 5, method: 'upi' },
        { id: 's2', fromId: 'a', toId: 'a', amount: 100 },
        { id: 's3', fromId: 'a', toId: ME_ID, amount: -1 },
      ],
      createdAt: 5,
      updatedAt: 1,
      archived: 'no',
    })
    expect(r.data).toMatchObject({ name: 'Group', emoji: '👥', kind: 'other', memberIds: [ME_ID], archived: false, updatedAt: 5 })
    expect(r.data?.settlements.map((s) => s.id)).toEqual(['s1'])
  })

  it('repairs recurring templates', () => {
    const r = parse(recurringSchema, {
      id: 'r',
      title: '',
      category: 'rent',
      currency: 'INR',
      total: 1000,
      payerId: ME_ID,
      mode: 'equal',
      participants: [{ friendId: ME_ID, input: null }],
      dayOfMonth: 31,
      lastCreatedPeriod: '2026-13',
    })
    expect(r.data).toMatchObject({ title: 'Rent', dayOfMonth: 28, lastCreatedPeriod: null, active: true, groupId: null })
    expect(parse(recurringSchema, { ...r.data, mode: 'items' }).success).toBe(false)
  })
})
