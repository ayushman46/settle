import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense } from '../../data'
import { groupBalances } from '../../engine/balances'
import { autoSettleStore } from '../../data/stores'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { undoMatches } from '../whospaid/sources'
import type { RawAlert } from './alerts'
import { dropPending, pendingCredits, RECENT_MS, settleAlerts } from './autoSettle'

const AT = new Date(2026, 9, 28, 19, 42).getTime()
const GPAY = 'com.google.android.apps.nbu.paisa.user'
const PHONEPE = 'com.phonepe.app'
const MESSAGES = 'com.google.android.apps.messaging'
let n = 0
const alert = (app: string, title: string, text = '', at = AT): RawAlert => ({ id: `a${++n}`, app, title, text, postedAt: at })

let riya: string
let sam: string
let asha: string
let dinner: string
const paid = (friendId: string) => expensesStore.get().find((e) => e.id === dinner)?.paidBack[friendId] !== undefined

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
  asha = addFriend({ name: 'Asha' }).id
  // ₹1,680 four ways: Riya, Sam and Asha owe ₹420 each.
  dinner = saveExpense(draft({ title: 'Goa dinner', total: 168_000, date: '2026-10-26', participants: everyone(ME_ID, riya, sam, asha) })).id
})

describe('settleAlerts', () => {
  it('ticks off whoever the phone saw pay, with nothing to do', () => {
    const result = settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420')], AT)
    expect(result.ticked).toEqual([{ friendId: riya, amount: 42_000, titles: ['Goa dinner'] }])
    expect(paid(riya)).toBe(true)
    expect(paid(sam)).toBe(false)
  })

  it('the bank’s SMS for the same payment doesn’t tick a second split', () => {
    saveExpense(draft({ title: 'Cab', total: 84_000, date: '2026-10-27', participants: everyone(ME_ID, riya) }))
    settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420')], AT)
    const again = settleAlerts([alert(MESSAGES, 'VM-HDFCBK', 'Rs.420.00 credited to a/c XX4821 on 28-10-26 from RIYA SHARMA (UPI Ref no 629618427311).', AT + 60_000)], AT + 60_000)
    expect(again.ticked).toEqual([])
    expect(expensesStore.get().filter((e) => e.paidBack[riya] !== undefined)).toHaveLength(1)
  })

  it('… but the same amount from them again later is their next split', () => {
    saveExpense(draft({ title: 'Cab', total: 84_000, date: '2026-10-27', participants: everyone(ME_ID, riya) }))
    settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420')], AT)
    const later = AT + RECENT_MS + 60_000
    expect(settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420', '', later)], later).ticked).toEqual([{ friendId: riya, amount: 42_000, titles: ['Cab'] }])
  })

  it('a payment that may be someone’s waits for a tap; one that fits nobody is let go', () => {
    const result = settleAlerts([alert(PHONEPE, 'Received ₹400 from Asha Iyer'), alert(PHONEPE, 'Received ₹999 from Karan Malhotra')], AT)
    expect(result.ticked).toEqual([])
    expect(result.waiting).toBe(1)
    expect(pendingCredits()).toEqual([expect.objectContaining({ name: 'Asha Iyer', amount: 40_000, source: 'alert' })])
    expect(paid(asha)).toBe(false)
    // Told again, it still waits once.
    expect(settleAlerts([alert(PHONEPE, 'Received ₹400 from Asha Iyer', '', AT + 1000)], AT + 1000).waiting).toBe(1)
    dropPending(pendingCredits().map((c) => c.id))
    expect(pendingCredits()).toEqual([])
  })

  it('money going out, requests and cashback change nothing', () => {
    const result = settleAlerts([alert(GPAY, 'You paid Riya Sharma ₹420'), alert(GPAY, 'Riya Sharma requested ₹420'), alert(PHONEPE, 'Cashback received', '₹420 cashback credited')], AT)
    expect(result).toEqual({ ticked: [], applied: null, waiting: 0 })
    expect(paid(riya)).toBe(false)
  })

  it('Undo puts it back', () => {
    const result = settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420')], AT)
    if (result.applied) undoMatches(result.applied)
    expect(paid(riya)).toBe(false)
  })

  it('money owed in a group is paid by recording the payment in the group, with Undo', () => {
    const goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya] })
    saveExpense(draft({ groupId: goa.id, title: 'Villa', total: 200_000, date: '2026-10-25', participants: everyone(ME_ID, riya) }))
    const result = settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹1,000')], AT)
    expect(result.ticked).toEqual([{ friendId: riya, amount: 100_000, titles: ['Goa'] }])
    const group = () => groupsStore.get().find((g) => g.id === goa.id)
    expect(group()?.settlements).toEqual([expect.objectContaining({ fromId: riya, toId: ME_ID, amount: 100_000, method: 'upi' })])
    expect(groupBalances(group()!, expensesStore.get())).toEqual({ [ME_ID]: 0, [riya]: 0 })
    if (result.applied) undoMatches(result.applied)
    expect(group()?.settlements).toEqual([])
  })

  it('part of a share: what was paid is recorded and the rest stays owed', () => {
    const result = settleAlerts([alert(PHONEPE, 'Received ₹400 from Asha Iyer')], AT)
    expect(result.waiting).toBe(1)
    // (A part payment waits for a tap; once confirmed, it's recorded — see the screen test.)
    expect(expensesStore.get().find((e) => e.id === dinner)?.partPaid).toBeUndefined()
  })

  it('waiting payments are let go after two weeks', () => {
    settleAlerts([alert(PHONEPE, 'Received ₹400 from Asha Iyer')], AT)
    const later = AT + 15 * 86_400_000
    settleAlerts([], later)
    expect(autoSettleStore.get().pending).toEqual([])
  })
})
