import { describe, expect, it } from 'vitest'
import { findStuckTwin } from './duplicates'
import { stuckPayment } from './testKit'

const failed = stuckPayment({ id: 'f', ref: '630314567890', amount: 1_200_000, party: 'Riya Sharma', date: '2026-10-30' })
const refund = stuckPayment({ id: 'r', kind: 'refund', rail: null, ref: null, party: 'Amazon', merchant: 'amazon', amount: 129_900, orderId: '402-1234567-1234567', date: '2026-10-29' })

describe('findStuckTwin', () => {
  it('the same reference is surely the same money, however it’s typed', () => {
    expect(findStuckTwin([failed, refund], { kind: 'failed', amount: 1_200_000, ref: '6303 1456 7890' })).toEqual({ payment: failed, sure: true, by: 'ref' })
  })

  it('the same order number from the same business is the same refund', () => {
    const twin = findStuckTwin([failed, refund], { kind: 'refund', amount: 129_900, merchant: 'amazon', orderId: '#402-1234567-1234567' })
    expect(twin).toEqual({ payment: refund, sure: true, by: 'order' })
    // The same number from another business is someone else's order.
    expect(findStuckTwin([refund], { kind: 'refund', amount: 129_900, merchant: 'flipkart', orderId: '402-1234567-1234567', date: '2026-10-10' })).toBeNull()
  })

  it('reads a booking number with or without "PNR"', () => {
    const flight = stuckPayment({ id: 'i', kind: 'refund', rail: null, ref: null, merchant: 'indigo', party: 'IndiGo', orderId: 'X7K2LQ' })
    expect(findStuckTwin([flight], { kind: 'refund', merchant: 'indigo', orderId: 'PNR x7k2lq' })?.payment).toBe(flight)
  })

  it('two different UPI references are two payments, even for the same amount, party and day', () => {
    expect(findStuckTwin([failed], { kind: 'failed', amount: 1_200_000, party: 'Riya Sharma', date: '2026-10-30', ref: '630314567891' })).toBeNull()
  })

  it('the same amount to the same party a day apart, with no reference to go on, may be the same', () => {
    expect(findStuckTwin([failed], { kind: 'failed', amount: 1_200_000, party: 'riya', date: '2026-10-31' })).toEqual({ payment: failed, sure: false, by: 'details' })
    expect(findStuckTwin([failed], { kind: 'failed', amount: 1_200_000, party: 'Kabir', date: '2026-10-30' })).toBeNull()
    expect(findStuckTwin([failed], { kind: 'failed', amount: 1_200_000, party: 'Riya', date: '2026-10-27' })).toBeNull()
    expect(findStuckTwin([failed], { kind: 'refund', amount: 1_200_000, party: 'Riya', date: '2026-10-30' })).toBeNull()
  })

  it('one that came back is still found by its reference, but not by amount and day', () => {
    const back = { ...failed, back: { date: '2026-10-31', amount: 1_200_000, compensation: 0 } }
    expect(findStuckTwin([back], { ref: '630314567890' })).toEqual({ payment: back, sure: true, by: 'ref' })
    expect(findStuckTwin([back], { kind: 'failed', amount: 1_200_000, party: 'Riya', date: '2026-10-30' })).toBeNull()
  })

  it('an open one comes before one that came back', () => {
    const old = { ...failed, id: 'old', back: { date: '2026-10-31', amount: 1_200_000, compensation: 0 } }
    expect(findStuckTwin([old, failed], { ref: '630314567890' })?.payment).toBe(failed)
  })
})
