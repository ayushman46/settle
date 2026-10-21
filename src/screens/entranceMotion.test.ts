import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { countUp, motionAllowed, useEntranceProgress } from './entranceMotion'

function stubMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('countUp', () => {
  it('scales by progress and lands exactly on the value', () => {
    expect(countUp(229_900, 0)).toBe(0)
    expect(countUp(229_900, 0.5)).toBe(114_950)
    expect(countUp(1001, 0.5)).toBe(501)
    expect(countUp(229_900, 1)).toBe(229_900)
  })
})

describe('useEntranceProgress', () => {
  it('is complete at once when motion preferences are unknown or reduced', () => {
    expect(motionAllowed()).toBe(false) // jsdom has no matchMedia
    expect(renderHook(() => useEntranceProgress()).result.current).toBe(1)

    stubMotion(true)
    expect(motionAllowed()).toBe(false)
    expect(renderHook(() => useEntranceProgress()).result.current).toBe(1)
  })

  it('eases from 0 to 1 over the duration when motion is fine', () => {
    stubMotion(false)
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const { result } = renderHook(() => useEntranceProgress(400))
    expect(result.current).toBe(0)

    const run = (t: number) => act(() => frames.shift()?.(t))
    run(1000) // first frame sets the start time
    run(1200)
    expect(result.current).toBeGreaterThan(0.5)
    expect(result.current).toBeLessThan(1)
    run(1400)
    expect(result.current).toBe(1)
    expect(frames).toHaveLength(0)
  })
})
