import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, friendsStore, saveExpense, updateFriend } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { undoMatches } from '../whospaid/sources'
import type { RawAlert } from './alerts'
import { settleAlerts } from './autoSettle'

const AT = new Date(2026, 10, 14, 19, 42).getTime()
const MESSAGES = 'com.google.android.apps.messaging'
const GPAY = 'com.google.android.apps.nbu.paisa.user'
let n = 0
const alert = (app: string, title: string, text = ''): RawAlert => ({ id: `u${++n}`, app, title, text, postedAt: AT })
const upiOf = (id: string) => friendsStore.get().find((f) => f.id === id)?.upiId ?? null

let riya: string

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya Sharma' }).id
  saveExpense(draft({ title: 'Goa dinner', total: 84_000, date: '2026-11-13', participants: everyone(ME_ID, riya) }))
})

describe('a friend’s UPI ID, learned from the payment they sent', () => {
  it('is kept when the alert carries it, so nobody types it; Undo forgets it', () => {
    const result = settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420', 'From riya.s@okhdfcbank')], AT)
    expect(result.ticked).toHaveLength(1)
    expect(upiOf(riya)).toBe('riya.s@okhdfcbank')
    if (result.applied) undoMatches(result.applied)
    expect(upiOf(riya)).toBeNull()
  })

  it('never replaces one they already have', () => {
    updateFriend(riya, { upiId: 'riya@ybl' })
    settleAlerts([alert(GPAY, 'Riya Sharma paid you ₹420', 'From riya.s@okhdfcbank')], AT)
    expect(upiOf(riya)).toBe('riya@ybl')
  })

  it('is not kept from an alert without one', () => {
    settleAlerts([alert(MESSAGES, 'VM-HDFCBK', 'Rs.420.00 credited to a/c XX4821 on 14-11-26 from RIYA SHARMA (UPI Ref no 631812345678).')], AT)
    expect(upiOf(riya)).toBeNull()
  })
})
