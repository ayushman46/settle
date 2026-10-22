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

describe('v4 hand-offs: banners and SMS/voice sources', () => {
  it('carries a valid banner and the sms / voice sources', () => {
    const banner = { icon: 'message' as const, title: 'Filled in from your SMS', body: "Add who's in, check it, then save." }
    setSplitPrefill({ ...prefill, source: 'sms', banner })
    expect(takeSplitPrefill()).toEqual({ ...prefill, source: 'sms', banner })
    setSplitPrefill({ title: 'Chai', source: 'voice', banner: { icon: 'mic', title: 'Filled in from what you said', body: '' } })
    expect(peekSplitPrefill()).toMatchObject({ source: 'voice', banner: { icon: 'mic' } })
  })

  it('drops the whole hand-off when its banner is malformed (too long, unknown icon)', () => {
    for (const banner of [
      { icon: 'message', title: 'x'.repeat(81), body: '' },
      { icon: 'message', title: 'Fine', body: 'x'.repeat(161) },
      { icon: 'rocket', title: 'Fine', body: '' },
      { icon: 'message', title: '', body: '' },
    ]) {
      setSplitPrefill({ title: 'Cab', banner } as unknown as SplitPrefill)
      expect(peekSplitPrefill(), JSON.stringify(banner)).toBeNull()
    }
    // At the limits it's kept.
    setSplitPrefill({ title: 'Cab', banner: { icon: 'wallet', title: 'x'.repeat(80), body: 'y'.repeat(160) } })
    expect(peekSplitPrefill()?.banner?.title).toHaveLength(80)
  })
})
