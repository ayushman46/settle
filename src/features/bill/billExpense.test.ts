import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFriend, expensesStore, resetDataForTests, saveExpense, setPaidBack } from '../../data'
import { ME_ID } from '../../domain/types'
import { computeSplit } from '../../lib/split'
import { effectivePaid } from '../../state/selectors'
import type { Person, Session } from '../../types'
import { billExpenseDraft, billPayer, payerCandidates } from './billExpense'
import { personById, personFor } from './billPeople'
import { assignAll, sampleSession } from './screenTestKit'

const TODAY = '2026-10-22'

function me(): Person {
  const person = personById(ME_ID)
  if (!person) throw new Error('you are always one of your people')
  return person
}

/** The sample bill (₹2,299) between you, Riya and Sam: you had every other item, Riya and Sam shared the rest. */
function readyBill(overrides: Partial<Session> = {}): Session {
  const riya = personFor(addFriend({ name: 'Riya' }))
  const sam = personFor(addFriend({ name: 'Sam' }))
  const base = sampleSession('result', { people: [me(), riya, sam] })
  return {
    ...base,
    assignments: assignAll(base, (i) => (i % 2 ? { [ME_ID]: 1 } : { [riya.id]: 1, [sam.id]: 2 })),
    ...overrides,
  }
}

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  resetDataForTests()
})

describe('billExpenseDraft', () => {
  it('saves the bill as an itemized expense whose shares match the split on screen', () => {
    const session = readyBill({ category: null, meta: { ...sampleSession('result').meta, date: '2026-10-18' } })
    const draft = billExpenseDraft(session, TODAY)
    expect(draft).toMatchObject({
      kind: 'bill',
      title: 'Saffron Table',
      category: 'food',
      currency: 'INR',
      total: 229900,
      date: '2026-10-18',
      payerId: ME_ID,
      mode: 'items',
      roundedToWhole: false,
      groupId: null,
      source: 'sample',
    })
    expect(draft.participants).toEqual(session.people.map((p) => ({ friendId: p.id, input: null })))
    expect(draft.bill?.items).toEqual(session.items)
    expect(draft).not.toHaveProperty('id')

    const saved = saveExpense(draft)
    const split = computeSplit({ ...session, paid: effectivePaid(session) })
    expect(saved.shares).toEqual(Object.fromEntries(split.people.map((p) => [p.person.id, p.total])))
    expect(Object.values(saved.shares).reduce((a, b) => a + b, 0)).toBe(229900)
  })

  it('shares unassigned items between everyone, exactly as the split screen says', () => {
    const base = readyBill()
    const first = base.items[0]
    if (!first) throw new Error('sample items missing')
    const { [first.id]: _dropped, ...rest } = base.assignments
    const session = { ...base, assignments: rest }
    const saved = saveExpense(billExpenseDraft(session, TODAY))
    const split = computeSplit({ ...session, paid: effectivePaid(session) })
    expect(saved.shares).toEqual(Object.fromEntries(split.people.map((p) => [p.person.id, p.total])))
    expect(saved.bill?.assignments).not.toHaveProperty(first.id)
  })

  it('uses what was actually paid, the payer picked, the category, the day and the group', () => {
    const base = readyBill()
    const riya = base.people[1]
    if (!riya) throw new Error('riya missing')
    const draft = billExpenseDraft(
      { ...base, paid: 250000, payerId: riya.id, category: 'travel', date: '2026-10-20', groupId: 'g1', source: 'scan' },
      TODAY,
    )
    expect(draft).toMatchObject({ total: 250000, payerId: riya.id, category: 'travel', date: '2026-10-20', groupId: 'g1', source: 'scan' })
  })

  it('falls back to the bill’s name for its category, and to today for a date it can’t read', () => {
    const base = readyBill({ meta: { ...sampleSession('result').meta, merchant: 'DMart Ready', date: '18 Oct' } })
    expect(billExpenseDraft(base, TODAY)).toMatchObject({ category: 'groceries', date: TODAY })
  })

  it('keeps only real assignments in the snapshot', () => {
    const base = readyBill()
    const first = base.items[0]
    if (!first) throw new Error('sample items missing')
    const draft = billExpenseDraft({ ...base, assignments: { ...base.assignments, [first.id]: { ghost: 1 }, gone: { [ME_ID]: 1 } } }, TODAY)
    expect(draft.bill?.assignments).not.toHaveProperty(first.id)
    expect(draft.bill?.assignments).not.toHaveProperty('gone')
  })

  it('saving again after a fix updates the same expense, keeping who has paid back', () => {
    const session = readyBill()
    const first = saveExpense(billExpenseDraft(session, TODAY))
    const sam = session.people[2]
    if (!sam) throw new Error('sam missing')
    setPaidBack(first.id, sam.id, true)

    const again = saveExpense(billExpenseDraft({ ...session, expenseId: first.id, meta: { ...session.meta, merchant: 'Saffron' } }, TODAY))
    expect(again.id).toBe(first.id)
    expect(again.title).toBe('Saffron')
    expect(again.paidBack).toHaveProperty(sam.id)
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('a bill typed in without a name is still titled', () => {
    const saved = saveExpense(billExpenseDraft(readyBill({ meta: { ...sampleSession('result').meta, merchant: null }, source: 'manual' }), TODAY))
    expect(saved.title).toBe('Food & drinks')
    expect(saved.source).toBe('manual')
  })
})

describe('billPayer / payerCandidates', () => {
  it('defaults to you, and offers you even when you weren’t at the table', () => {
    const riya = personFor(addFriend({ name: 'Riya' }))
    const sam = personFor(addFriend({ name: 'Sam' }))
    const session = sampleSession('result', { people: [riya, sam] })
    expect(billPayer(session)).toBe(ME_ID)
    expect(billPayer({ ...session, payerId: sam.id })).toBe(sam.id)
    expect(payerCandidates(session)).toEqual([riya.id, sam.id, ME_ID])
    expect(payerCandidates({ ...session, people: [me(), riya] })).toEqual([ME_ID, riya.id])
  })
})
