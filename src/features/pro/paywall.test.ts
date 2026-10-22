import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closePaywall, completePaywall, openPaywall, paywallState, usePaywall, withPro } from './paywall'
import { installPro, resetProScreens } from './testing'

beforeEach(resetProScreens)
afterEach(() => {
  vi.unstubAllGlobals()
  resetProScreens()
})

describe('paywall store', () => {
  it('starts closed', () => {
    expect(paywallState()).toEqual({ open: false, request: null })
  })

  it('opens for a feature, and for Pro in general', () => {
    openPaywall('insights')
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'insights', onUnlock: null } })
    openPaywall()
    expect(paywallState().request?.feature).toBeNull()
  })

  it('gives every open its own id, so a re-open starts afresh', () => {
    openPaywall('export')
    const first = paywallState().request?.id
    openPaywall('export')
    expect(paywallState().request?.id).not.toBe(first)
  })

  it('keeps the request while closing, so the sheet can animate out', () => {
    openPaywall('themes')
    closePaywall()
    expect(paywallState()).toMatchObject({ open: false, request: { feature: 'themes' } })
  })

  it('does nothing when closing a closed paywall', () => {
    const before = paywallState()
    closePaywall()
    expect(paywallState()).toBe(before)
  })

  it('runs onUnlock once when Pro is unlocked from it — never on a plain close', () => {
    const onUnlock = vi.fn()
    openPaywall('recurring', { onUnlock })
    closePaywall()
    expect(onUnlock).not.toHaveBeenCalled()

    openPaywall('recurring', { onUnlock })
    completePaywall()
    expect(onUnlock).toHaveBeenCalledTimes(1)
    expect(paywallState().open).toBe(false)
    completePaywall()
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('withPro runs the action at once with Pro on', async () => {
    await installPro()
    const action = vi.fn()
    withPro('insights', action)
    expect(action).toHaveBeenCalledTimes(1)
    expect(paywallState().open).toBe(false)
  })

  it('withPro opens the paywall when locked and runs the action after unlocking', () => {
    const action = vi.fn()
    withPro('recurring', action)
    expect(action).not.toHaveBeenCalled()
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'recurring' } })
    completePaywall()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('usePaywall re-renders on open and close', () => {
    const { result } = renderHook(() => usePaywall())
    expect(result.current.open).toBe(false)
    act(() => openPaywall('clean_cards'))
    expect(result.current).toMatchObject({ open: true, request: { feature: 'clean_cards' } })
    act(() => closePaywall())
    expect(result.current.open).toBe(false)
  })
})
