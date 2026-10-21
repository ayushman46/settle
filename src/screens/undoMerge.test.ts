import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import type { Person, Session } from '../types'
import {
  CURRENCY_KEYS,
  ITEM_KEYS,
  restoreAssignments,
  restoreCurrency,
  restoreItem,
  restorePerson,
  sameShares,
} from './undoMerge'
import { AISHA, BEN, CHEN, sampleSession } from './screenTestKit'

const DEV: Person = { id: 'd', name: 'Dev', color: 3 }

function base(): Session {
  const session = sampleSession('people', { people: [AISHA, BEN, CHEN], payerId: 'b' })
  const [i0, i1, i2] = session.items
  if (!i0 || !i1 || !i2) throw new Error('sample items missing')
  return { ...session, assignments: { [i0.id]: { a: 1, b: 2 }, [i1.id]: { b: 1 }, [i2.id]: { c: 1 } } }
}

describe('restorePerson', () => {
  it('puts the person back in place with their shares and payer role', () => {
    const before = base()
    const after = reducer(before, { type: 'removePerson', personId: 'b' })
    const restored = restorePerson(after, before, 'b')
    expect(restored?.people).toEqual(before.people)
    expect(restored?.assignments).toEqual(before.assignments)
    expect(restored?.payerId).toBe('b')
  })

  it('merges with changes made since: new people stay, a newly chosen payer wins', () => {
    const before = base()
    let current = reducer(before, { type: 'removePerson', personId: 'a' })
    current = reducer(current, { type: 'addPerson', person: DEV })
    current = reducer(current, { type: 'setPayer', personId: 'd' })
    const item = before.items[1]
    if (!item) throw new Error('missing item')
    current = reducer(current, { type: 'togglePerson', itemId: item.id, personId: 'd' })

    const restored = restorePerson(current, before, 'a')
    expect(restored?.people.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(restored?.payerId).toBe('d')
    expect(restored?.assignments[item.id]).toEqual({ b: 1, d: 1 })
    expect(restored?.assignments[before.items[0]?.id ?? '']).toEqual({ b: 2, a: 1 })
  })

  it('goes back to the top when everyone before them is gone too', () => {
    const before = base()
    let current = reducer(before, { type: 'removePerson', personId: 'b' })
    current = reducer(current, { type: 'removePerson', personId: 'a' })
    expect(restorePerson(current, before, 'b')?.people.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('skips shares on items that were deleted meanwhile', () => {
    const before = base()
    const gone = before.items[0]?.id ?? ''
    let current = reducer(before, { type: 'removePerson', personId: 'b' })
    current = reducer(current, { type: 'removeItem', itemId: gone })
    const restored = restorePerson(current, before, 'b')
    expect(restored?.assignments[gone]).toBeUndefined()
    expect(restored?.assignments[before.items[1]?.id ?? '']).toEqual({ b: 1 })
  })

  it('refuses when it cannot be done cleanly', () => {
    const before = base()
    const after = reducer(before, { type: 'removePerson', personId: 'b' })
    // Another bill.
    expect(restorePerson({ ...after, id: 'other' }, before, 'b')).toBeNull()
    // Already back / never existed.
    expect(restorePerson(before, before, 'b')).toBeNull()
    expect(restorePerson(after, before, 'zz')).toBeNull()
    // Someone with the same name was added since.
    const twin = reducer(after, { type: 'addPerson', person: { id: 'b2', name: 'ben', color: 4 } })
    expect(restorePerson(twin, before, 'b')).toBeNull()
  })

  it('round-trips through the reducer’s restore action', () => {
    const before = base()
    const after = reducer(before, { type: 'removePerson', personId: 'c' })
    const merged = restorePerson(after, before, 'c')
    if (!merged) throw new Error('expected a merge')
    const restored = reducer(after, { type: 'restore', session: merged, keys: ['people', 'assignments', 'payerId'] })
    expect(restored.people).toEqual(before.people)
    expect(restored.assignments).toEqual(before.assignments)
  })
})

describe('restoreItem', () => {
  it('puts the item back in its old place with who had it', () => {
    const before = base()
    const target = before.items[1]
    if (!target) throw new Error('missing item')
    const after = reducer(before, { type: 'removeItem', itemId: target.id })
    const restored = restoreItem(after, before, target.id)
    expect(restored?.items.map((i) => i.id)).toEqual(before.items.map((i) => i.id))
    expect(restored?.assignments[target.id]).toEqual({ b: 1 })
  })

  it('keeps edits made since and lands after the nearest neighbour still there', () => {
    const before = base()
    const [i0, i1, i2] = before.items
    if (!i0 || !i1 || !i2) throw new Error('missing items')
    let current = reducer(before, { type: 'removeItem', itemId: i2.id })
    current = reducer(current, { type: 'removeItem', itemId: i1.id })
    current = reducer(current, { type: 'updateItem', item: { ...i0, name: 'Paneer Tikka (Half)' } })
    current = reducer(current, { type: 'removePerson', personId: 'c' })

    const restored = restoreItem(current, before, i2.id)
    expect(restored?.items.slice(0, 2).map((i) => i.id)).toEqual([i0.id, i2.id])
    expect(restored?.items[0]?.name).toBe('Paneer Tikka (Half)')
    // Chen left meanwhile, so the item comes back unassigned rather than with a ghost share.
    expect(restored?.assignments[i2.id]).toBeUndefined()
  })

  it('refuses when it cannot be done cleanly', () => {
    const before = base()
    const id = before.items[0]?.id ?? ''
    const after = reducer(before, { type: 'removeItem', itemId: id })
    expect(restoreItem({ ...after, id: 'other' }, before, id)).toBeNull()
    expect(restoreItem(before, before, id)).toBeNull()
    expect(restoreItem(after, before, 'nope')).toBeNull()
  })

  it('round-trips through the reducer’s restore action', () => {
    const before = base()
    const id = before.items[2]?.id ?? ''
    const after = reducer(before, { type: 'removeItem', itemId: id })
    const merged = restoreItem(after, before, id)
    if (!merged) throw new Error('expected a merge')
    const restored = reducer(after, { type: 'restore', session: merged, keys: ITEM_KEYS })
    expect(restored.items).toEqual(before.items)
    expect(restored.assignments).toEqual(before.assignments)
  })

  it('brings an item deleted before a currency switch back in the new currency', () => {
    const before = base()
    const paneer = before.items[0]
    if (!paneer) throw new Error('missing item')
    expect(paneer.amount).toBe(34500) // ₹345.00
    let current = reducer(before, { type: 'removeItem', itemId: paneer.id })
    current = reducer(current, { type: 'setCurrency', currency: 'JPY' })
    const restored = restoreItem(current, before, paneer.id)
    expect(restored?.currency).toBe('JPY')
    expect(restored?.items[0]).toEqual({ ...paneer, amount: 345 }) // ¥345, not ¥34,500
  })
})

describe('restoreCurrency', () => {
  /** ₹345.50 on the first line and ₹2,299.75 paid: amounts JPY has to round. */
  function paise(): Session {
    const session = base()
    const [first, ...rest] = session.items
    if (!first) throw new Error('missing item')
    return { ...session, paid: 229975, items: [{ ...first, amount: 34550 }, ...rest] }
  }

  it('undoes a rounding switch exactly (₹345.50 → ¥346 → ₹345.50, not ₹346.00)', () => {
    const before = paise()
    const switched = reducer(before, { type: 'setCurrency', currency: 'JPY' })
    expect(switched.items[0]?.amount).toBe(346)
    expect(switched.paid).toBe(2300)

    const merged = restoreCurrency(switched, before, 'JPY')
    if (!merged) throw new Error('expected an undo')
    const restored = reducer(switched, { type: 'restore', session: merged, keys: CURRENCY_KEYS })
    expect(restored.currency).toBe('INR')
    expect(restored.items[0]?.amount).toBe(34550)
    expect(restored.paid).toBe(229975)
    expect(restored.meta).toEqual(before.meta)
    expect(restored.items).toEqual(before.items)
  })

  it('keeps everything else made since (people, shares)', () => {
    const before = paise()
    let current = reducer(before, { type: 'setCurrency', currency: 'JPY' })
    current = reducer(current, { type: 'addPerson', person: DEV })
    expect(restoreCurrency(current, before, 'JPY')?.people).toEqual(current.people)
  })

  it('returns null once an amount, the bill or the currency changed since', () => {
    const before = paise()
    const switched = reducer(before, { type: 'setCurrency', currency: 'JPY' })
    const first = switched.items[0]
    if (!first) throw new Error('missing item')
    const edited = reducer(switched, { type: 'updateItem', item: { ...first, amount: 400 } })
    expect(restoreCurrency(edited, before, 'JPY')).toBeNull()
    expect(restoreCurrency(reducer(switched, { type: 'setPaid', paid: 2400 }), before, 'JPY')).toBeNull()
    expect(restoreCurrency(reducer(switched, { type: 'setCurrency', currency: 'USD' }), before, 'JPY')).toBeNull()
    expect(restoreCurrency({ ...switched, id: 'other' }, before, 'JPY')).toBeNull()
  })
})

describe('restoreAssignments', () => {
  it('undoes only the items still exactly as the bulk action left them', () => {
    const before = sampleSession('assign', { people: [AISHA, BEN] })
    const [i0, i1] = before.items
    if (!i0 || !i1) throw new Error('sample items missing')
    let current = reducer(before, { type: 'setEveryone', itemId: i0.id, on: true })
    current = reducer(current, { type: 'setEveryone', itemId: i1.id, on: true })
    current = reducer(current, { type: 'togglePerson', itemId: i1.id, personId: 'b' }) // edited since

    const expected = { [i0.id]: { a: 1, b: 1 }, [i1.id]: { a: 1, b: 1 } }
    const restored = restoreAssignments(current, before, expected)
    expect(restored?.assignments).toEqual({ [i1.id]: { a: 1 } })
  })

  it('returns null when there is nothing to undo or the bill changed', () => {
    const before = sampleSession('assign', { people: [AISHA] })
    expect(restoreAssignments(before, before, { x: { a: 1 } })).toBeNull()
    expect(restoreAssignments({ ...before, id: 'other' }, before, {})).toBeNull()
  })
})

describe('sameShares', () => {
  it('compares people and weights, ignoring order', () => {
    expect(sameShares({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(sameShares({ a: 1 }, { a: 2 })).toBe(false)
    expect(sameShares({ a: 1 }, { a: 1, b: 1 })).toBe(false)
    expect(sameShares(undefined, undefined)).toBe(true)
    expect(sameShares(undefined, {})).toBe(false)
  })
})
