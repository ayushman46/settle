import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { friendPath } from '../groups/paths'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { shortDate } from '../recurring/recurringLabels'
import { PaydayScreen } from './PaydayScreen'
import { friendPaydayOf, noteSalary, paydayStore, setFriendPayday, setMyPayday } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let asha: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Sunday 8 Nov 2026.
  vi.setSystemTime(new Date(2026, 10, 8, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Riya owes you ₹450, Asha ₹300; you owe Sam ₹800. */
function people(): void {
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
  asha = addFriend({ name: 'Asha' }).id
  saveExpense(draft({ title: 'Dinner', total: 90_000, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Movie', total: 60_000, participants: everyone(ME_ID, asha) }))
  saveExpense(draft({ title: 'Cab', total: 160_000, payerId: sam, participants: everyone(ME_ID, sam) }))
}

const section = (name: string) => screen.getByRole('region', { name })
const undo = () => screen.getByRole('button', { name: /^Undo/ })
const sheetGone = (name: string) => waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument(), { timeout: 4000 })

describe('PaydayScreen', () => {
  it('says what it is for, and sets your payday in one tap, with Undo', async () => {
    people()
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Payday' })).toBeInTheDocument()
    expect(screen.getByText('Ask people the day after they get paid. Clear what you owe on your own payday.')).toBeInTheDocument()
    const mine = section('Your payday')
    expect(within(mine).getByText('Tell Settle once. On that day it lines up everyone you owe, to clear in one go.')).toBeInTheDocument()
    expect(within(mine).getByRole('button', { name: 'Don’t know' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(mine).getByRole('button', { name: '1st' }))
    expect(paydayStore.get().mine).toBe(1)
    expect(within(mine).getByText(`You get paid on the 1st. Next payday: ${shortDate('2026-12-01')}.`)).toBeInTheDocument()
    expect(screen.getByText('Your payday: the 1st')).toBeInTheDocument()
    await user.click(undo())
    expect(paydayStore.get().mine).toBeNull()
    expect(within(mine).getByRole('button', { name: 'Don’t know' })).toHaveAttribute('aria-pressed', 'true')

    // "Other" opens the full picker.
    await user.click(within(mine).getByRole('button', { name: 'Other' }))
    const sheet = await screen.findByRole('dialog', { name: 'When do you get paid?' })
    await user.click(within(sheet).getByRole('button', { name: 'The 25th' }))
    expect(paydayStore.get().mine).toBe(25)
    await sheetGone('When do you get paid?')
    expect(within(mine).getByRole('button', { name: '25th' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('who to ask when: everyone who owes you, the soonest day first, the unknown last', () => {
    people()
    const dev = addFriend({ name: 'Dev' }).id
    saveExpense(draft({ title: 'Lunch', total: 40_000, participants: everyone(ME_ID, dev) }))
    setFriendPayday(riya, 7) // yesterday
    setFriendPayday(dev, 8) // today
    setFriendPayday(sam, 7) // owes you nothing: not listed
    renderAt('/app/payday', <PaydayScreen />)
    const rows = within(section('Who to ask when')).getAllByRole('button')
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Riya owes you ₹450. Ask today. Payday was yesterday',
      'Dev owes you ₹200. Ask tomorrow. Payday is today',
      'Asha owes you ₹300. Payday not known. Tap to add it',
    ])
    expect(rows[0]).toHaveTextContent('Ask today · Payday was yesterday')
    expect(rows[0]).toHaveTextContent('₹450')
  })

  it('a person whose payday isn’t known: one tap adds it, and the day to ask appears', async () => {
    people()
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    await user.click(screen.getByRole('button', { name: 'Asha owes you ₹300. Payday not known. Tap to add it' }))
    const sheet = await screen.findByRole('dialog', { name: 'When does Asha get paid?' })
    expect(within(sheet).getByText('Pick the day of the month. Only you see it.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'The 10th' }))
    expect(friendPaydayOf(asha)).toBe(10)
    await sheetGone('When does Asha get paid?')
    expect(screen.getByText('Asha gets paid on the 10th')).toBeInTheDocument()
    const ask = `Asha owes you ₹300. Ask on ${shortDate('2026-11-11')}. Gets paid on the 10th`
    expect(screen.getByRole('button', { name: ask })).toBeInTheDocument()
    // Asha now comes before Riya, whose payday still isn't known.
    const rows = within(section('Who to ask when')).getAllByRole('button')
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([ask, 'Riya owes you ₹450. Payday not known. Tap to add it'])

    await user.click(undo())
    expect(friendPaydayOf(asha)).toBeNull()
    expect(screen.getByRole('button', { name: 'Asha owes you ₹300. Payday not known. Tap to add it' })).toBeInTheDocument()
  })

  it('a person whose payday is known opens their page, where the reminder is', async () => {
    people()
    setFriendPayday(riya, 7)
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    await user.click(screen.getByRole('button', { name: 'Riya owes you ₹450. Ask today. Payday was yesterday' }))
    expect(currentUrl()).toBe(friendPath(riya))
  })

  it('friends’ paydays: everyone by name, set or changed from the list', async () => {
    people()
    setFriendPayday(riya, 7)
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    const list = section('Friends’ paydays')
    expect(within(list).getAllByRole('button').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Asha: Not set. Change',
      'Riya Sharma: Gets paid on the 7th. Change',
      'Sam: Not set. Change',
    ])
    await user.click(within(list).getByRole('button', { name: 'Sam: Not set. Change' }))
    const sheet = await screen.findByRole('dialog', { name: 'When does Sam get paid?' })
    await user.click(within(sheet).getByRole('button', { name: 'Last day of the month' }))
    expect(friendPaydayOf(sam)).toBe('last')
    await sheetGone('When does Sam get paid?')
    expect(within(list).getByRole('button', { name: 'Sam: Gets paid on the last day of the month. Change' })).toBeInTheDocument()

    // "Don't know" in the sheet forgets it.
    await user.click(within(list).getByRole('button', { name: 'Riya Sharma: Gets paid on the 7th. Change' }))
    const riyaSheet = await screen.findByRole('dialog', { name: 'When does Riya get paid?' })
    expect(within(riyaSheet).getByRole('button', { name: 'The 7th' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(riyaSheet).getByRole('button', { name: 'Don’t know' }))
    expect(friendPaydayOf(riya)).toBeNull()
    await sheetGone('When does Riya get paid?')
    expect(screen.getByText('Riya’s payday is forgotten')).toBeInTheDocument()
  })

  it('a long list of friends starts short, with the rest one tap away', async () => {
    for (let i = 1; i <= 11; i++) addFriend({ name: `Friend ${String(i).padStart(2, '0')}` })
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    const list = section('Friends’ paydays')
    expect(within(list).getAllByRole('button', { name: /Change$/ })).toHaveLength(8)
    await user.click(within(list).getByRole('button', { name: 'Show all 11' }))
    expect(within(list).getAllByRole('button', { name: /Change$/ })).toHaveLength(11)
    expect(within(list).queryByRole('button', { name: 'Show all 11' })).not.toBeInTheDocument()
  })

  it('with nobody owing you: says what will show here, and offers to add a split', async () => {
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    expect(screen.getByRole('heading', { name: 'Nobody owes you right now' })).toBeInTheDocument()
    expect(screen.getByText('When someone does, Settle shows the best day to ask: the day after their payday.')).toBeInTheDocument()
    // No friends yet: no list of them either.
    expect(screen.queryByRole('region', { name: 'Friends’ paydays' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a split' }))
    expect(currentUrl()).toBe('/app/split/new')
  })

  it('offers a payday worked out from salary alerts, and never sets it by itself', async () => {
    noteSalary('2026-09-30')
    noteSalary('2026-10-30')
    const { user } = renderAt('/app/payday', <PaydayScreen />)
    expect(screen.getByRole('heading', { name: 'Looks like you get paid on the 30th. Remember it?' })).toBeInTheDocument()
    expect(paydayStore.get().mine).toBeNull()
    expect(within(section('Your payday')).getByRole('button', { name: 'Don’t know' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Remember it' }))
    expect(paydayStore.get().mine).toBe(30)
    expect(within(section('Your payday')).getByRole('button', { name: '30th' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('your own payday is not a reason to list yourself', () => {
    people()
    setMyPayday(7)
    renderAt('/app/payday', <PaydayScreen />)
    expect(within(section('Friends’ paydays')).queryByRole('button', { name: /^You:/ })).not.toBeInTheDocument()
    expect(within(section('Friends’ paydays')).queryByRole('button', { name: /^Ayush:/ })).not.toBeInTheDocument()
  })
})
