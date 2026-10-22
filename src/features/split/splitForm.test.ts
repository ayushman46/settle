import { describe, expect, it } from 'vitest'
import { ME_ID, type BillSnapshot, type Expense } from '../../domain/types'
import { makeExpense, makeGroup } from '../../share/testing'
import { EMPTY_META } from '../../types'
import {
  blankForm,
  changeCurrency,
  changesSavedMessage,
  formFromExpense,
  formShares,
  formToDraft,
  outcomeLine,
  payerCandidates,
  withFriend,
  withGroup,
  withPeople,
  withPrefill,
  withTemplate,
  type PrefillContext,
  type SplitForm,
} from './splitForm'

const TODAY = '2026-10-22'
const names: Record<string, string> = { [ME_ID]: 'You', riya: 'Riya', sam: 'Sam', neha: 'Neha Sharma' }
const nameOf = (id: string) => names[id] ?? 'Someone'

function form(patch: Partial<SplitForm> = {}): SplitForm {
  return { ...blankForm('INR', TODAY), ...patch }
}

const people = (...ids: string[]) => ids.map((friendId) => ({ friendId, input: null }))

const BILL: BillSnapshot = {
  meta: { ...EMPTY_META, merchant: 'Toit', tax: 5_000 },
  items: [
    { id: 'i1', name: 'Pizza', quantity: 1, amount: 60_000 },
    { id: 'i2', name: 'Beer', quantity: 2, amount: 40_000 },
  ],
  assignments: { i1: { [ME_ID]: 1, riya: 1 }, i2: { riya: 1 } },
  warnings: [],
}

describe('blankForm', () => {
  it('starts with just you, split equally, paid by you, today', () => {
    expect(blankForm('USD', TODAY)).toEqual({
      total: null,
      currency: 'USD',
      title: '',
      category: 'other',
      categoryPicked: false,
      date: TODAY,
      groupId: null,
      participants: [{ friendId: ME_ID, input: null }],
      mode: 'equal',
      payerId: ME_ID,
      roundToWhole: false,
      note: '',
      bill: null,
      source: 'manual',
      recurringId: null,
    })
  })
})

describe('withPeople', () => {
  it('keeps what was typed for people who stay and adds new people empty', () => {
    const before = [
      { friendId: ME_ID, input: 400 },
      { friendId: 'riya', input: 600 },
    ]
    expect(withPeople(before, ['riya', 'sam'])).toEqual([
      { friendId: 'riya', input: 600 },
      { friendId: 'sam', input: null },
    ])
  })
})

describe('changeCurrency', () => {
  it('keeps the amount as typed and moves exact amounts with it', () => {
    const exact = form({
      total: 123_450,
      mode: 'exact',
      participants: [
        { friendId: ME_ID, input: 23_450 },
        { friendId: 'riya', input: null },
      ],
    })
    const yen = changeCurrency(exact, 'JPY')
    expect(yen.currency).toBe('JPY')
    expect(yen.total).toBe(1_235)
    expect(yen.participants).toEqual([
      { friendId: ME_ID, input: 235 },
      { friendId: 'riya', input: null },
    ])
    expect(changeCurrency(yen, 'INR').total).toBe(123_500)
  })

  it('leaves percentages and shares alone', () => {
    const percent = form({ total: 10_000, mode: 'percent', participants: [{ friendId: ME_ID, input: 10_000 }] })
    expect(changeCurrency(percent, 'JPY').participants).toEqual([{ friendId: ME_ID, input: 10_000 }])
  })

  it('is a no-op for the same currency', () => {
    const same = form({ total: 500 })
    expect(changeCurrency(same, 'INR')).toBe(same)
  })

  it('keeps an empty amount empty', () => {
    expect(changeCurrency(form(), 'USD').total).toBeNull()
  })
})

describe('withGroup', () => {
  const goa = makeGroup()

  it('brings in the whole group, in its currency, while it is still just you', () => {
    const next = withGroup(form({ currency: 'USD', total: 1_000 }), goa)
    expect(next.groupId).toBe('g1')
    expect(next.currency).toBe('INR')
    expect(next.total).toBe(1_000)
    expect(next.participants.map((p) => p.friendId)).toEqual([ME_ID, 'riya', 'sam', 'neha'])
  })

  it('keeps people already picked', () => {
    const next = withGroup(form({ participants: people(ME_ID, 'riya') }), goa)
    expect(next.participants.map((p) => p.friendId)).toEqual([ME_ID, 'riya'])
  })

  it('picks a member to pay when you are not in the group', () => {
    const theirs = makeGroup({ memberIds: ['riya', 'sam'] })
    const next = withGroup(form(), theirs)
    expect(next.participants.map((p) => p.friendId)).toEqual(['riya', 'sam'])
    expect(next.payerId).toBe('riya')
  })

  it('takes it out of the group with null', () => {
    expect(withGroup(form({ groupId: 'g1' }), null).groupId).toBeNull()
  })

  it('never changes the currency or people of an itemized bill', () => {
    const bill = form({ bill: BILL, currency: 'USD', participants: people(ME_ID, 'riya') })
    const next = withGroup(bill, goa)
    expect(next.groupId).toBe('g1')
    expect(next.currency).toBe('USD')
    expect(next.participants.map((p) => p.friendId)).toEqual([ME_ID, 'riya'])
  })
})

describe('withFriend and withTemplate', () => {
  it('adds a friend once', () => {
    const once = withFriend(form(), 'riya')
    expect(once.participants.map((p) => p.friendId)).toEqual([ME_ID, 'riya'])
    expect(withFriend(once, 'riya')).toBe(once)
  })

  it('starts rent as "Rent", with its category chosen', () => {
    expect(withTemplate(form(), 'rent')).toMatchObject({ title: 'Rent', category: 'rent', categoryPicked: true })
  })

  it('sets the category without inventing a title', () => {
    expect(withTemplate(form(), 'subscription')).toMatchObject({ title: '', category: 'subscription', categoryPicked: true })
  })

  it('keeps a typed title and ignores unknown categories', () => {
    expect(withTemplate(form({ title: 'Flat 4B' }), 'rent').title).toBe('Flat 4B')
    const plain = form()
    expect(withTemplate(plain, 'yachts')).toBe(plain)
    expect(withTemplate(plain, null)).toBe(plain)
  })
})

describe('withPrefill', () => {
  const ctx: PrefillContext = { friendIds: new Set([ME_ID, 'riya', 'sam']), groups: [makeGroup()], today: TODAY }

  it('lays a "Just say it" draft over the form', () => {
    const next = withPrefill(
      form(),
      {
        title: '  Cab to airport ',
        category: 'transport',
        total: 84_000,
        currency: 'INR',
        mode: 'shares',
        participants: [
          { friendId: ME_ID, input: 1 },
          { friendId: 'riya', input: 1 },
          { friendId: 'sam', input: 2 },
        ],
        payerId: 'sam',
        source: 'describe',
      },
      ctx,
    )
    expect(next).toMatchObject({
      title: 'Cab to airport',
      category: 'transport',
      categoryPicked: true,
      total: 84_000,
      mode: 'shares',
      payerId: 'sam',
      source: 'describe',
    })
    expect(next.participants).toEqual([
      { friendId: ME_ID, input: 1 },
      { friendId: 'riya', input: 1 },
      { friendId: 'sam', input: 2 },
    ])
  })

  it('ignores people who are gone, a future date, an unknown currency and an empty amount', () => {
    const base = form({ participants: people(ME_ID, 'riya') })
    const next = withPrefill(
      base,
      { participants: people('ghost'), date: '2026-12-01', currency: 'XXQ', total: 0, payerId: 'ghost' },
      ctx,
    )
    expect(next.participants).toEqual(base.participants)
    expect(next.date).toBe(TODAY)
    expect(next.currency).toBe('INR')
    expect(next.total).toBeNull()
    expect(next.payerId).toBe(ME_ID)
  })

  it('files it under a group that still exists', () => {
    const next = withPrefill(form(), { groupId: 'g1', total: 50_000 }, ctx)
    expect(next.groupId).toBe('g1')
    expect(next.participants).toHaveLength(4)
    expect(withPrefill(form(), { groupId: 'gone' }, ctx).groupId).toBeNull()
  })

  it('keeps a past date, a note and the recurring split it came from', () => {
    const next = withPrefill(form(), { date: '2026-10-01', note: 'BESCOM', recurringId: 'r1', source: 'recurring' }, ctx)
    expect(next).toMatchObject({ date: '2026-10-01', note: 'BESCOM', recurringId: 'r1', source: 'recurring' })
  })
})

describe('formFromExpense and formToDraft', () => {
  it('round-trips a split', () => {
    const e = makeExpense({ note: 'Toit, Indiranagar', roundedToWhole: true, groupId: 'g1' })
    const f = formFromExpense(e)
    expect(f).toMatchObject({ total: 276_600, title: 'Dinner at Toit', categoryPicked: true, roundToWhole: true, note: 'Toit, Indiranagar', bill: null })
    expect(formToDraft(f, e.id)).toEqual({
      id: 'e1',
      kind: 'split',
      title: e.title,
      category: e.category,
      currency: e.currency,
      total: e.total,
      date: e.date,
      payerId: e.payerId,
      mode: 'equal',
      participants: e.participants,
      roundedToWhole: true,
      note: 'Toit, Indiranagar',
      groupId: 'g1',
      bill: null,
      recurringId: null,
      source: 'manual',
    })
  })

  it('keeps an itemized bill item by item', () => {
    const e: Expense = makeExpense({ kind: 'bill', mode: 'items', bill: BILL, participants: people(ME_ID, 'riya'), total: 105_000 })
    const f = formFromExpense(e)
    expect(f.bill).toBe(BILL)
    expect(f.mode).toBe('equal')
    const draft = formToDraft(f)
    expect(draft).toMatchObject({ kind: 'bill', mode: 'items', bill: BILL })
    expect('id' in draft).toBe(false)
  })

  it('saves a blank note as none', () => {
    expect(formToDraft(form({ note: '  \n ' })).note).toBeNull()
    expect(formToDraft(form({ total: null })).total).toBe(0)
  })
})

describe('payerCandidates', () => {
  it('lists you, the people in it and the payer, once each', () => {
    expect(payerCandidates({ participants: people('riya', ME_ID), payerId: 'neha' })).toEqual([ME_ID, 'riya', 'neha'])
  })
})

describe('formShares', () => {
  it('splits like saving would, to the paisa', () => {
    const shares = formShares(form({ total: 100_000, participants: people(ME_ID, 'riya', 'sam') }))
    expect(shares).toEqual({ [ME_ID]: 33_334, riya: 33_333, sam: 33_333 })
  })

  it('re-spreads a bill over its items', () => {
    const shares = formShares(form({ total: 105_000, bill: BILL, participants: people(ME_ID, 'riya') }))
    expect(shares[ME_ID]! + shares.riya!).toBe(105_000)
    expect(shares.riya).toBeGreaterThan(shares[ME_ID]!)
  })
})

describe('outcomeLine', () => {
  const line = (payerId: string, shares: Record<string, number>, tense?: 'future' | 'now') =>
    outcomeLine({ payerId, currency: 'INR', shares }, nameOf, tense)

  it('says who will owe you', () => {
    expect(line(ME_ID, { [ME_ID]: 80_000, riya: 80_000 })).toBe('Riya will owe you ₹800')
    expect(line(ME_ID, { [ME_ID]: 80_000, riya: 80_000, sam: 80_000 })).toBe('Riya and Sam will owe you ₹800 each')
    expect(line(ME_ID, { [ME_ID]: 80_000, riya: 80_000, sam: 80_000 }, 'now')).toBe('Riya and Sam owe you ₹800 each')
    expect(line(ME_ID, { [ME_ID]: 1, riya: 2, sam: 3 })).toBe('You’ll get back ₹0.05 from Riya and Sam')
    expect(line(ME_ID, { [ME_ID]: 1, riya: 2, sam: 3 }, 'now')).toBe('Riya and Sam owe you ₹0.05 in all')
  })

  it('counts big tables instead of naming everyone', () => {
    const shares = { [ME_ID]: 100, riya: 100, sam: 100, neha: 100, x: 100 }
    expect(line(ME_ID, shares)).toBe('You’ll get back ₹4 from 4 people')
    expect(line(ME_ID, shares, 'now')).toBe('4 people owe you ₹4')
  })

  it('says when it is all on you', () => {
    expect(line(ME_ID, { [ME_ID]: 50_000 })).toBe('Nothing to collect — it’s all on you.')
  })

  it('says what you will owe someone else', () => {
    expect(line('riya', { [ME_ID]: 54_000, riya: 54_000 })).toBe('You’ll owe Riya ₹540')
    expect(line('riya', { [ME_ID]: 54_000, riya: 54_000 }, 'now')).toBe('You owe Riya ₹540')
  })

  it('says what the payer gets back when you are not in it', () => {
    expect(line('riya', { riya: 100, sam: 100 })).toBe('Riya will get back ₹1')
    expect(line('riya', { riya: 100, sam: 100 }, 'now')).toBe('Riya gets back ₹1')
    expect(line('riya', { riya: 100 })).toBe('Nothing to pay back.')
  })
})

describe('changesSavedMessage', () => {
  it('is plain when nobody owes again', () => {
    expect(changesSavedMessage({ paidBack: { riya: 1 } }, { paidBack: { riya: 1 }, shares: { riya: 5 } }, nameOf)).toBe('Changes saved')
  })

  it('names people whose share went up after paying', () => {
    expect(changesSavedMessage({ paidBack: { riya: 1 } }, { paidBack: {}, shares: { riya: 9 } }, nameOf)).toBe(
      'Changes saved. Riya owes more now, so they’re marked as not paid yet.',
    )
    expect(changesSavedMessage({ paidBack: { riya: 1, sam: 1 } }, { paidBack: {}, shares: { riya: 9, sam: 9 } }, nameOf)).toBe(
      'Changes saved. Riya and Sam owe more now, so they’re marked as not paid yet.',
    )
    expect(changesSavedMessage({ paidBack: { [ME_ID]: 1 } }, { paidBack: {}, shares: { [ME_ID]: 9 } }, nameOf)).toBe(
      'Changes saved. You owe more now, so you’re marked as not paid yet.',
    )
  })

  it('stays quiet about someone taken out of the split', () => {
    expect(changesSavedMessage({ paidBack: { riya: 1 } }, { paidBack: {}, shares: {} }, nameOf)).toBe('Changes saved')
  })
})
