import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import {
  addEntry,
  addFunction,
  addToEntry,
  deleteEntry,
  deleteFunction,
  MAX_SHAGUN_ENTRIES,
  restoreEntries,
  restoreFunction,
  setEntryAmount,
  shagunStore,
  updateEntry,
  updateFunction,
} from './store'

function stored(data: unknown): void {
  window.localStorage.setItem(STORAGE_KEYS.shagun, JSON.stringify({ v: 1, data }))
  shagunStore.reload()
}

const good = { id: 'e1', name: 'Sharma ji', direction: 'received', amount: 50_100, gift: null, functionId: null, date: '2024-02-12', note: null, at: 1 }

beforeEach(() => {
  resetDataForTests()
})

describe('shagun store', () => {
  it('starts empty', () => {
    expect(shagunStore.get()).toEqual({ functions: [], entries: [] })
  })

  it('keeps what it can read and drops junk, one record at a time', () => {
    stored({
      functions: [
        { id: 'f1', name: '  Our   wedding ', kind: 'nonsense', date: '2024-02-12', mine: true, at: 1 },
        { id: 'f2', name: '', kind: 'wedding', date: '2024-02-12', mine: true, at: 1 },
        { id: 'f3', name: 'Bad date', kind: 'wedding', date: '12/02/2024', mine: true, at: 1 },
        'junk',
      ],
      entries: [
        good,
        { ...good, id: 'e2', name: '  sharma   ji ', gift: '  ', note: 42 },
        { ...good, id: 'e3', amount: -5 },
        { ...good, id: 'e4', amount: 0, gift: null },
        { ...good, id: 'e5', amount: 0, gift: 'Silver coin' },
        { ...good, id: 'e6', direction: 'sideways' },
        { ...good, id: 'e7', name: '   ' },
        { ...good, id: 'e1', amount: 999 },
        null,
        7,
      ],
    })
    const state = shagunStore.get()
    expect(state.functions).toEqual([{ id: 'f1', name: 'Our wedding', kind: 'other', date: '2024-02-12', mine: true, at: 1 }])
    expect(state.entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e5'])
    expect(state.entries[1]).toMatchObject({ name: 'sharma ji', gift: null, note: null })
  })

  it('survives a whole store of junk', () => {
    stored({ functions: 'no', entries: { a: 1 } })
    expect(shagunStore.get()).toEqual({ functions: [], entries: [] })
    window.localStorage.setItem(STORAGE_KEYS.shagun, '{not json')
    shagunStore.reload()
    expect(shagunStore.get()).toEqual({ functions: [], entries: [] })
  })

  it('writes names in the spelling already in the book', () => {
    expect(addEntry({ name: 'Sharma ji', direction: 'received', amount: 50_100, date: '2024-02-12' })?.name).toBe('Sharma ji')
    expect(addEntry({ name: '  sharma   JI ', direction: 'given', amount: 20_100, date: '2025-02-12' })?.name).toBe('Sharma ji')
  })

  it('refuses envelopes with no name, no money and no gift, or a bad date', () => {
    expect(addEntry({ name: ' ', direction: 'received', amount: 100, date: '2024-02-12' })).toBeNull()
    expect(addEntry({ name: 'A', direction: 'received', amount: 0, date: '2024-02-12' })).toBeNull()
    expect(addEntry({ name: 'A', direction: 'received', amount: 1.5, date: '2024-02-12' })).toBeNull()
    expect(addEntry({ name: 'A', direction: 'received', amount: 100, date: 'today' })).toBeNull()
    expect(addEntry({ name: 'A', direction: 'received', amount: 0, gift: 'Saree', date: '2024-02-12' })).not.toBeNull()
  })

  it('caps the book at 10,000 envelopes', () => {
    const entries = Array.from({ length: MAX_SHAGUN_ENTRIES + 5 }, (_, i) => ({ ...good, id: `e${i}`, name: `Family ${i}` }))
    stored({ functions: [], entries })
    expect(shagunStore.get().entries).toHaveLength(MAX_SHAGUN_ENTRIES)
    expect(addEntry({ name: 'One more', direction: 'received', amount: 100, date: '2024-02-12' })).toBeNull()
  })

  it('changes, adds onto and deletes envelopes, with everything undoable', () => {
    const a = addEntry({ name: 'Rao', direction: 'received', amount: 50_100, date: '2024-02-12' })!
    expect(addToEntry(a.id, 50_100)).toBe(50_100)
    expect(shagunStore.get().entries[0]?.amount).toBe(100_200)
    setEntryAmount(a.id, 50_100)
    expect(shagunStore.get().entries[0]?.amount).toBe(50_100)
    expect(updateEntry(a.id, { name: 'Rao family', direction: 'received', amount: 110_100, date: '2024-02-13', note: 'Came late' })).toBe(true)
    expect(shagunStore.get().entries[0]).toMatchObject({ name: 'Rao family', amount: 110_100, note: 'Came late', at: a.at })
    const removed = deleteEntry(a.id)!
    expect(shagunStore.get().entries).toEqual([])
    restoreEntries([removed])
    restoreEntries([removed])
    expect(shagunStore.get().entries).toHaveLength(1)
  })

  it('deletes a function with its envelopes, and Undo brings both back', () => {
    const fn = addFunction({ name: 'Our wedding', kind: 'wedding', date: '2024-02-12', mine: true })!
    addEntry({ name: 'A', direction: 'received', amount: 100, functionId: fn.id, date: fn.date })
    addEntry({ name: 'B', direction: 'received', amount: 100, date: fn.date })
    expect(updateFunction(fn.id, { name: 'Our wedding, Feb 2024' })).toBe(true)
    expect(updateFunction(fn.id, { name: '  ' })).toBe(false)
    const removed = deleteFunction(fn.id)!
    expect(removed.entries).toHaveLength(1)
    expect(shagunStore.get()).toMatchObject({ functions: [], entries: [{ name: 'B' }] })
    restoreFunction(removed)
    expect(shagunStore.get().functions[0]?.name).toBe('Our wedding, Feb 2024')
    expect(shagunStore.get().entries).toHaveLength(2)
  })

  it('refuses a function without a name or a real date', () => {
    expect(addFunction({ name: ' ', kind: 'wedding', date: '2024-02-12', mine: true })).toBeNull()
    expect(addFunction({ name: 'X', kind: 'wedding', date: '2024-13-40', mine: true })).toBeNull()
  })
})
