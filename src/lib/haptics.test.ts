import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptic, HAPTIC_PATTERNS, resetHapticsForTests } from './haptics'

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  )
}

beforeEach(() => {
  resetHapticsForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'vibrate')
})

describe('haptic', () => {
  it('vibrates with the pattern for each kind', () => {
    mockReducedMotion(false)
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    haptic('tap')
    haptic('select')
    haptic('success')
    haptic('warning')
    haptic('error')
    expect(vibrate.mock.calls).toEqual([[8], [12], [[12, 60, 24]], [[20, 40, 20]], [[40, 60, 40]]])
    expect(HAPTIC_PATTERNS.success).toEqual([12, 60, 24])
  })

  it('stays silent under reduced motion', () => {
    mockReducedMotion(true)
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    haptic('success')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('is a no-op without the Vibration API and never throws', () => {
    mockReducedMotion(false)
    expect(() => haptic('tap')).not.toThrow()
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('no gesture')
      },
      configurable: true,
    })
    expect(() => haptic('error')).not.toThrow()
  })
})
