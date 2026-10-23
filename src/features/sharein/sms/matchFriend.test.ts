/** Who an SMS paid (or came from) among your people, and whether it settles exactly what's open. */
import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, resetDataForTests, saveExpense, updateFriend } from '../../../data'
import { draft, everyone } from '../../../data/testKit'
import { ME_ID, type Friend } from '../../../domain/types'
import { matchFriend, settleOffer, type FriendMatch } from './matchFriend'
import type { SmsTxn } from './parseSms'

const ME: Friend = { id: ME_ID, name: 'Ayush', color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0 }
const person = (id: string, name: string, upiId: string | null = null): Friend => ({ id, name, color: 1, upiId, phone: null, createdAt: 0, lastUsedAt: 0 })

function sms(extra: Partial<SmsTxn>): SmsTxn {
  return {
    kind: 'txn',
    dir: 'debit',
    amount: 184_000,
    name: null,
    vpa: null,
    date: '2026-10-22',
    ref: null,
    account: null,
    bank: null,
    app: null,
    via: 'upi',
    refund: false,
    ...extra,
  }
}

describe('matchFriend', () => {
  const people = [ME, person('riya', 'Riya', 'Riya.S@OkAxis'), person('sam', 'Sam Kapoor'), person('kabir', 'Kabir')]

  it('a VPA equal to a friend’s UPI ID wins (normalized)', () => {
    expect(matchFriend(sms({ vpa: 'riya.s@okaxis', name: 'Sam Kapoor' }), people, ME_ID)).toEqual({ friendId: 'riya', by: 'vpa' })
  })

  it('the whole name, any case', () => {
    expect(matchFriend(sms({ name: 'SAM KAPOOR' }), people, ME_ID)).toEqual({ friendId: 'sam', by: 'name' })
  })

  it('a unique first name: "RIYA SHARMA" → the one Riya', () => {
    expect(matchFriend(sms({ name: 'Riya Sharma' }), people, ME_ID)).toEqual({ friendId: 'riya', by: 'name' })
    expect(matchFriend(sms({ name: 'Kabir Mehta' }), people, ME_ID)).toEqual({ friendId: 'kabir', by: 'name' })
  })

  it('a bank-shortened surname still matches; a different one does not', () => {
    const list = [ME, person('rs', 'Riya Sharma')]
    expect(matchFriend(sms({ name: 'Riya Sha' }), list, ME_ID)).toEqual({ friendId: 'rs', by: 'name' })
    expect(matchFriend(sms({ name: 'Riya Kapoor' }), list, ME_ID)).toBeNull()
  })

  it('two people who could be meant → no match', () => {
    const twoRiyas = [ME, person('r1', 'Riya'), person('r2', 'Riya Malhotra')]
    expect(matchFriend(sms({ name: 'Riya Sharma' }), twoRiyas, ME_ID)).toBeNull()
    expect(matchFriend(sms({ name: 'RIYA' }), [ME, person('r1', 'Riya'), person('r2', 'riya')], ME_ID)).toBeNull()
    expect(matchFriend(sms({ vpa: 'x@ybl' }), [ME, person('a', 'A', 'x@ybl'), person('b', 'B', 'x@ybl')], ME_ID)).toBeNull()
  })

  it('never yourself; nothing without a name or VPA; a merchant is nobody', () => {
    expect(matchFriend(sms({ name: 'Ayush' }), [ME], ME_ID)).toBeNull()
    expect(matchFriend(sms({}), people, ME_ID)).toBeNull()
    expect(matchFriend(sms({ name: 'Swiggy', vpa: 'swiggy@icici' }), people, ME_ID)).toBeNull()
  })
})

describe('settleOffer', () => {
  let riya: string
  let sam: string
  const offer = (t: SmsTxn, friendId: string) =>
    settleOffer(t, { friendId, by: 'name' } satisfies FriendMatch, expensesStore.get(), groupsStore.get(), ME_ID)

  beforeEach(() => {
    resetDataForTests()
    riya = addFriend({ name: 'Riya' }).id
    sam = addFriend({ name: 'Sam' }).id
  })

  it('a debit that pays off exactly what I owe them: all', () => {
    saveExpense(draft({ title: 'Toit Brewpub', total: 368_000, payerId: riya, participants: everyone(ME_ID, riya) })) // I owe 1,840
    const got = offer(sms({ amount: 184_000 }), riya)
    expect(got).toMatchObject({ kind: 'all', friendId: riya, amount: 184_000 })
    expect(got?.kind === 'all' && got.sources).toEqual([expect.objectContaining({ kind: 'splits', currency: 'INR', amount: -184_000 })])
  })

  it('one open split when the whole balance differs: one', () => {
    saveExpense(draft({ title: 'Toit Brewpub', total: 368_000, date: '2026-10-18', payerId: riya, participants: everyone(ME_ID, riya) })) // I owe 1,840
    saveExpense(draft({ title: 'Cab', total: 60_000, date: '2026-10-20', payerId: riya, participants: everyone(ME_ID, riya) })) // I owe 300
    const got = offer(sms({ amount: 184_000 }), riya)
    expect(got).toMatchObject({ kind: 'one', title: 'Toit Brewpub', amount: 184_000, mark: { debtorId: ME_ID } })
  })

  it('off by one paisa → nothing (never guess)', () => {
    saveExpense(draft({ total: 368_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    expect(offer(sms({ amount: 183_999 }), riya)).toBeNull()
    expect(offer(sms({ amount: 184_001 }), riya)).toBeNull()
  })

  it('a debit when they owe me → nothing; a credit from them → all', () => {
    saveExpense(draft({ title: 'Cab', total: 120_000, with: [sam] })) // Sam owes me 600
    expect(offer(sms({ amount: 60_000 }), sam)).toBeNull()
    expect(offer(sms({ dir: 'credit', amount: 60_000 }), sam)).toMatchObject({ kind: 'all', friendId: sam, amount: 60_000 })
  })

  it('a credit matching one of their open splits: one', () => {
    saveExpense(draft({ title: 'Cab', total: 120_000, date: '2026-10-20', with: [sam] })) // Sam owes 600
    saveExpense(draft({ title: 'Lunch', total: 90_000, date: '2026-10-21', with: [sam] })) // Sam owes 450
    expect(offer(sms({ dir: 'credit', amount: 60_000 }), sam)).toMatchObject({ kind: 'one', title: 'Cab', mark: { debtorId: sam } })
    expect(offer(sms({ dir: 'credit', amount: 105_000 }), sam)).toMatchObject({ kind: 'all' })
  })

  it('refunds never settle', () => {
    saveExpense(draft({ total: 120_000, with: [sam] }))
    expect(offer(sms({ dir: 'credit', amount: 60_000, refund: true }), sam)).toBeNull()
  })

  it('group balances count, through friendBalance', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
    saveExpense(draft({ total: 90_000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya, sam) })) // I owe Riya 300 in Goa
    const got = offer(sms({ amount: 30_000 }), riya)
    expect(got).toMatchObject({ kind: 'all', amount: 30_000 })
    expect(got?.kind === 'all' && got.sources).toEqual([expect.objectContaining({ kind: 'group', amount: -30_000 })])
  })

  it('only rupees: a dollar balance is left out', () => {
    saveExpense(draft({ currency: 'USD', total: 2_000, payerId: riya, participants: everyone(ME_ID, riya) })) // I owe $10
    expect(offer(sms({ amount: 1_000 }), riya)).toBeNull()
    updateFriend(riya, { name: 'Riya S' })
    expect(offer(sms({ amount: 1_000 }), riya)).toBeNull()
  })
})
