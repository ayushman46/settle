import { describe, expect, it } from 'vitest'
import { ME_ID } from '../domain/types'
import { FRIENDS, makeExpense } from '../share/testing'
import { upiPaymentForShare, upiPaymentForTransfer } from './upiPayment'

describe('upiPaymentForShare', () => {
  it('has a friend pay me their share when I paid', () => {
    expect(upiPaymentForShare(makeExpense(), 'sam', FRIENDS)).toEqual({
      payee: { id: ME_ID, name: 'You', upiId: null, color: 2 },
      payer: { id: 'sam', name: 'Sam', color: 1 },
      amount: 69_150,
      currency: 'INR',
      note: 'Dinner at Toit',
    })
  })

  it('has me pay whoever paid, with their UPI ID', () => {
    const payment = upiPaymentForShare(makeExpense({ payerId: 'riya', paidBack: {} }), ME_ID, FRIENDS)
    expect(payment?.payee).toEqual({ id: 'riya', name: 'Riya', upiId: 'riya@okicici', color: 5 })
    expect(payment?.payer).toEqual({ id: ME_ID, name: 'You', color: 2 })
  })

  it('has nothing for the payer, or for a share of nothing', () => {
    expect(upiPaymentForShare(makeExpense(), ME_ID, FRIENDS)).toBeNull()
    expect(upiPaymentForShare(makeExpense({ shares: { [ME_ID]: 276_600, sam: 0 } }), 'sam', FRIENDS)).toBeNull()
    expect(upiPaymentForShare(makeExpense(), 'stranger', FRIENDS)).toBeNull()
  })

  it('names someone who was removed', () => {
    const payment = upiPaymentForShare(makeExpense({ payerId: 'gone', shares: { gone: 1_000, sam: 1_000 } }), 'sam', FRIENDS)
    expect(payment?.payee).toEqual({ id: 'gone', name: 'Someone', upiId: null, color: 0 })
  })
})

describe('upiPaymentForTransfer', () => {
  it('turns a settle-up payment into a UPI payment, noted with the group', () => {
    expect(upiPaymentForTransfer({ fromId: ME_ID, toId: 'riya', amount: 54_000 }, 'INR', FRIENDS, 'Goa 2026')).toEqual({
      payee: { id: 'riya', name: 'Riya', upiId: 'riya@okicici', color: 5 },
      payer: { id: ME_ID, name: 'You', color: 2 },
      amount: 54_000,
      currency: 'INR',
      note: 'Goa 2026',
    })
    expect(upiPaymentForTransfer({ fromId: 'sam', toId: ME_ID, amount: 100 }, 'USD', FRIENDS).note).toBeNull()
  })
})
