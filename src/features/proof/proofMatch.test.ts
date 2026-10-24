import { describe, expect, it } from 'vitest'
import type { ProofResponse } from '../../../shared/api'
import { AMOUNT_TOLERANCE, matchProof, namesMatch, toPaise, type LedgerEntry, type Owed } from './proofMatch'

const ME = { name: 'Ayush Mehta', upiId: 'ayush.m@okaxis' }
const RIYA: Owed = { friendId: 'f-riya', name: 'Riya Sharma', amount: 42000 }
const SAM: Owed = { friendId: 'f-sam', name: 'Sam Dsouza', amount: 12500 }
const ASHA: Owed = { friendId: 'f-asha', name: 'Asha', amount: 42000 }

function reading(overrides: Partial<ProofResponse> = {}): Omit<ProofResponse, 'model'> {
  return {
    app: 'gpay',
    status: 'success',
    amount: 420,
    currency: 'INR',
    payerName: 'Riya Sharma',
    payeeName: 'Ayush Mehta',
    payeeUpi: 'ayush.m@okaxis',
    utr: '431287654321',
    date: '2026-10-23',
    time: '18:42',
    ...overrides,
  }
}

const input = (owed: Owed[] = [RIYA, SAM], ledger: LedgerEntry[] = []) => ({ owed, me: ME, ledger })

describe('namesMatch', () => {
  it('matches a first name to a full name, and the same first name with a short surname', () => {
    expect(namesMatch('Riya', 'Riya Sharma')).toBe(true)
    expect(namesMatch('Sam D', 'Sam Dsouza')).toBe(true)
    expect(namesMatch('RIYA SHARMA', 'riya sharma')).toBe(true)
  })

  it('does not match different people', () => {
    expect(namesMatch('Riya Kapoor', 'Sam Dsouza')).toBe(false)
    expect(namesMatch('Ri', 'Riya Sharma')).toBe(false)
    expect(namesMatch('', 'Riya')).toBe(false)
  })

  it('compares names in Hindi and other scripts too', () => {
    expect(namesMatch('रिया शर्मा', 'रिया')).toBe(true)
  })
})

describe('toPaise', () => {
  it('turns rupees into paise without float drift', () => {
    expect(toPaise(420)).toBe(42000)
    expect(toPaise(1250.5)).toBe(125050)
    expect(toPaise(0.1 + 0.2)).toBe(30)
  })
})

describe('matchProof: what is refused', () => {
  it('says a pending payment is pending, and does not match it', () => {
    expect(matchProof(reading({ status: 'pending' }), input())).toEqual({ kind: 'pending' })
  })

  it('says a failed payment failed, even when the amount and person fit', () => {
    expect(matchProof(reading({ status: 'failed' }), input())).toEqual({ kind: 'failed' })
  })

  it('does not guess when the status cannot be read', () => {
    expect(matchProof(reading({ status: 'unknown' }), input())).toEqual({ kind: 'unreadable' })
  })

  it('refuses money that went to someone else, naming the receiver it shows', () => {
    expect(matchProof(reading({ payeeName: 'Dhaba Ka Khana', payeeUpi: 'dhaba@ybl' }), input())).toEqual({
      kind: 'wrong_payee',
      payeeName: 'Dhaba Ka Khana',
      payeeUpi: 'dhaba@ybl',
    })
  })

  it('accepts the receiver by UPI ID or by name, and never by the amount alone', () => {
    expect(matchProof(reading({ payeeName: null, payeeUpi: 'ayush.m@okaxis' }), input()).kind).toBe('match')
    expect(matchProof(reading({ payeeName: 'Ayush Mehta', payeeUpi: null }), input()).kind).toBe('match')
    expect(matchProof(reading({ payeeName: null, payeeUpi: null }), input())).toEqual({ kind: 'payee_unknown' })
  })

  it('refuses a reference that is already recorded, and names whom it settled', () => {
    const ledger: LedgerEntry[] = [{ utr: '431287654321', friendId: 'f-riya', amount: 42000, at: 1 }]
    expect(matchProof(reading(), input([RIYA], ledger))).toEqual({ kind: 'duplicate', utr: '431287654321', friendId: 'f-riya' })
  })
})

describe('matchProof: finding who owes the money', () => {
  it('matches the one person who owes exactly that amount and whose name fits', () => {
    expect(matchProof(reading(), input())).toEqual({ kind: 'match', friendId: 'f-riya', name: 'Riya Sharma', amount: 42000, utr: '431287654321' })
  })

  it('accepts an amount within ₹1 of what is owed', () => {
    const near = reading({ amount: 419.4 })
    expect(Math.abs(toPaise(419.4) - RIYA.amount)).toBeLessThanOrEqual(AMOUNT_TOLERANCE)
    expect(matchProof(near, input())).toMatchObject({ kind: 'match', friendId: 'f-riya' })
    expect(matchProof(reading({ amount: 417.99 }), input())).toMatchObject({ kind: 'no_match' })
  })

  it('matches on the amount alone when the screenshot shows no payer name', () => {
    expect(matchProof(reading({ payerName: null }), input())).toMatchObject({ kind: 'match', friendId: 'f-riya' })
  })

  it('lets the person pick when the amount fits nobody', () => {
    expect(matchProof(reading({ amount: 999 }), input())).toEqual({
      kind: 'no_match',
      amount: 99900,
      payerName: 'Riya Sharma',
      candidates: [RIYA, SAM],
    })
  })

  it('lets the person pick when two people owe the same amount and the name does not decide it', () => {
    const result = matchProof(reading({ payerName: 'Someone Else' }), input([RIYA, ASHA]))
    expect(result).toMatchObject({ kind: 'no_match', amount: 42000, candidates: [RIYA, ASHA] })
  })

  it('uses the name to choose between two people who owe the same amount', () => {
    expect(matchProof(reading({ payerName: 'Asha' }), input([RIYA, ASHA]))).toMatchObject({ kind: 'match', friendId: 'f-asha' })
  })

  it('does not match a payment in another currency', () => {
    expect(matchProof(reading({ currency: 'USD' }), input())).toMatchObject({ kind: 'no_match', amount: null })
  })

  it('with no amount on the screen, lets the person pick from everyone who owes', () => {
    expect(matchProof(reading({ amount: null }), input())).toEqual({ kind: 'no_match', amount: null, payerName: 'Riya Sharma', candidates: [RIYA, SAM] })
  })
})
