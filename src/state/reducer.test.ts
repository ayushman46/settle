import { describe, expect, it } from 'vitest'
import { EMPTY_META, type BillItem, type Person, type Session } from '../types'
import { createSession, MAX_ITEMS, MAX_WEIGHT, reducer, repairSession, sanitizeItem, type Action } from './reducer'

const item = (id: string, amount: number, name = id.toUpperCase(), quantity = 1): BillItem => ({ id, name, quantity, amount })
const person = (id: string, name = id.toUpperCase(), color = 0): Person => ({ id, name, color })

function base(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    id: 'sess',
    step: 'review',
    source: 'manual',
    items: [item('x', 1000), item('y', 2000), item('z', 3000)],
    people: [person('a', 'Aisha', 0), person('b', 'Ben', 1), person('c', 'Cara', 2)],
    ...overrides,
  }
}

function run(state: Session, ...actions: Action[]): Session {
  return actions.reduce(reducer, state)
}

describe('createSession', () => {
  it('starts fresh at scan', () => {
    const s = createSession('USD')
    expect(s).toMatchObject({
      v: 1,
      step: 'scan',
      source: null,
      currency: 'USD',
      meta: EMPTY_META,
      warnings: [],
      items: [],
      paid: null,
      people: [],
      assignments: {},
      assignCursor: 0,
      payerId: null,
    })
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(createSession('nope').currency).toMatch(/^[A-Z]{3}$/)
    expect(s.meta).not.toBe(EMPTY_META)
  })
})

describe('reducer', () => {
  it('never mutates and returns the same object for no-ops', () => {
    const s = Object.freeze(base({ assignments: Object.freeze({ x: Object.freeze({ a: 1 }) }) }))
    const noops: Action[] = [
      { type: 'goTo', step: 'review' },
      { type: 'setCurrency', currency: 'INR' },
      { type: 'setCurrency', currency: 'ZZZ' },
      { type: 'updateItem', item: item('ghost', 1) },
      { type: 'updateItem', item: item('x', 1000, 'X') },
      { type: 'removeItem', itemId: 'ghost' },
      { type: 'dismissWarnings' },
      { type: 'setPaid', paid: null },
      { type: 'addPerson', person: person('a') },
      { type: 'addPerson', person: person('new', '   ') },
      { type: 'renamePerson', personId: 'a', name: ' Aisha ' },
      { type: 'renamePerson', personId: 'ghost', name: 'X' },
      { type: 'renamePerson', personId: 'a', name: '  ' },
      { type: 'removePerson', personId: 'ghost' },
      { type: 'togglePerson', itemId: 'ghost', personId: 'a' },
      { type: 'togglePerson', itemId: 'x', personId: 'ghost' },
      { type: 'setShares', itemId: 'x', shares: { a: 1 } },
      { type: 'setShares', itemId: 'ghost', shares: { a: 1 } },
      { type: 'setEveryone', itemId: 'y', on: false },
      { type: 'setAssignCursor', index: 0 },
      { type: 'setPayer', personId: null },
      { type: 'setPayer', personId: 'ghost' },
      { type: 'setMerchant', merchant: '  ' },
      { type: 'restore', session: { ...base(), id: 'other' } },
      { type: 'addItem', item: item('x', 5) },
    ]
    for (const action of noops) expect(reducer(s, action), action.type).toBe(s)
  })

  it('reset starts a fresh session, keeping the currency unless given', () => {
    const s = base({ currency: 'USD', step: 'result' })
    const fresh = reducer(s, { type: 'reset' })
    expect(fresh.step).toBe('scan')
    expect(fresh.currency).toBe('USD')
    expect(fresh.items).toEqual([])
    expect(fresh.people).toEqual([])
    expect(fresh.id).not.toBe(s.id)
    expect(reducer(s, { type: 'reset', currency: 'EUR' }).currency).toBe('EUR')
  })

  it('goTo changes the step', () => {
    expect(reducer(base(), { type: 'goTo', step: 'paid' }).step).toBe('paid')
  })

  it('loadBill replaces the bill, keeps people, clears the rest and opens review', () => {
    const s = base({ step: 'scan', paid: 500, assignments: { x: { a: 1 } }, assignCursor: 2, payerId: 'a', warnings: ['old'] })
    const next = reducer(s, {
      type: 'loadBill',
      source: 'scan',
      currency: 'USD',
      meta: { ...EMPTY_META, merchant: 'Diner', total: 1500 },
      items: [item('n1', 1000, '  Burger  '), item('n1', 9), item('n2', 500)],
      warnings: ['Check the items', '  '],
    })
    expect(next).toMatchObject({
      step: 'review',
      source: 'scan',
      currency: 'USD',
      paid: null,
      assignments: {},
      assignCursor: 0,
      payerId: null,
      warnings: ['Check the items'],
    })
    expect(next.meta.merchant).toBe('Diner')
    expect(next.items.map((i) => [i.id, i.name])).toEqual([
      ['n1', 'Burger'],
      ['n2', 'N2'],
    ])
    expect(next.people).toBe(s.people)
    expect(next.id).not.toBe(s.id)
  })

  it('loadBill keeps the current currency when given an unknown one and caps items', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => item(`i${i}`, 1))
    const next = reducer(base({ currency: 'GBP' }), {
      type: 'loadBill',
      source: 'manual',
      currency: 'nope',
      meta: EMPTY_META,
      items: many,
      warnings: [],
    })
    expect(next.currency).toBe('GBP')
    expect(next.items).toHaveLength(MAX_ITEMS)
  })

  it('setCurrency rescales every amount', () => {
    const s = base({
      currency: 'USD',
      items: [item('x', 1234), item('y', 1250)],
      paid: 2499,
      meta: { ...EMPTY_META, total: 2499, tax: 50, discount: null },
    })
    const jpy = reducer(s, { type: 'setCurrency', currency: 'JPY' })
    expect(jpy.currency).toBe('JPY')
    expect(jpy.items.map((i) => i.amount)).toEqual([12, 13])
    expect(jpy.paid).toBe(25)
    expect(jpy.meta).toMatchObject({ total: 25, tax: 1, discount: null })
    const back = reducer(jpy, { type: 'setCurrency', currency: 'USD' })
    expect(back.items.map((i) => i.amount)).toEqual([1200, 1300])
    const inr = reducer(s, { type: 'setCurrency', currency: 'INR' })
    expect(inr.items).toEqual(s.items.map((i) => ({ ...i })))
  })

  it('setMerchant tidies and clears', () => {
    const s = reducer(base(), { type: 'setMerchant', merchant: '  The   Diner ' })
    expect(s.meta.merchant).toBe('The Diner')
    expect(reducer(s, { type: 'setMerchant', merchant: '' }).meta.merchant).toBeNull()
  })

  it('addItem / updateItem sanitise', () => {
    const added = reducer(base(), { type: 'addItem', item: { id: 'n', name: '  Tea ', quantity: -2, amount: 12.6 } })
    expect(added.items.at(-1)).toEqual({ id: 'n', name: 'Tea', quantity: 1, amount: 13 })
    const updated = reducer(added, { type: 'updateItem', item: { id: 'n', name: 'Chai', quantity: 2, amount: -5 } })
    expect(updated.items.at(-1)).toEqual({ id: 'n', name: 'Chai', quantity: 2, amount: 0 })
    expect(updated.items.slice(0, 3)).toEqual(added.items.slice(0, 3))
  })

  it('removeItem drops its assignment and clamps the cursor', () => {
    const s = base({ assignments: { z: { a: 1 }, x: { b: 1 } }, assignCursor: 2 })
    const next = reducer(s, { type: 'removeItem', itemId: 'z' })
    expect(next.items.map((i) => i.id)).toEqual(['x', 'y'])
    expect(next.assignments).toEqual({ x: { b: 1 } })
    expect(next.assignCursor).toBe(1)
    const empty = run(next, { type: 'removeItem', itemId: 'x' }, { type: 'removeItem', itemId: 'y' })
    expect(empty.assignCursor).toBe(0)
  })

  it('dismissWarnings', () => {
    expect(reducer(base({ warnings: ['a'] }), { type: 'dismissWarnings' }).warnings).toEqual([])
  })

  it('setPaid clamps to whole non-negative amounts', () => {
    expect(reducer(base(), { type: 'setPaid', paid: 1234.4 }).paid).toBe(1234)
    expect(reducer(base(), { type: 'setPaid', paid: -5 }).paid).toBe(0)
    expect(reducer(base({ paid: 5 }), { type: 'setPaid', paid: null }).paid).toBeNull()
  })

  it('addPerson normalises, colours and caps at 20', () => {
    const s = base({ people: [] })
    const one = reducer(s, { type: 'addPerson', person: { id: 'p1', name: '  Dev   Patel ', color: 99 } })
    expect(one.people).toEqual([{ id: 'p1', name: 'Dev Patel', color: 0 }])
    const two = reducer(one, { type: 'addPerson', person: { id: 'p2', name: 'Eve', color: 5 } })
    expect(two.people[1]?.color).toBe(5)
    let full = s
    for (let i = 0; i < 25; i++) full = reducer(full, { type: 'addPerson', person: person(`p${i}`) })
    expect(full.people).toHaveLength(20)
  })

  it('renamePerson', () => {
    const s = reducer(base(), { type: 'renamePerson', personId: 'b', name: '  Benji ' })
    expect(s.people[1]).toEqual({ id: 'b', name: 'Benji', color: 1 })
  })

  it('removePerson strips them everywhere and clears the payer', () => {
    const s = base({ assignments: { x: { a: 1, b: 2 }, y: { b: 1 }, z: { c: 1 } }, payerId: 'b' })
    const next = reducer(s, { type: 'removePerson', personId: 'b' })
    expect(next.people.map((p) => p.id)).toEqual(['a', 'c'])
    expect(next.assignments).toEqual({ x: { a: 1 }, z: { c: 1 } })
    expect(next.assignments.z).toBe(s.assignments.z)
    expect(next.payerId).toBeNull()
    expect(reducer(base({ payerId: 'a' }), { type: 'removePerson', personId: 'b' }).payerId).toBe('a')
  })

  it('togglePerson adds with weight 1, removes, and keeps people order', () => {
    const s1 = reducer(base(), { type: 'togglePerson', itemId: 'x', personId: 'c' })
    const s2 = reducer(s1, { type: 'togglePerson', itemId: 'x', personId: 'a' })
    expect(s2.assignments.x).toEqual({ a: 1, c: 1 })
    expect(Object.keys(s2.assignments.x ?? {})).toEqual(['a', 'c'])
    const s3 = run(s2, { type: 'togglePerson', itemId: 'x', personId: 'a' }, { type: 'togglePerson', itemId: 'x', personId: 'c' })
    expect(s3.assignments).toEqual({})
  })

  it('togglePerson keeps other weights', () => {
    const s = base({ assignments: { x: { a: 3 } } })
    expect(reducer(s, { type: 'togglePerson', itemId: 'x', personId: 'b' }).assignments.x).toEqual({ a: 3, b: 1 })
  })

  it('setShares sanitises weights and deletes empty shares', () => {
    const s = reducer(base(), { type: 'setShares', itemId: 'x', shares: { c: 2.9, a: 1, ghost: 4, b: 0, z: 500 } })
    expect(s.assignments.x).toEqual({ a: 1, c: 2 })
    expect(reducer(base(), { type: 'setShares', itemId: 'x', shares: { a: 500 } }).assignments.x).toEqual({ a: MAX_WEIGHT })
    expect(reducer(s, { type: 'setShares', itemId: 'x', shares: {} }).assignments).toEqual({})
  })

  it('setEveryone selects all (keeping weights) or clears', () => {
    const s = base({ assignments: { x: { b: 3 } } })
    const on = reducer(s, { type: 'setEveryone', itemId: 'x', on: true })
    expect(on.assignments.x).toEqual({ a: 1, b: 3, c: 1 })
    expect(reducer(on, { type: 'setEveryone', itemId: 'x', on: true })).toBe(on)
    expect(reducer(on, { type: 'setEveryone', itemId: 'x', on: false }).assignments).toEqual({})
  })

  it('setAssignCursor clamps', () => {
    expect(reducer(base(), { type: 'setAssignCursor', index: 9 }).assignCursor).toBe(2)
    expect(reducer(base({ assignCursor: 2 }), { type: 'setAssignCursor', index: -3 }).assignCursor).toBe(0)
    expect(reducer(base(), { type: 'setAssignCursor', index: 1.7 }).assignCursor).toBe(1)
    expect(reducer(base({ assignCursor: 1 }), { type: 'setAssignCursor', index: Number.NaN }).assignCursor).toBe(0)
  })

  it('setPayer picks a known person or clears', () => {
    const s = reducer(base(), { type: 'setPayer', personId: 'b' })
    expect(s.payerId).toBe('b')
    expect(reducer(s, { type: 'setPayer', personId: null }).payerId).toBeNull()
  })

  it('restore brings back a snapshot without navigating', () => {
    const before = base({ assignments: { x: { b: 1 } }, payerId: 'b' })
    const removed = reducer(before, { type: 'removePerson', personId: 'b' })
    const moved = reducer(removed, { type: 'goTo', step: 'assign' })
    const undone = reducer(moved, { type: 'restore', session: before })
    expect(undone.people).toBe(before.people)
    expect(undone.assignments).toEqual(before.assignments)
    expect(undone.payerId).toBe('b')
    expect(undone.step).toBe('assign')
  })

  it('restore can be limited to some fields and repairs consistency', () => {
    const before = base()
    const s1 = run(before, { type: 'removeItem', itemId: 'x' }, { type: 'setPaid', paid: 777 })
    const undone = reducer(s1, { type: 'restore', session: before, keys: ['items', 'assignments'] })
    expect(undone.items).toBe(before.items)
    expect(undone.paid).toBe(777)
    // Restoring people only: assignments for people who are still missing are dropped.
    const s2 = run(before, { type: 'togglePerson', itemId: 'x', personId: 'c' })
    const withoutC = { ...s2, people: s2.people.filter((p) => p.id !== 'c') }
    const repaired = reducer(withoutC, { type: 'restore', session: { ...withoutC, payerId: 'c' }, keys: ['payerId'] })
    expect(repaired.payerId).toBeNull()
  })
})

describe('sanitizeItem', () => {
  it('cleans fields', () => {
    expect(sanitizeItem({ id: 'i', name: ' a  b ', quantity: Number.NaN, amount: Number.POSITIVE_INFINITY })).toEqual({
      id: 'i',
      name: 'a b',
      quantity: 1,
      amount: 0,
    })
    expect(sanitizeItem({ id: 'i', name: 'x'.repeat(100), quantity: 0.5, amount: 1e15 }).amount).toBe(1e12)
  })
})

describe('repairSession', () => {
  it('drops dangling assignments, payer and clamps the cursor', () => {
    const s = base({ assignments: { x: { a: 1, ghost: 1 }, gone: { a: 1 }, y: { ghost: 2 } }, payerId: 'ghost', assignCursor: 10 })
    const repaired = repairSession(s)
    expect(repaired.assignments).toEqual({ x: { a: 1 } })
    expect(repaired.payerId).toBeNull()
    expect(repaired.assignCursor).toBe(2)
  })

  it('returns the same object when consistent', () => {
    const s = base({ assignments: { x: { a: 1, b: 2 } }, payerId: 'a', assignCursor: 1 })
    expect(repairSession(s)).toBe(s)
  })
})
