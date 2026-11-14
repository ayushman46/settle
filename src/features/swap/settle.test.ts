import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, updateFriend, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { decodePayLink } from '../../share/payLink'
import { friendsStore } from '../../data/stores'
import { swapMessage, swapPayLink, swapPayLinkPayload } from './message'
import { recordSwap } from './settle'
import { swapPeople } from './useSwaps'
import { swapPlan } from './engine'

const OPTS = { method: 'other' as const, date: '2026-11-14' }
const nets = () => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend
const friendsById = () => Object.fromEntries(friendsStore.get().map((f) => [f.id, f]))

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

describe('recordSwap', () => {
  it('clears both sides when the amounts match, and Undo puts both back', () => {
    // Riya owes you ₹500; you owe Sam ₹500.
    saveExpense(draft({ title: 'Dinner', total: 100_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 100_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    expect(nets()).toEqual({ [riya]: 50_000, [sam]: -50_000 })

    const plan = swapPlan(swapPeople(nets(), friendsById()))
    expect(plan.swaps).toEqual([{ fromId: riya, toId: sam, amount: 50_000 }])
    const undo = recordSwap(plan.swaps[0]!, 'INR', OPTS)
    expect(nets()).toEqual({})

    undo()
    expect(nets()).toEqual({ [riya]: 50_000, [sam]: -50_000 })
  })

  it('records only the swap’s amount when someone owes more, in part payments and group payments', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [sam] })
    // Riya owes you ₹800 over two splits (₹300 older, ₹500 newer).
    saveExpense(draft({ title: 'Chai', total: 60_000, date: '2026-10-01', participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-10-20', participants: everyone(ME_ID, riya) }))
    // You owe Sam ₹500 in Goa.
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 100_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    expect(nets()).toEqual({ [riya]: 80_000, [sam]: -50_000 })

    const before = { expenses: expensesStore.get(), groups: groupsStore.get() }
    const undo = recordSwap({ fromId: riya, toId: sam, amount: 50_000 }, 'INR', OPTS)
    // Riya still owes you ₹300; Sam is square.
    expect(nets()).toEqual({ [riya]: 30_000 })
    const chai = expensesStore.get().find((e) => e.title === 'Chai')
    const dinner = expensesStore.get().find((e) => e.title === 'Dinner')
    // The oldest is paid off first, the next in part.
    expect(chai?.paidBack[riya]).toBeDefined()
    expect(dinner?.paidBack[riya]).toBeUndefined()
    expect(dinner?.partPaid?.[riya]).toBe(20_000)
    expect(groupsStore.get()[0]?.settlements).toHaveLength(1)

    undo()
    expect(nets()).toEqual({ [riya]: 80_000, [sam]: -50_000 })
    expect(groupsStore.get()[0]?.settlements).toHaveLength(0)
    expect(expensesStore.get().map((e) => [e.id, e.paidBack, e.partPaid])).toEqual(before.expenses.map((e) => [e.id, e.paidBack, e.partPaid]))
  })

  it('never records more than is open', () => {
    saveExpense(draft({ title: 'Dinner', total: 40_000, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Cab', total: 100_000, payerId: sam, participants: everyone(ME_ID, sam) }))
    recordSwap({ fromId: riya, toId: sam, amount: 50_000 }, 'INR', OPTS)
    // Riya only owed ₹200: that's all that's recorded from her; Sam is paid the ₹500.
    expect(nets()).toEqual({})
  })
})

describe('the message', () => {
  it('asks to pay the person you owe, with their UPI ID and a pay link that opens on the payment', async () => {
    updateFriend(sam, { upiId: 'sam@okaxis' })
    const swap = { fromId: riya, toId: sam, amount: 50_000 }
    const link = await swapPayLink(swap, friendsById(), { name: 'Ayush', upiId: null }, 'INR', '2026-11-14', 'https://settle.example')
    expect(link).toMatch(/^https:\/\/settle\.example\/pay#/)
    const payload = await decodePayLink(link!)
    expect(payload).toMatchObject({ c: 'INR', tot: 50_000, to: { n: 'Sam', u: 'sam@okaxis' }, p: [{ n: 'Riya', a: 50_000 }], f: 0 })

    const text = swapMessage(swap, friendsById(), { name: 'Ayush', upiId: null }, 'INR', link)
    expect(text).toContain('Hi Riya, instead of paying me ₹500, please pay Sam ₹500 directly')
    expect(text).toContain('Sam’s UPI ID: sam@okaxis')
    expect(text).toContain(`Pay Sam here: ${link}`)
  })

  it('without a UPI ID (or outside rupees): no link, and the message says just the amount', () => {
    const swap = { fromId: riya, toId: sam, amount: 50_000 }
    expect(swapPayLinkPayload(swap, friendsById(), { name: 'Ayush', upiId: null }, 'INR', '2026-11-14')).toBeNull()
    updateFriend(sam, { upiId: 'sam@okaxis' })
    expect(swapPayLinkPayload(swap, friendsById(), { name: 'Ayush', upiId: null }, 'USD', '2026-11-14')).toBeNull()
    updateFriend(sam, { upiId: null })
    const text = swapMessage(swap, friendsById(), { name: 'Ayush', upiId: null }, 'INR', null)
    expect(text).not.toContain('UPI ID')
    expect(text).not.toContain('http')
  })
})
