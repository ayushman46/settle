import { beforeEach, describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { ME_ID } from '../domain/types'
import { collectProgress, expenseStanding, overallSummary, stillOwed } from '../engine/balances'
import { recordPartPayment, saveExpense, setPaidBack } from './expenses'
import { addFriend } from './friends'
import { expenseSchema } from './schemas'
import { expensesStore, groupsStore } from './stores'
import { draft, everyone } from './testKit'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

let riya: string
let sam: string
/** ₹1,260 three ways: Riya and Sam owe ₹420 each. */
function dinner() {
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  return saveExpense(draft({ title: 'Dinner', total: 126_000, participants: everyone(ME_ID, riya, sam) }))
}
const current = (id: string) => expensesStore.get().find((e) => e.id === id)

describe('part payments', () => {
  it('₹200 of ₹420: the rest stays owed, everywhere', () => {
    const e = dinner()
    const result = recordPartPayment(e.id, riya, 20_000)
    expect(result.complete).toBe(false)
    expect(result.expense.partPaid).toEqual({ [riya]: 20_000 })
    expect(stillOwed(result.expense, riya)).toBe(22_000)
    expect(collectProgress(result.expense)).toMatchObject({ collected: 20_000, outstanding: 64_000, paidCount: 0 })
    const summary = overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR')
    expect(summary.byFriend).toEqual({ [riya]: 22_000, [sam]: 42_000 })
    expect(summary.owedToMe).toBe(64_000)
  })

  it('paying the rest ticks them off; Undo puts each step back', () => {
    const e = dinner()
    const first = recordPartPayment(e.id, riya, 20_000)
    const second = recordPartPayment(e.id, riya, 22_000)
    expect(second.complete).toBe(true)
    expect(current(e.id)?.paidBack[riya]).toBeDefined()
    expect(current(e.id)?.partPaid).toBeUndefined()
    second.undo()
    expect(current(e.id)?.partPaid).toEqual({ [riya]: 20_000 })
    expect(current(e.id)?.paidBack[riya]).toBeUndefined()
    first.undo()
    expect(current(e.id)?.partPaid).toBeUndefined()
  })

  it('paying more than the rest counts as paid in full', () => {
    const e = dinner()
    expect(recordPartPayment(e.id, riya, 50_000).complete).toBe(true)
    expect(stillOwed(current(e.id)!, riya)).toBe(0)
  })

  it('ticked off and then un-ticked (Undo), they owe the rest — not their whole share', () => {
    const e = dinner()
    recordPartPayment(e.id, riya, 20_000)
    setPaidBack(e.id, riya, true)
    expect(stillOwed(current(e.id)!, riya)).toBe(0)
    setPaidBack(e.id, riya, false)
    expect(stillOwed(current(e.id)!, riya)).toBe(22_000)
  })

  it('nothing to record for the payer, someone outside it, or someone already paid', () => {
    const e = dinner()
    const kabir = addFriend({ name: 'Kabir' }).id
    setPaidBack(e.id, sam, true)
    for (const id of [ME_ID, kabir, sam]) expect(recordPartPayment(e.id, id, 10_000).expense).toBe(current(e.id))
    expect(current(e.id)?.partPaid).toBeUndefined()
  })

  it('an edit keeps what was paid; a share now covered by it is ticked off', () => {
    const e = dinner()
    recordPartPayment(e.id, riya, 30_000)
    // ₹1,800 three ways: ₹600 each — Riya has paid ₹300 of it.
    const bigger = saveExpense(draft({ id: e.id, title: 'Dinner', total: 180_000, participants: everyone(ME_ID, riya, sam) }))
    expect(bigger.partPaid).toEqual({ [riya]: 30_000 })
    expect(stillOwed(bigger, riya)).toBe(30_000)
    // ₹750 three ways: ₹250 each — her ₹300 covers it.
    const smaller = saveExpense(draft({ id: e.id, title: 'Dinner', total: 75_000, participants: everyone(ME_ID, riya, sam) }))
    expect(smaller.partPaid).toBeUndefined()
    expect(smaller.paidBack[riya]).toBeDefined()
  })

  it('my own part payment to someone else counts on my side', () => {
    riya = addFriend({ name: 'Riya' }).id
    const e = saveExpense(draft({ title: 'Cab', total: 84_000, payerId: riya, participants: everyone(ME_ID, riya) }))
    recordPartPayment(e.id, ME_ID, 10_000)
    expect(expenseStanding(current(e.id)!, ME_ID).outstanding).toBe(-32_000)
    expect(overallSummary(expensesStore.get(), [], ME_ID, 'INR').byFriend).toEqual({ [riya]: -32_000 })
  })

  it('stored records: impossible part payments are dropped', () => {
    const e = dinner()
    const parsed = z.parse(expenseSchema, { ...e, partPaid: { [riya]: 20_000, [sam]: 42_000, [ME_ID]: 100, ghost: 5, x: 'lots' } })
    expect(parsed.partPaid).toEqual({ [riya]: 20_000 })
    expect(z.parse(expenseSchema, { ...e, partPaid: 'nope' }).partPaid).toBeUndefined()
  })
})
