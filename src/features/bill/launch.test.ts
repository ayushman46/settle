import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetNavForTests } from '../../app/router'
import { SESSION_KEY } from '../../state/persist'
import { getPhoto, setPhoto } from '../../state/photo'
import { createSession } from '../../state/reducer'
import {
  billDraftSummary,
  BILL_PATH,
  clearBillDraft,
  openBill,
  resetBillLaunchForTests,
  takeBillStart,
  useBillDraft,
} from './launch'
import { sampleSession } from './screenTestKit'

beforeEach(() => {
  resetNavForTests()
  resetBillLaunchForTests()
  window.history.replaceState(null, '', '/app')
})

afterEach(() => {
  resetNavForTests()
  setPhoto(null)
  vi.useRealTimers()
})

describe('openBill / takeBillStart', () => {
  it('opens the flow and hands it what to start, once', () => {
    openBill({ kind: 'sample' })
    expect(window.location.pathname).toBe(BILL_PATH)
    expect(takeBillStart()).toEqual({ kind: 'sample' })
    vi.useFakeTimers()
    vi.advanceTimersByTime(1500)
    expect(takeBillStart()).toBeNull()
  })

  it('gives the same answer to a second read straight after (StrictMode renders twice)', () => {
    openBill({ kind: 'edit', expenseId: 'e1' })
    expect(takeBillStart()).toEqual({ kind: 'edit', expenseId: 'e1' })
    expect(takeBillStart()).toEqual({ kind: 'edit', expenseId: 'e1' })
  })

  it('plain openBill() starts nothing', () => {
    openBill({ kind: 'sample' })
    openBill()
    expect(takeBillStart()).toBeNull()
  })
})

describe('the bill in progress', () => {
  it('sums up the saved draft for a "Continue your bill" card', () => {
    expect(billDraftSummary()).toBeNull()
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(createSession('INR')))
    expect(billDraftSummary()).toBeNull()

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sampleSession('people', { paid: 250000 })))
    expect(billDraftSummary()).toEqual({
      title: 'Saffron Table',
      items: 8,
      total: 250000,
      currency: 'INR',
      people: 0,
      step: 'people',
      editing: false,
    })
    const { result } = renderHook(() => useBillDraft())
    expect(result.current?.title).toBe('Saffron Table')
  })

  it('says when the draft is a saved bill being changed', () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sampleSession('result', { expenseId: 'e1' })))
    expect(billDraftSummary()?.editing).toBe(true)
  })

  it('clearBillDraft forgets it, its photo and any pending start', () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sampleSession('people')))
    setPhoto({ previewUrl: 'data:image/png;base64,AAAA' })
    openBill({ kind: 'sample' })
    clearBillDraft()
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(getPhoto()).toBeNull()
    expect(takeBillStart()).toBeNull()
    expect(billDraftSummary()).toBeNull()
  })
})
