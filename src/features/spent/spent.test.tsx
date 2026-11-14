import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, peekSplitPrefill, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import type { RawAlert } from '../autosettle/alerts'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { activeGroup, SpentCard } from './SpentCard'
import { alertToSpend, dropSpend, isToFriend, noteSpends, spentStore } from './spent'

vi.setConfig({ testTimeout: 30_000 })

const GPAY = 'com.google.android.apps.nbu.paisa.user'
const NOW = Date.UTC(2026, 10, 14, 12)
const alert = (id: string, title: string, text: string, minutesAgo = 5, app = GPAY): RawAlert => ({ id, app, title, text, postedAt: NOW - minutesAgo * 60_000 })

beforeEach(() => {
  resetProScreens()
  spentStore.reload()
  updateProfile({ name: 'Ayush', currency: 'INR' })
})

describe('reading a payment you made from the phone’s alert', () => {
  it('takes the amount, the time and who it went to', () => {
    expect(alertToSpend(alert('a', 'Google Pay', 'You paid ₹450 to Uber India'))).toEqual({ id: 'a', amount: 45000, at: NOW - 300_000, to: 'Uber India' })
    expect(alertToSpend(alert('b', 'Paid to Sagar Ratna', '₹1,240.50 sent successfully'))).toMatchObject({ amount: 124050 })
    expect(alertToSpend(alert('c', 'PhonePe', 'Paid ₹80 to Chai Point on 14 Nov'))).toMatchObject({ amount: 8000, to: 'Chai Point' })
  })

  it('ignores what isn’t a payment you made: money in, failures, requests, refunds', () => {
    expect(alertToSpend(alert('a', 'Google Pay', 'Riya paid you ₹500'))).toBeNull()
    expect(alertToSpend(alert('b', 'Google Pay', 'Payment of ₹450 to Uber failed'))).toBeNull()
    expect(alertToSpend(alert('c', 'Google Pay', 'Sam requested ₹300'))).toBeNull()
    expect(alertToSpend(alert('d', 'Google Pay', 'Refund of ₹450 from Uber'))).toBeNull()
  })

  it('knows a payment to one of your people (that’s paying back, not spending)', () => {
    const friends = [{ name: 'Riya Sharma' }, { name: 'Sam' }, { name: 'Sameer K' }]
    expect(isToFriend('Riya Sharma', friends)).toBe(true)
    expect(isToFriend('RIYA', friends)).toBe(true)
    expect(isToFriend('Sam', friends)).toBe(true)
    expect(isToFriend('Uber India', friends)).toBe(false)
    expect(isToFriend(null, friends)).toBe(false)
  })
})

describe('keeping payments to offer as splits', () => {
  it('keeps what a pay sheet didn’t claim, once, newest first; not payments to friends or old ones', () => {
    const alerts = [
      alert('a', 'Google Pay', 'You paid ₹450 to Uber India', 30),
      alert('b', 'Google Pay', 'You paid ₹400 to Riya', 20),
      alert('c', 'Google Pay', 'You paid ₹300 to Sam', 10),
      alert('d', 'Google Pay', 'You paid ₹80 to Chai Point', 5),
      alert('e', 'Google Pay', 'You paid ₹999 to Old Shop', 60 * 24 * 9),
    ]
    const added = noteSpends(alerts, [{ amount: 30000, at: NOW - 10 * 60_000 }], [{ name: 'Riya' }], NOW)
    expect(added).toBe(2)
    expect(spentStore.get().waiting.map((s) => s.id)).toEqual(['d', 'a'])
    expect(noteSpends(alerts, [], [{ name: 'Riya' }], NOW)).toBe(0)
    expect(spentStore.get().waiting.map((s) => s.id)).toEqual(['d', 'a'])
  })

  it('a UPI app’s alert and the bank’s SMS for the same payment are one payment', () => {
    const sms = alert('s', 'HDFC Bank', 'Rs.450.00 debited from a/c XX1234 on 14-11-26 to VPA uber@axisbank (UPI Ref No 630112345678). Not you? Call 18002586161', 4, 'com.google.android.apps.messaging')
    noteSpends([alert('a', 'Google Pay', 'You paid ₹450 to Uber India', 5), sms], [], [], NOW)
    expect(spentStore.get().waiting).toHaveLength(1)
    expect(spentStore.get().waiting[0]).toMatchObject({ id: 'a', to: 'Uber India' })
  })

  it('a payment put away stays away, and comes back on undo', () => {
    noteSpends([alert('a', 'Google Pay', 'You paid ₹450 to Uber India')], [], [], NOW)
    const undo = dropSpend('a')
    expect(spentStore.get().waiting).toEqual([])
    expect(noteSpends([alert('a', 'Google Pay', 'You paid ₹450 to Uber India')], [], [], NOW)).toBe(0)
    undo()
    expect(spentStore.get().waiting.map((s) => s.id)).toEqual(['a'])
  })

  it('reads junk in storage as nothing', () => {
    window.localStorage.setItem('settle.v9.spent', JSON.stringify({ v: 1, data: { waiting: 'x', done: 3 } }))
    spentStore.reload()
    expect(spentStore.get()).toEqual({ waiting: [], done: [] })
  })
})

describe('SpentCard', () => {
  it('shows nothing when the phone has seen nothing', () => {
    const { container } = renderAt('/app', <SpentCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the payment to the group you’re spending with, filled in, in one tap', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' }).id
    const goa = createGroup({ name: 'Goa trip', emoji: '✈️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    saveExpense(draft({ title: 'Cab', total: 40_000, date: today(), groupId: goa.id, participants: everyone(ME_ID, riya) }))
    noteSpends([alert('a', 'Google Pay', 'You paid ₹450 to Uber India', 5), alert('b', 'Google Pay', 'You paid ₹80 to Chai Point', 50)].map((a) => ({ ...a, postedAt: Date.now() - 60_000 * (a.id === 'a' ? 5 : 50) })), [], [{ name: 'Riya' }])
    renderAt('/app', <SpentCard />)
    expect(screen.getByText('You paid ₹450 to Uber India')).toBeInTheDocument()
    expect(screen.queryByText('You paid ₹80 to Chai Point')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 more payment' }))
    expect(screen.getByText('You paid ₹80 to Chai Point')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Split with Goa trip' })[0] as HTMLElement)
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/new?from=sms&group=${goa.id}`))
    expect(peekSplitPrefill()).toMatchObject({ title: 'Uber India', total: 45000, payerId: ME_ID, groupId: goa.id, mode: 'equal', category: 'transport' })
    expect(peekSplitPrefill()?.participants?.map((p) => p.friendId)).toEqual([ME_ID, riya])
    expect(spentStore.get().waiting.map((s) => s.id)).toEqual(['b'])
  })

  it('“Just mine” puts it away, with Undo', async () => {
    const user = userEvent.setup()
    noteSpends([{ ...alert('a', 'Google Pay', 'You paid ₹450 to Uber India'), postedAt: Date.now() - 60_000 }], [], [])
    renderAt('/app', <SpentCard />)
    expect(screen.getByRole('button', { name: 'Split it' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Just mine' }))
    expect(screen.queryByText('You paid ₹450 to Uber India')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText('You paid ₹450 to Uber India')).toBeInTheDocument()
  })

  it('the group you’re spending with is the one with the newest expense in the last three days', () => {
    const g = (id: string, archived = false) => ({ id, name: id, emoji: '👥', kind: 'trip' as const, currency: 'INR', memberIds: [ME_ID], settlements: [], createdAt: 1, updatedAt: 1, archived })
    const groups = [g('old'), g('new'), g('gone', true)]
    expect(activeGroup(groups, [{ groupId: 'old', date: '2026-11-10' }, { groupId: 'new', date: '2026-11-13' }, { groupId: 'gone', date: '2026-11-14' }], '2026-11-14')?.id).toBe('new')
    expect(activeGroup(groups, [{ groupId: 'old', date: '2026-11-01' }], '2026-11-14')).toBeNull()
  })
})
