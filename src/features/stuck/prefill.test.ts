import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StuckSignal } from './detect'

const detector = vi.hoisted(() => ({ draft: null as unknown }))
vi.mock('./detect', () => ({
  readStuckMessage: vi.fn(() => null),
  signalToDraft: vi.fn(() => detector.draft),
}))

import { resetNavForTests } from '../../app/router'
import { clearStuckPrefill, openStuckAdd, peekStuckPrefill, prefillFromProof, prefillFromSignal, setStuckPrefill, STUCK_PREFILL_KEY, takeStuckPrefill } from './prefill'

const base = { amount: 50_000, date: '2026-10-28', at: 0, ref: '430112345678', party: 'SWIGGY', merchant: 'swiggy', bank: 'hdfc', account: 'XX4821', app: null }

beforeEach(() => {
  detector.draft = null
  clearStuckPrefill()
  window.history.replaceState(null, '', '/app/stuck')
  resetNavForTests()
})

afterEach(() => {
  clearStuckPrefill()
})

describe('the hand-off into Add', () => {
  it('is taken once, survives a reload in sessionStorage, and drops what doesn’t fit', () => {
    setStuckPrefill({ kind: 'failed', amount: 50_000, date: 'not a day', party: 'Swiggy', source: 'sms' })
    expect(JSON.parse(window.sessionStorage.getItem(STUCK_PREFILL_KEY) ?? 'null')).toEqual({ kind: 'failed', amount: 50_000, party: 'Swiggy', source: 'sms' })
    expect(peekStuckPrefill()).toEqual({ kind: 'failed', amount: 50_000, party: 'Swiggy', source: 'sms' })
    expect(takeStuckPrefill()).toEqual({ kind: 'failed', amount: 50_000, party: 'Swiggy', source: 'sms' })
    expect(peekStuckPrefill()).toBeNull()
    expect(window.sessionStorage.getItem(STUCK_PREFILL_KEY)).toBeNull()
  })

  it('reads a copy left in sessionStorage (after a reload)', () => {
    window.sessionStorage.setItem(STUCK_PREFILL_KEY, JSON.stringify({ kind: 'refund', merchant: 'amazon', amount: -5 }))
    expect(takeStuckPrefill()).toEqual({ kind: 'refund', merchant: 'amazon' })
  })

  it('opens Add', () => {
    openStuckAdd({ kind: 'refund' })
    expect(window.location.pathname).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toEqual({ kind: 'refund' })
  })
})

describe('from a message', () => {
  it('uses the detector’s draft when it makes one', () => {
    detector.draft = { kind: 'failed', amount: 50_000, source: 'sms', confirmed: true }
    const signal: StuckSignal = { ...base, type: 'failed', vpa: null, rail: 'upi_merchant', debited: true }
    expect(prefillFromSignal(signal, 'sms')).toEqual(detector.draft)
  })

  it('otherwise fills in what the message said; a pending one isn’t known to have taken the money', () => {
    const failed: StuckSignal = { ...base, type: 'pending', vpa: null, rail: 'upi_merchant', debited: false }
    expect(prefillFromSignal(failed, 'sms')).toMatchObject({ kind: 'failed', amount: 50_000, rail: 'upi_merchant', party: 'SWIGGY', merchant: 'swiggy', confirmed: false, source: 'sms' })
    const refund: StuckSignal = { ...base, type: 'refund_initiated', orderId: 'OD123', promisedBy: '2026-11-05' }
    expect(prefillFromSignal(refund, 'sms')).toMatchObject({ kind: 'refund', orderId: 'OD123', promisedBy: '2026-11-05', confirmed: true })
  })

  it('money coming back is not a new stuck payment', () => {
    expect(prefillFromSignal({ ...base, type: 'reversal' }, 'sms')).toBeNull()
    expect(prefillFromSignal({ ...base, type: 'refund_credited' }, 'sms')).toBeNull()
    expect(prefillFromSignal({ ...base, type: 'debit' }, 'sms')).toBeNull()
  })
})

describe('from a payment screenshot', () => {
  it('takes the amount in paise, who it was to, the reference, the day and the app — and asks if it left', () => {
    const proof = { app: 'phonepe' as const, status: 'failed' as const, amount: 1250.5, currency: 'INR', payerName: 'Ayush', payeeName: 'Riya Sharma', payeeUpi: 'riya@okaxis', utr: '512345678901', date: '2026-10-30', time: '19:02' }
    expect(prefillFromProof(proof)).toEqual({
      kind: 'failed',
      amount: 125_050,
      party: 'Riya Sharma',
      ref: '512345678901',
      date: '2026-10-30',
      app: 'phonepe',
      rail: null,
      source: 'screenshot',
      confirmed: false,
    })
    expect(prefillFromProof({ ...proof, amount: 20, currency: 'USD', payeeName: null, app: 'unknown' })).toMatchObject({ amount: undefined, party: 'riya@okaxis', app: null })
  })
})
