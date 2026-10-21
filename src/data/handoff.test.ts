import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../domain/types'
import { clearSplitPrefill, HANDOFF_KEY, peekSplitPrefill, setSplitPrefill, takeSplitPrefill, type SplitPrefill } from './handoff'

const prefill: SplitPrefill = {
  title: 'Cab',
  category: 'transport',
  total: 84000,
  currency: 'INR',
  date: '2026-10-21',
  payerId: ME_ID,
  mode: 'shares',
  participants: [
    { friendId: ME_ID, input: 1 },
    { friendId: 'sam', input: 2 },
  ],
  groupId: null,
  note: null,
  source: 'describe',
  recurringId: null,
}

beforeEach(() => {
  clearSplitPrefill()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('split prefill hand-off', () => {
  it('hands a prefill over exactly once', () => {
    vi.useFakeTimers()
    setSplitPrefill(prefill)
    expect(peekSplitPrefill()).toEqual(prefill)
    expect(takeSplitPrefill()).toEqual(prefill)
    expect(window.sessionStorage.getItem(HANDOFF_KEY)).toBeNull()
    vi.advanceTimersByTime(1500)
    expect(takeSplitPrefill()).toBeNull()
  })

  it('returns the same value to an immediate second take (StrictMode double render)', () => {
    vi.useFakeTimers()
    setSplitPrefill({ title: 'Rent' })
    const first = takeSplitPrefill()
    expect(takeSplitPrefill()).toBe(first)
    vi.advanceTimersByTime(1000)
    expect(takeSplitPrefill()).toBeNull()
  })

  it('survives a reload between hand-off and pick-up', async () => {
    setSplitPrefill(prefill)
    vi.resetModules()
    const fresh = await import('./handoff')
    expect(fresh.takeSplitPrefill()).toEqual(prefill)
    expect(fresh.takeSplitPrefill()).toEqual(prefill)
  })

  it('drops unknown or ill-typed fields', () => {
    setSplitPrefill({ ...prefill, total: 12.5, extra: 'x' } as SplitPrefill)
    expect(peekSplitPrefill()).toBeNull()
    setSplitPrefill({ title: 'Ok', extra: 'x' } as SplitPrefill)
    expect(takeSplitPrefill()).toEqual({ title: 'Ok' })
  })

  it('ignores corrupt session data and clears on request', () => {
    window.sessionStorage.setItem(HANDOFF_KEY, '{nope')
    expect(takeSplitPrefill()).toBeNull()
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ mode: 'items' }))
    expect(peekSplitPrefill()).toBeNull()
    setSplitPrefill({ title: 'Later' })
    clearSplitPrefill()
    expect(takeSplitPrefill()).toBeNull()
  })

  it('still works in memory when sessionStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setSplitPrefill({ title: 'Memory' })
    expect(takeSplitPrefill()).toEqual({ title: 'Memory' })
  })
})
