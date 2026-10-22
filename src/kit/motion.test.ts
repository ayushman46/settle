import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COUNT_UP_MS, motionAllowed, useCountUp } from './motion'
import { allowMotion } from './testMotion'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('motionAllowed', () => {
  it('stays still when the browser cannot say (no matchMedia)', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(motionAllowed()).toBe(false)
  })

  it('respects prefers-reduced-motion', () => {
    allowMotion()
    expect(motionAllowed()).toBe(true)
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }))
    expect(motionAllowed()).toBe(false)
  })

  it('never throws', () => {
    vi.stubGlobal('matchMedia', () => {
      throw new Error('blocked')
    })
    expect(motionAllowed()).toBe(false)
  })
})

describe('useCountUp', () => {
  it('is exactly the target without motion', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v), { initialProps: { v: 12_345 } })
    expect(result.current).toBe(12_345)
    rerender({ v: 99 })
    expect(result.current).toBe(99)
  })

  it('counts up from zero on mount, easing out, and lands exactly', () => {
    const frames = allowMotion()
    const { result } = renderHook(() => useCountUp(100_050))
    expect(result.current).toBe(0)
    act(() => frames.flush(0))
    act(() => frames.flush(COUNT_UP_MS / 2))
    const half = result.current
    // Ease-out: more than half-way at half time.
    expect(half).toBeGreaterThan(50_025)
    expect(half).toBeLessThan(100_050)
    act(() => frames.flush(COUNT_UP_MS))
    expect(result.current).toBe(100_050)
  })

  it('shows in-between values in whole steps, the final one exact', () => {
    const frames = allowMotion()
    const seen: number[] = []
    const { result } = renderHook(() => {
      const v = useCountUp(123_456, { step: 100 })
      seen.push(v)
      return v
    })
    act(() => frames.flush(0))
    for (let i = 0; i < 6; i++) act(() => frames.flush(COUNT_UP_MS / 6))
    expect(result.current).toBe(123_456)
    expect(seen.slice(0, -1).every((v) => v % 100 === 0)).toBe(true)
  })

  it('skips the intro when asked, then glides between later values', () => {
    const frames = allowMotion()
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { intro: false }), { initialProps: { v: 1_000 } })
    expect(result.current).toBe(1_000)
    rerender({ v: 2_000 })
    expect(result.current).toBe(1_000)
    act(() => frames.flush(0))
    act(() => frames.flush(COUNT_UP_MS / 4))
    expect(result.current).toBeGreaterThan(1_000)
    expect(result.current).toBeLessThan(2_000)
    // Retargeting mid-way continues from where it is.
    const midway = result.current
    rerender({ v: 0 })
    act(() => frames.flush(0))
    act(() => frames.flush(1))
    expect(result.current).toBeLessThanOrEqual(midway)
    act(() => frames.flush(COUNT_UP_MS))
    expect(result.current).toBe(0)
  })
})
