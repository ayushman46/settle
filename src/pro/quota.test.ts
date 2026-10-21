import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FREE_AI_PER_DAY } from '../domain/types'
import { AI_USAGE_KEY, aiUsedToday, consumeAiQuota, localDay, quotaFor, resetQuotaForTests, useAiQuota } from './quota'
import { createTestSigner, installLicense, resetProModulesForTests } from './testKit'

beforeEach(() => {
  resetQuotaForTests()
  resetProModulesForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetQuotaForTests()
  resetProModulesForTests()
})

describe('localDay', () => {
  it('is the local calendar date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDay(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('quotaFor', () => {
  it('counts down the free allowance and never goes negative', () => {
    expect(quotaFor(0, false)).toEqual({ used: 0, limit: FREE_AI_PER_DAY, remaining: FREE_AI_PER_DAY, canUse: true })
    expect(quotaFor(FREE_AI_PER_DAY - 1, false)).toMatchObject({ remaining: 1, canUse: true })
    expect(quotaFor(FREE_AI_PER_DAY, false)).toMatchObject({ remaining: 0, canUse: false })
    expect(quotaFor(FREE_AI_PER_DAY + 5, false)).toMatchObject({ remaining: 0, canUse: false })
  })

  it('is unlimited with Pro', () => {
    expect(quotaFor(500, true)).toEqual({ used: 500, limit: Infinity, remaining: Infinity, canUse: true })
  })
})

describe('useAiQuota', () => {
  it(`allows ${FREE_AI_PER_DAY} a day for free users`, () => {
    const { result } = renderHook(() => useAiQuota())
    expect(result.current).toMatchObject({ used: 0, limit: 3, remaining: 3, canUse: true })
    act(() => result.current.consume())
    expect(result.current).toMatchObject({ used: 1, remaining: 2, canUse: true })
    act(() => {
      result.current.consume()
      result.current.consume()
    })
    expect(result.current).toMatchObject({ used: 3, remaining: 0, canUse: false })
    expect(JSON.parse(window.localStorage.getItem(AI_USAGE_KEY) ?? '{}')).toEqual({ day: localDay(), used: 3 })
  })

  it('keeps a stable object between unrelated renders', () => {
    const { result, rerender } = renderHook(() => useAiQuota())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('remembers today’s count across visits, not yesterday’s', () => {
    window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: localDay(), used: 2 }))
    expect(aiUsedToday()).toBe(2)
    resetQuotaForTests()
    window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: '2001-01-01', used: 2 }))
    expect(aiUsedToday()).toBe(0)
  })

  it.each([
    ['broken JSON', '{'],
    ['a negative count', JSON.stringify({ day: 'TODAY', used: -4 })],
    ['a fractional count', JSON.stringify({ day: 'TODAY', used: 1.5 })],
    ['a text count', JSON.stringify({ day: 'TODAY', used: '2' })],
  ])('reads %s as nothing used', (_label, raw) => {
    window.localStorage.setItem(AI_USAGE_KEY, raw.replace('TODAY', localDay()))
    expect(aiUsedToday()).toBe(0)
  })

  it('caps an absurd stored count', () => {
    window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: localDay(), used: 1e9 }))
    expect(aiUsedToday()).toBe(10_000)
  })

  it('resets at local midnight with the app open', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 21, 23, 59, 0), toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const { result } = renderHook(() => useAiQuota())
    act(() => {
      result.current.consume()
      result.current.consume()
      result.current.consume()
    })
    expect(result.current.canUse).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000)
    })
    expect(result.current).toMatchObject({ used: 0, remaining: 3, canUse: true })
  })

  it('catches up after the phone slept past midnight', () => {
    const { result } = renderHook(() => useAiQuota())
    act(() => result.current.consume())
    expect(result.current.used).toBe(1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    vi.spyOn(Date, 'now').mockReturnValue(tomorrow.getTime())
    vi.useFakeTimers({ now: tomorrow, toFake: ['Date'] })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.used).toBe(0)
  })

  it('counts uses from another tab', () => {
    const { result } = renderHook(() => useAiQuota())
    act(() => {
      window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: localDay(), used: 2 }))
      window.dispatchEvent(new StorageEvent('storage', { key: AI_USAGE_KEY }))
    })
    expect(result.current.remaining).toBe(1)
    act(() => result.current.consume())
    expect(result.current.used).toBe(3)
  })

  it('never loses a use when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const { result } = renderHook(() => useAiQuota())
    act(() => result.current.consume())
    act(() => result.current.consume())
    expect(result.current.used).toBe(2)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(result.current.used).toBe(2)
  })

  it('is unlimited with Pro', async () => {
    const signer = await createTestSigner()
    installLicense(await signer.token(), signer.publicKey)
    window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ day: localDay(), used: 12 }))
    const { result } = renderHook(() => useAiQuota())
    expect(result.current).toMatchObject({ used: 12, limit: Infinity, remaining: Infinity, canUse: true })
  })

  it('can be counted from outside React', () => {
    const { result } = renderHook(() => useAiQuota())
    act(() => consumeAiQuota())
    expect(result.current.used).toBe(1)
    expect(aiUsedToday()).toBe(1)
  })
})
