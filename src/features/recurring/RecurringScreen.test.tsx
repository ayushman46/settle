import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, recurringStore, saveRecurring, updateProfile, type RecurringDraft } from '../../data'
import { ME_ID, type RecurringTemplate } from '../../domain/types'
import { paywallState } from '../pro/paywall'
import { currentUrl, DAY_SECONDS, installPro, renderAt, resetProScreens, serveBilling, testSigner } from '../pro/testing'
import { RecurringScreen } from './RecurringScreen'

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string
let sam: string

beforeEach(async () => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  updateProfile({ currency: 'INR', name: 'Ayush' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
})

/** Saves a template as if set up on `createdOn` (it never asks for months before then). */
function seed(patch: Partial<RecurringDraft> = {}, createdOn: Date = new Date(2026, 8, 1, 12)): RecurringTemplate {
  vi.setSystemTime(createdOn)
  const saved = saveRecurring({
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 3000000,
    payerId: ME_ID,
    mode: 'equal',
    participants: [ME_ID, riya, sam].map((friendId) => ({ friendId, input: null })),
    dayOfMonth: 25,
    groupId: null,
    active: true,
    ...patch,
  })
  vi.setSystemTime(OCT_22)
  return saved
}

function renderRecurring() {
  return renderAt('/app/recurring', <RecurringScreen />)
}

const now = () => Math.floor(Date.now() / 1000)

describe('RecurringScreen — free', () => {
  it('shows the lock with a sketch, and unlocks through the paywall', async () => {
    const { user } = renderRecurring()
    expect(screen.getByRole('heading', { level: 1, name: 'Recurring splits' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recurring splits are part of Pro' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New recurring split' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unlock recurring splits' }))
    expect(paywallState().request?.feature).toBe('recurring')
    expect(await screen.findByRole('dialog', { name: 'Recurring splits are part of Pro' })).toBeInTheDocument()
  })

  it('keeps templates visible (paused) after a pass ends, and gates splitting', async () => {
    seed()
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    const { user } = renderRecurring()
    expect(screen.getByText('Your Pro pass has ended')).toBeInTheDocument()
    expect(screen.getByText(/all still here, nothing deleted/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Split Rent for October now$/ }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'recurring' } })
    expect(expensesStore.get()).toHaveLength(0)
  })

  it('gates a new recurring split behind the paywall when a pass has ended', async () => {
    seed()
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    const { user } = renderRecurring()
    await user.click(screen.getByRole('button', { name: 'New recurring split' }))
    expect(paywallState().request?.feature).toBe('recurring')
    expect(currentUrl()).toBe('/app/recurring')
  })
})

describe('RecurringScreen — Pro', () => {
  beforeEach(async () => {
    await installPro()
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  })

  it('invites a first one, with quick starts', async () => {
    const { user } = renderRecurring()
    expect(screen.getByRole('heading', { name: 'Set it once, split it every month' })).toBeInTheDocument()
    const quick = screen.getByRole('group', { name: 'Quick start' })
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rent', 'Wi-Fi', 'Electricity', 'Netflix', 'House help'])
    await user.click(within(quick).getByRole('button', { name: 'Wi-Fi' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring/new?preset=wifi'))
  })

  it('starts a new one from the button', async () => {
    const { user } = renderRecurring()
    await user.click(screen.getAllByRole('button', { name: 'New recurring split' })[0]!)
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring/new'))
  })

  it('puts what is due first, with what it means for me', () => {
    seed()
    renderRecurring()
    const due = screen.getByRole('region', { name: 'Due now' })
    const card = within(due).getByRole('article', { name: 'Rent' })
    expect(within(card).getByText('Due in 3 days')).toBeInTheDocument()
    expect(within(card).getByText('October')).toBeInTheDocument()
    expect(within(card).getByText('₹30,000')).toBeInTheDocument()
    expect(within(card).getByText("You'll be owed ₹20,000")).toBeInTheDocument()
  })

  it('marks overdue ones and lists the rest with when they are next', () => {
    seed({ title: 'Wi-Fi', category: 'utilities', total: 117900, dayOfMonth: 5 })
    seed({ title: 'Netflix', category: 'subscription', total: 64900, dayOfMonth: 1 }, OCT_22)
    seed({ title: 'Gym', category: 'health', total: 200000, dayOfMonth: 10, active: false })
    renderRecurring()
    const due = screen.getByRole('region', { name: 'Due now' })
    expect(within(due).getByRole('article', { name: 'Wi-Fi' })).toHaveTextContent(/Overdue since/)
    expect(within(due).queryByRole('article', { name: 'Netflix' })).not.toBeInTheDocument()

    const all = screen.getByRole('region', { name: 'All recurring splits' })
    const netflix = within(all).getByRole('button', { name: /Netflix/ })
    expect(netflix).toHaveTextContent('₹649 · every month on the 1st · 3 people')
    expect(netflix).toHaveTextContent(/Next: .*Nov/)

    const paused = screen.getByRole('region', { name: 'Paused' })
    expect(within(paused).getByRole('button', { name: /Gym/ })).toHaveTextContent('Paused')
  })

  it('opens a recurring split to edit it', async () => {
    const rent = seed()
    const { user } = renderRecurring()
    await user.click(within(screen.getByRole('region', { name: 'All recurring splits' })).getByRole('button', { name: /Rent/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/recurring/${rent.id}`))
  })

  it('splits now: creates this month’s expense once, celebrates, then opens it', async () => {
    const rent = seed()
    const { user } = renderRecurring()
    await user.click(screen.getByRole('button', { name: 'Split Rent for October now' }))

    const burst = await screen.findByRole('dialog', { name: 'Rent split' })
    expect(within(burst).getByText("For October · You're owed ₹20,000")).toBeInTheDocument()
    const [expense] = expensesStore.get()
    expect(expense).toMatchObject({ title: 'Rent', total: 3000000, date: '2026-10-25', recurringId: rent.id, source: 'recurring' })
    expect(recurringStore.get()[0]?.lastCreatedPeriod).toBe('2026-10')

    await user.click(burst)
    await waitFor(() => expect(currentUrl()).toBe(`/app/expense/${expense!.id}`))
  })

  it('takes a split off "Due now" once it has been split', async () => {
    seed()
    const { user } = renderRecurring()
    await user.click(screen.getByRole('button', { name: 'Split Rent for October now' }))
    await screen.findByRole('dialog', { name: 'Rent split' })
    expect(screen.queryByRole('region', { name: 'Due now' })).not.toBeInTheDocument()
  })

  it('explains a split that no longer adds up, with a way to fix it', async () => {
    seed({ mode: 'exact', participants: [{ friendId: ME_ID, input: 1000000 }, { friendId: riya, input: 2000000 }] })
    // The exact amounts stop adding up (e.g. an older backup restored over it): the split can't be made.
    recurringStore.update((list) => list.map((t) => ({ ...t, participants: [{ friendId: ME_ID, input: 1000000 }] })))
    const { user } = renderRecurring()
    await user.click(screen.getByRole('button', { name: 'Split Rent for October now' }))
    expect(await screen.findByText(/^Couldn't split Rent\. The amounts don't add up/)).toBeInTheDocument()
    expect(expensesStore.get()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /^Edit: Couldn't split Rent/ }))
    await waitFor(() => expect(currentUrl()).toMatch(/^\/app\/recurring\/.+/))
  })

  it('splits from a paywall unlock straight away', async () => {
    resetProScreens()
    vi.setSystemTime(OCT_22)
    riya = addFriend({ name: 'Riya' }).id
    sam = addFriend({ name: 'Sam' }).id
    seed()
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    serveBilling({ checkout: null, keyId: null })
    const token = await (await testSigner()).token({ plan: 'pro_yearly' })
    const { user } = renderRecurring()
    await user.click(screen.getByRole('button', { name: 'Split Rent for October now' }))
    const sheet = await screen.findByRole('dialog', { name: 'Recurring splits are part of Pro' })
    await user.click((await within(sheet).findAllByRole('button', { name: 'Redeem a code' }))[0]!)
    const redeem = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await user.click(within(redeem).getByLabelText('Pro code'))
    await user.paste(token)
    await user.click(within(redeem).getByRole('button', { name: 'Redeem' }))
    await user.click(await screen.findByRole('dialog', { name: 'Pro unlocked' }))
    expect(await screen.findByRole('dialog', { name: 'Rent split' })).toBeInTheDocument()
    expect(expensesStore.get()).toHaveLength(1)
  })
})
