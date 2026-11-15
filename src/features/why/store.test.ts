import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../../data/stores'
import { isDirectMode, setDirectMode, whyStore } from './store'

function reset(): void {
  localStorage.removeItem(STORAGE_KEYS.why)
  whyStore.reload()
}

beforeEach(reset)
afterEach(reset)

describe('why store', () => {
  it('is off until a group turns it on, and remembers each group on its own', () => {
    expect(isDirectMode('goa')).toBe(false)
    expect(isDirectMode(null)).toBe(false)
    setDirectMode('goa', true)
    expect(isDirectMode('goa')).toBe(true)
    expect(isDirectMode('flat')).toBe(false)
    setDirectMode('goa', false)
    expect(isDirectMode('goa')).toBe(false)
    expect(whyStore.get()).toEqual({ direct: {} })
  })

  it('ignores a group with no id, and setting what is already set', () => {
    setDirectMode('', true)
    expect(whyStore.get()).toEqual({ direct: {} })
    setDirectMode('goa', true)
    const before = whyStore.get()
    setDirectMode('goa', true)
    expect(whyStore.get()).toBe(before)
  })

  it('survives a reload', () => {
    setDirectMode('goa', true)
    whyStore.flush()
    whyStore.reload()
    expect(isDirectMode('goa')).toBe(true)
  })

  it('reads what it can of junk and drops the rest', () => {
    localStorage.setItem(STORAGE_KEYS.why, JSON.stringify({ v: 1, data: { direct: { goa: true, flat: 'yes', trip: 1, office: false, '': true, home: true }, extra: 7 } }))
    whyStore.reload()
    expect(whyStore.get()).toEqual({ direct: { goa: true, home: true } })
  })

  it('starts empty when what is stored is unreadable', () => {
    localStorage.setItem(STORAGE_KEYS.why, JSON.stringify({ v: 1, data: { direct: [true, true] } }))
    whyStore.reload()
    expect(whyStore.get()).toEqual({ direct: {} })
    localStorage.setItem(STORAGE_KEYS.why, 'not json')
    whyStore.reload()
    expect(whyStore.get()).toEqual({ direct: {} })
  })

  it('keeps the newest 300 groups', () => {
    for (let i = 0; i < 305; i++) setDirectMode(`g${i}`, true)
    const kept = Object.keys(whyStore.get().direct)
    expect(kept).toHaveLength(300)
    expect(isDirectMode('g0')).toBe(false)
    expect(isDirectMode('g4')).toBe(false)
    expect(isDirectMode('g5')).toBe(true)
    expect(isDirectMode('g304')).toBe(true)
  })
})
