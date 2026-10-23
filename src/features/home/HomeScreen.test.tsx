import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, saveRecurring, setPaidBack, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { loadSession, saveSession } from '../../state/persist'
import { reducer } from '../../state/reducer'
import { newBillAction } from '../bill/boot'
import { takeBillStart } from '../bill/launch'
import { paywallState } from '../pro/paywall'
import { currentHour, greetingName, helloLine, timeOfDayGreeting } from './greeting'
import { draftLine } from './homeLinks'
import { atTime, currentUrl, installPro, renderHome, resetHome, seedExpense, serveHealth, testSigner } from './testKit'

/** Typing-heavy tests: room to finish on a busy machine. */
const SLOW = { timeout: 20_000 }

const OCT_22_EVENING = new Date(2026, 9, 22, 19, 30)

beforeEach(async () => {
  resetHome()
  atTime(OCT_22_EVENING)
  await testSigner()
  serveHealth()
  updateProfile({ name: 'Ayush Mehta', currency: 'INR', onboarded: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetHome()
})

describe('HomeScreen — greeting', SLOW, () => {
  it('greets the owner by first name with the time of day', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeInTheDocument()
    expect(screen.getByText('Good evening')).toBeInTheDocument()
  })

  it('says “Hi there” to someone who skipped their name', () => {
    updateProfile({ name: 'You' })
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Hi there' })).toBeInTheDocument()
  })

  it('offers Pro quietly, and opens You from the avatar', async () => {
    const { user } = renderHome()
    expect(screen.getByRole('link', { name: 'Go Pro' })).toHaveAttribute('href', '/app/pro')
    await user.click(screen.getByRole('link', { name: 'You: profile and settings' }))
    expect(currentUrl()).toBe('/app/you')
  })

  it('shows the Pro badge with Pro on', async () => {
    await installPro()
    renderHome()
    expect(screen.queryByRole('link', { name: 'Go Pro' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settle Pro is on' })).toHaveTextContent('Pro')
  })

  it('asks to renew once a pass has ended', async () => {
    const now = Math.floor(Date.now() / 1000)
    await installPro({ plan: 'pro_monthly', iat: now - 40 * 86_400, exp: now - 86_400 })
    renderHome()
    expect(screen.getByRole('link', { name: 'Renew Pro' })).toHaveAttribute('href', '/app/pro')
  })
})

describe('HomeScreen — first run', SLOW, () => {
  it('invites a first split instead of balances and activity', async () => {
    const { user } = renderHome()
    expect(screen.getByRole('heading', { name: 'Split your first expense' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your balance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recent activity' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split an expense' }))
    expect(currentUrl()).toBe('/app/split/new')
  })

  it('opens the sample bill', async () => {
    const { user } = renderHome()
    await user.click(screen.getByRole('button', { name: 'Try a sample bill' }))
    expect(currentUrl()).toBe('/app/bill')
    expect(takeBillStart()).toEqual({ kind: 'sample' })
  })

  it('still offers adding people', () => {
    renderHome()
    const people = screen.getByRole('region', { name: 'People' })
    expect(within(people).getByRole('link', { name: 'Add a person' })).toHaveAttribute('href', '/app/friends?new=1')
    expect(within(people).queryByRole('link', { name: 'See all people' })).not.toBeInTheDocument()
  })
})

describe('HomeScreen — quick actions', SLOW, () => {
  it.each([
    ['Split amount', '/app/split/new'],
    ['New group', '/app/groups?new=1'],
    ['Rent', '/app/split/new?category=rent'],
    ['Trip', '/app/split/new?category=travel'],
    ['Subscription', '/app/split/new?category=subscription'],
    ['Utilities', '/app/split/new?category=utilities'],
  ])('%s opens %s', async (label, url) => {
    const { user } = renderHome()
    await user.click(within(screen.getByRole('list', { name: 'Quick actions' })).getByRole('button', { name: label }))
    expect(currentUrl()).toBe(url)
  })

  it('Scan bill opens the bill flow on its scan step', async () => {
    const { user } = renderHome()
    await user.click(screen.getByRole('button', { name: 'Scan bill' }))
    expect(currentUrl()).toBe('/app/bill')
    expect(takeBillStart()).toBeNull()
  })

  it('lists eight actions, scan first and More last (features that are off are left out)', () => {
    renderHome()
    const grid = screen.getByRole('list', { name: 'Quick actions' })
    expect(within(grid).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Scan bill',
      'Split amount',
      'New group',
      'Rent',
      'Trip',
      'Subscription',
      'Utilities',
      'More',
    ])
  })

  it('More opens every everyday template; Cab starts a cab split', async () => {
    const { user } = renderHome()
    await user.click(within(screen.getByRole('list', { name: 'Quick actions' })).getByRole('button', { name: 'More' }))
    const sheet = await screen.findByRole('dialog', { name: 'More ways to split' })
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent).filter((t) => t !== 'Close')).toEqual(
      expect.arrayContaining(['Rent', 'Trip', 'Subscription', 'Utilities', 'Cab']),
    )
    await user.click(within(sheet).getByRole('button', { name: 'Cab' }))
    expect(currentUrl()).toBe('/app/split/new?category=transport')
  })
})

describe('HomeScreen — balances, people and activity', SLOW, () => {
  it('shows what you’re owed and settles up with your people', async () => {
    const riya = addFriend({ name: 'Riya Sharma' }).id
    const sam = addFriend({ name: 'Sam' }).id
    seedExpense({ title: 'Dinner', total: 90000, with: [riya, sam] })
    const { user } = renderHome()

    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(card).toHaveTextContent('₹600')
    await user.click(within(card).getByRole('button', { name: /Settle up/ }))
    expect(currentUrl()).toBe('/app/friends')
  })

  it('says all settled once everyone has paid back', () => {
    const riya = addFriend({ name: 'Riya' }).id
    const e = seedExpense({ with: [riya] })
    setPaidBack(e.id, riya, true)
    renderHome()
    expect(screen.getByRole('heading', { name: 'All settled up' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Split your first expense' })).not.toBeInTheDocument()
  })

  it('counts a group with no expenses as data (no first-run invite)', () => {
    createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID] })
    renderHome()
    expect(screen.queryByRole('heading', { name: 'Split your first expense' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All settled up' })).toBeInTheDocument()
  })

  it('lists your people with what’s out between you, and links to each', async () => {
    const riya = addFriend({ name: 'Riya Sharma' }).id
    const sam = addFriend({ name: 'Sam' }).id
    addFriend({ name: 'Neha' })
    seedExpense({ total: 90000, with: [riya] })
    seedExpense({ title: 'Cab', total: 40000, payerId: sam, with: [sam] })
    const { user } = renderHome()

    const people = screen.getByRole('region', { name: 'People' })
    expect(within(people).getByRole('link', { name: 'Riya Sharma, owes you ₹450' })).toHaveTextContent('Riya₹450')
    expect(within(people).getByRole('link', { name: 'Sam, you owe ₹200' })).toBeInTheDocument()
    expect(within(people).getByRole('link', { name: 'Neha' })).not.toHaveTextContent('₹')
    expect(within(people).queryByRole('link', { name: /^You/ })).not.toBeInTheDocument()

    await user.click(within(people).getByRole('link', { name: /^Riya Sharma/ }))
    expect(currentUrl()).toBe(`/app/friends/${riya}`)
  })

  it('shows seven people at most, with See all', () => {
    for (const name of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9']) addFriend({ name })
    renderHome()
    const people = screen.getByRole('region', { name: 'People' })
    expect(within(people).getAllByRole('link')).toHaveLength(9) // See all + 7 people + Add
    expect(within(people).getByRole('link', { name: 'See all people' })).toHaveAttribute('href', '/app/friends')
  })

  it('shows the three latest expenses, newest first, each opening its detail', async () => {
    const riya = addFriend({ name: 'Riya' }).id
    seedExpense({ title: 'Lunch', date: '2026-10-18', with: [riya] })
    seedExpense({ title: 'Movie', date: '2026-10-22', with: [riya] })
    const groceries = seedExpense({ title: 'Groceries', category: 'groceries', date: '2026-10-21', with: [riya] })
    seedExpense({ title: 'Old cab', date: '2026-09-01', with: [riya] })
    const { user } = renderHome()

    const recent = screen.getByRole('region', { name: 'Recent activity' })
    const rows = within(recent).getAllByRole('button')
    expect(rows.map((r) => r.getAttribute('aria-label')?.split(',')[0])).toEqual(['Movie', 'Groceries', 'Lunch'])
    expect(within(recent).getByRole('link', { name: 'See all activity' })).toHaveAttribute('href', '/app/activity')

    await user.click(within(recent).getByRole('button', { name: /^Groceries/ }))
    expect(currentUrl()).toBe(`/app/expense/${groceries.id}`)
  })
})

describe('HomeScreen — due recurring splits', SLOW, () => {
  function seedRent(): void {
    const riya = addFriend({ name: 'Riya' }).id
    vi.setSystemTime(new Date(2026, 8, 1, 12))
    saveRecurring({
      title: 'Rent',
      category: 'rent',
      currency: 'INR',
      total: 3200000,
      payerId: ME_ID,
      mode: 'equal',
      participants: [ME_ID, riya].map((friendId) => ({ friendId, input: null })),
      dayOfMonth: 25,
      groupId: null,
      active: true,
    })
    vi.setSystemTime(OCT_22_EVENING)
  }

  it('shows what’s due with one-tap Split now (Pro unlocks it)', async () => {
    seedRent()
    const { user } = renderHome()
    const due = screen.getByRole('region', { name: 'Due soon' })
    expect(within(due).getByRole('heading', { name: 'Rent' })).toBeInTheDocument()
    expect(within(due).getByText('Due in 3 days')).toBeInTheDocument()
    expect(within(due).getByText('₹32,000')).toBeInTheDocument()

    await user.click(within(due).getByRole('button', { name: 'Split Rent for October now' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'recurring' } })
  })

  it('splits it straight away with Pro, then opens the new expense', async () => {
    await installPro()
    seedRent()
    const { user } = renderHome()
    await user.click(screen.getByRole('button', { name: 'Split Rent for October now' }))
    const moment = await screen.findByRole('dialog', { name: 'Rent split' })
    await user.click(moment)
    await waitFor(() => expect(currentUrl()).toMatch(/^\/app\/expense\/.+/))
  })

  it('stays out of the way when nothing is due', () => {
    renderHome()
    expect(screen.queryByRole('region', { name: 'Due soon' })).not.toBeInTheDocument()
  })
})

describe('HomeScreen — a bill in progress', SLOW, () => {
  it('offers to pick a half-split bill back up', async () => {
    saveSession(reducer(loadSession(null), newBillAction('sample', 'INR')))
    const { user } = renderHome()
    const card = screen.getByRole('button', { name: /^Continue your bill/ })
    expect(card).toHaveTextContent(/\d+ items · ₹/)
    await user.click(card)
    expect(currentUrl()).toBe('/app/bill')
    expect(takeBillStart()).toEqual({ kind: 'resume' })
  })

  it('describes the draft briefly', () => {
    expect(
      draftLine({ title: 'Taj Café', items: 6, total: 234000, currency: 'INR', people: 3, step: 'assign', editing: false }),
    ).toBe('Taj Café · 6 items · ₹2,340')
    expect(draftLine({ title: null, items: 1, total: 0, currency: 'INR', people: 0, step: 'review', editing: false })).toBe(
      'Bill in progress · 1 item',
    )
    expect(draftLine({ title: '  ', items: 0, total: 0, currency: 'INR', people: 0, step: 'result', editing: true })).toBe('Saved bill')
  })
})

describe('HomeScreen — Just say it', SLOW, () => {
  it('opens the AI sheet from the hero field', async () => {
    const { user } = renderHome()
    await user.click(screen.getByRole('button', { name: /^Just say it/ }))
    expect(await screen.findByRole('dialog', { name: 'Just say it' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Describe the expense' })).toHaveFocus()
  })
})

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(timeOfDayGreeting(5)).toBe('Good morning')
    expect(timeOfDayGreeting(11)).toBe('Good morning')
    expect(timeOfDayGreeting(12)).toBe('Good afternoon')
    expect(timeOfDayGreeting(16)).toBe('Good afternoon')
    expect(timeOfDayGreeting(17)).toBe('Good evening')
    expect(timeOfDayGreeting(2)).toBe('Good evening')
    expect(currentHour()).toBe(19)
  })

  it('uses a first name, never a placeholder', () => {
    expect(greetingName('Riya Sharma')).toBe('Riya')
    expect(greetingName('  ')).toBeNull()
    expect(greetingName('You')).toBeNull()
    expect(greetingName('me')).toBeNull()
    expect(helloLine('Ayush')).toBe('Hi, Ayush')
    expect(helloLine('')).toBe('Hi there')
  })
})
