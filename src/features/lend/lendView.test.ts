import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, friendsStore, groupsStore, resetDataForTests, setPaidBack } from '../../data'
import { saveLoan } from '../../data/loans'
import { ME_ID, type Friend } from '../../domain/types'
import { lendFormFromQuery, lendFormToDraft, lendGridPeople, lendIssue, lendIssueMessage, lendOutcome, loanCardView, whatLabel } from './lendView'

let riya: string
const nameOf = (id: string) => (id === ME_ID ? 'You' : (friendsStore.get().find((f) => f.id === id)?.name ?? 'Someone'))

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
})

afterEach(() => resetDataForTests())

describe('words', () => {
  it('says what saving means, before and after', () => {
    expect(lendOutcome('lent', 'Riya', 50000, 'INR')).toBe('Riya will owe you ₹500')
    expect(lendOutcome('borrowed', 'Sam', 12000, 'INR')).toBe("You'll owe Sam ₹120")
    expect(lendOutcome('lent', 'Riya', 50000, 'INR', 'now')).toBe('Riya owes you ₹500')
    expect(lendOutcome('borrowed', 'Sam', 12050, 'INR', 'now')).toBe('You owe Sam ₹120.50')
  })

  it('says why Save waits, first reason first', () => {
    const ok = { friendId: 'r', amount: 100, what: 'cash' as const, title: '' }
    expect(lendIssue({ ...ok, friendId: null, amount: null })).toBe('pickWho')
    expect(lendIssue({ ...ok, amount: null })).toBe('enterAmount')
    expect(lendIssue({ ...ok, amount: 0 })).toBe('enterAmount')
    expect(lendIssue({ ...ok, what: 'other' })).toBe('enterTitle')
    expect(lendIssue({ ...ok, what: 'other', title: 'Gift' })).toBeNull()
    expect(lendIssue(ok)).toBeNull()
    expect(lendIssueMessage('pickWho')).toBe('Pick who')
    expect(lendIssueMessage('enterAmount')).toBe('Enter an amount')
    expect(whatLabel('recharge')).toBe('Recharge')
  })
})

describe('the people grid', () => {
  const person = (id: string, lastUsedAt: number): Friend => ({ id, name: id, color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt })
  it('shows the most recent people, never you, and always the picked one', () => {
    const people = [person(ME_ID, 99), ...Array.from({ length: 10 }, (_, i) => person(`p${i}`, i))]
    expect(lendGridPeople(people, null).map((f) => f.id)).toEqual(['p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3'])
    expect(lendGridPeople(people, 'p0').map((f) => f.id)).toEqual(['p0', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4'])
    expect(lendGridPeople(people, 'p8').map((f) => f.id)).toEqual(['p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3'])
  })
})

describe('deep links and drafts', () => {
  it('reads only what is valid', () => {
    const isFriend = (id: string) => id === riya
    const q = (s: string) => lendFormFromQuery(new URLSearchParams(s), 'INR', isFriend, '2026-10-22')
    expect(q(`dir=borrowed&friend=${riya}&amount=12000&what=auto`)).toMatchObject({ direction: 'borrowed', friendId: riya, amount: 12000, what: 'auto', date: '2026-10-22' })
    expect(q('dir=sideways&friend=me&amount=1.5&what=gold')).toMatchObject({ direction: 'lent', friendId: null, amount: null, what: 'cash' })
    expect(q('friend=ghost&amount=0')).toMatchObject({ friendId: null, amount: null })
  })

  it('turns a ready form into a draft', () => {
    const form = lendFormFromQuery(new URLSearchParams(`friend=${riya}&amount=50000`), 'INR', () => true, '2026-10-22')
    expect(lendFormToDraft(form)).toEqual({ direction: 'lent', friendId: riya, amount: 50000, currency: 'INR', what: 'cash', date: '2026-10-22', note: null, groupId: null })
    expect(lendFormToDraft({ ...form, what: 'other', title: 'Gift', note: 'for mom' }, 'e1')).toMatchObject({ id: 'e1', what: 'other', title: 'Gift', note: 'for mom' })
    expect(lendFormToDraft({ ...form, friendId: null })).toBeNull()
  })
})

describe('loanCardView', () => {
  it('words an open loan, a settled one, and one in a group', () => {
    const loan = saveLoan({ direction: 'lent', friendId: riya, amount: 50000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    expect(loanCardView(loan, nameOf, [])).toMatchObject({
      otherId: riya,
      mine: true,
      emoji: '💵',
      label: 'Cash',
      line: 'You lent Riya ₹500 on 21 Oct',
      status: '₹500 still to come',
      state: 'open',
      canRepayPart: true,
    })
    const settled = setPaidBack(loan.id, riya, true)
    const at = new Date(settled.paidBack[riya] ?? 0)
    const day = `${at.getDate()} ${at.toLocaleString('en-IN', { month: 'short' })}`
    expect(loanCardView(settled, nameOf, [])).toMatchObject({ state: 'settled', status: `Settled on ${day} ✓`, canRepayPart: false })

    const flat = createGroup({ name: 'Flat 302', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const inGroup = saveLoan({ direction: 'lent', friendId: riya, amount: 50000, currency: 'INR', what: 'cash', date: '2026-10-21', groupId: flat.id })
    expect(loanCardView(inGroup, nameOf, groupsStore.get())).toMatchObject({ state: 'group', status: 'In Flat 302 — settled with the group’s balances.' })
  })

  it('words borrowed loans and paid-for entries', () => {
    const borrowed = saveLoan({ direction: 'borrowed', friendId: riya, amount: 200000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    expect(loanCardView(borrowed, nameOf, [])).toMatchObject({ mine: false, line: 'Riya lent you ₹2,000 on 21 Oct', status: '₹2,000 still to pay back' })
    const chai = saveLoan({ direction: 'lent', friendId: riya, amount: 4000, currency: 'INR', what: 'chai', date: '2026-10-21' })
    expect(loanCardView(chai, nameOf, [])).toMatchObject({ emoji: '☕', line: 'You paid ₹40 for Riya on 21 Oct' })
    const auto = saveLoan({ direction: 'borrowed', friendId: riya, amount: 12000, currency: 'INR', what: 'auto', date: '2026-10-21' })
    expect(loanCardView(auto, nameOf, [])).toMatchObject({ emoji: '🛺', line: 'Riya paid ₹120 for you on 21 Oct' })
  })
})
