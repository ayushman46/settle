import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, saveExpense, setPaidBack, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Friend } from '../../domain/types'
import { navigate } from '../../app/router'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { ActivityScreen } from './ActivityScreen'
import { ACTIVITY_PAGE, forgetActivityView, rememberedActivityView } from './viewMemory'

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: Friend
let sam: Friend

beforeEach(() => {
  resetProScreens()
  forgetActivityView()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
  riya = addFriend({ name: 'Riya' })
  sam = addFriend({ name: 'Sam' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
  forgetActivityView()
})

function renderActivity(path = '/app/activity') {
  return renderAt(path, <ActivityScreen />)
}

/** A typical history: something to collect, something to pay, one settled, one just mine. */
function seed() {
  const dinner = saveExpense(draft({ title: 'Dinner at Toit', total: 240000, date: '2026-10-20', with: [riya.id, sam.id] }))
  const cab = saveExpense(draft({ title: 'Cab to airport', payerId: sam.id, total: 108000, date: '2026-10-18', with: [sam.id] }))
  const movie = saveExpense(draft({ title: 'Movie', total: 60000, date: '2026-09-28', with: [riya.id] }))
  setPaidBack(movie.id, riya.id, true)
  const coffee = saveExpense(draft({ title: 'Coffee', total: 25000, date: '2026-09-02' }))
  return { dinner, cab, movie, coffee }
}

/** The line summing up the list (the toast's live region is another status, outside the page). */
const results = () => within(screen.getByRole('main')).getByRole('status')
const filters = () => screen.getByRole('group', { name: 'Show' })
const chip = (name: RegExp | string) => within(filters()).getByRole('button', { name })
const rowTitles = () =>
  screen
    .queryAllByRole('button', { name: /, .*20\d\d, / })
    .map((row) => row.getAttribute('aria-label')?.split(',')[0])

describe('ActivityScreen — first run', () => {
  it('invites a first split, with no search or filters to get in the way', async () => {
    const { user } = renderActivity()
    expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your splits will live here' })).toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split an amount' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new'))
  })

  it('opens the bill scanner from the empty state', async () => {
    const { user } = renderActivity()
    await user.click(screen.getByRole('button', { name: 'Scan a bill' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/bill'))
  })

  it('always offers a new split from the floating button', async () => {
    seed()
    const { user } = renderActivity()
    await user.click(screen.getByRole('button', { name: 'New split' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new'))
  })
})

describe('ActivityScreen — the list', () => {
  it('lists everything newest first, in month sections', () => {
    seed()
    renderActivity()
    const october = screen.getByRole('region', { name: 'October' })
    const september = screen.getByRole('region', { name: 'September' })
    expect(within(october).getAllByRole('listitem')).toHaveLength(2)
    expect(within(september).getAllByRole('listitem')).toHaveLength(2)
    expect(rowTitles()).toEqual(['Dinner at Toit', 'Cab to airport', 'Movie', 'Coffee'])
    expect(results()).toHaveTextContent('4 expenses')
  })

  it('says what each one means for me', () => {
    seed()
    renderActivity()
    expect(screen.getByRole('button', { name: /^Dinner at Toit,/ })).toHaveAccessibleName(/you're owed ₹1,600, 2 pending/)
    expect(screen.getByRole('button', { name: /^Cab to airport,/ })).toHaveAccessibleName(/you owe ₹540/)
  })

  it('opens an expense', async () => {
    const { dinner } = seed()
    const { user } = renderActivity()
    await user.click(screen.getByRole('button', { name: /^Dinner at Toit,/ }))
    await waitFor(() => expect(currentUrl()).toBe(`/app/expense/${dinner.id}`))
  })

  it('names the year for months from other years', () => {
    saveExpense(draft({ title: 'New year party', date: '2025-12-31' }))
    renderActivity()
    expect(screen.getByRole('region', { name: 'December 2025' })).toBeInTheDocument()
  })

  it('stays live as things change elsewhere', () => {
    const { dinner } = seed()
    renderActivity()
    act(() => {
      setPaidBack(dinner.id, riya.id, true)
    })
    expect(screen.getByRole('button', { name: /^Dinner at Toit,/ })).toHaveAccessibleName(/you're owed ₹800, 1 pending/)
  })
})

describe('ActivityScreen — filters', () => {
  it('counts what needs doing on the chips', () => {
    seed()
    renderActivity()
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('To collect, 1')).toHaveAttribute('aria-pressed', 'false')
    expect(chip('To pay, 1')).toBeInTheDocument()
    expect(chip('Settled')).toBeInTheDocument()
  })

  it('shows only what is still to collect, with the total', async () => {
    seed()
    const { user } = renderActivity()
    await user.click(chip(/^To collect/))
    expect(chip(/^To collect/)).toHaveAttribute('aria-pressed', 'true')
    expect(rowTitles()).toEqual(['Dinner at Toit'])
    expect(results()).toHaveTextContent('₹1,600 to collect on 1 split')
  })

  it('shows what I owe, and what is settled', async () => {
    seed()
    const { user } = renderActivity()
    await user.click(chip(/^To pay/))
    expect(rowTitles()).toEqual(['Cab to airport'])
    expect(results()).toHaveTextContent('You owe ₹540 on 1 split')
    await user.click(chip('Settled'))
    expect(rowTitles()).toEqual(['Movie'])
  })

  it('points at groups that are not square, to settle them there', async () => {
    seed()
    const goa = createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    saveExpense(draft({ title: 'Villa', groupId: goa.id, total: 400000, date: '2026-10-10', with: [riya.id] }))
    const { user } = renderActivity()
    // One split and one group to collect from.
    expect(chip('To collect, 2')).toBeInTheDocument()
    await user.click(chip(/^To collect/))
    const groups = screen.getByRole('region', { name: 'Owed to you in groups' })
    const row = within(groups).getByRole('button', { name: "Goa trip: You're owed ₹2,000. Settle up" })
    // The group's own expense isn't listed one by one: it settles with the group.
    expect(rowTitles()).toEqual(['Dinner at Toit'])
    await user.click(row)
    await waitFor(() => expect(currentUrl()).toBe(`/app/groups/${goa.id}/settle`))
  })

  it('shows group expenses and bills under their own chips', async () => {
    seed()
    const goa = createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    saveExpense(draft({ title: 'Villa', groupId: goa.id, date: '2026-10-10', with: [riya.id] }))
    const { user } = renderActivity()
    await user.click(chip('Groups'))
    expect(rowTitles()).toEqual(['Villa'])
    await user.click(chip('Bills'))
    expect(screen.getByRole('heading', { name: 'No bills yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Scan a bill' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/bill'))
  })

  it('says so kindly when a filter is empty', async () => {
    saveExpense(draft({ title: 'Lunch', with: [riya.id] }))
    const { user } = renderActivity()
    await user.click(chip('To pay'))
    expect(screen.getByRole('heading', { name: "You're all square" })).toBeInTheDocument()
    expect(results()).toHaveTextContent('Nothing to pay')
  })

  it('opens on a filter from the link (?filter=pay)', () => {
    seed()
    renderActivity('/app/activity?filter=pay')
    expect(chip(/^To pay/)).toHaveAttribute('aria-pressed', 'true')
    expect(rowTitles()).toEqual(['Cab to airport'])
  })

  it('follows a link to another filter while it is on screen', async () => {
    seed()
    const { user } = renderActivity()
    await user.type(screen.getByRole('searchbox'), 'dinner')
    act(() => navigate('/app/activity?filter=collect', { replace: true }))
    expect(chip(/^To collect/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(rowTitles()).toEqual(['Dinner at Toit'])
  })
})

describe('ActivityScreen — search', () => {
  it('filters as you type, by name, place or amount', async () => {
    seed()
    const { user } = renderActivity()
    const search = within(screen.getByRole('search')).getByRole('searchbox', { name: 'Search activity' })
    await user.type(search, 'sam')
    expect(rowTitles()).toEqual(['Dinner at Toit', 'Cab to airport'])
    expect(results()).toHaveTextContent('2 matches for “sam”')
    await user.clear(search)
    await user.type(search, '600')
    expect(rowTitles()).toEqual(['Movie'])
  })

  it('searches within the chosen filter', async () => {
    seed()
    const { user } = renderActivity()
    await user.click(chip(/^To pay/))
    await user.type(screen.getByRole('searchbox'), 'sam')
    expect(rowTitles()).toEqual(['Cab to airport'])
  })

  it('offers a way back from a search that finds nothing; Escape and ✕ clear it too', async () => {
    seed()
    const { user } = renderActivity()
    const search = screen.getByRole('searchbox')
    await user.click(chip(/^To pay/))
    await user.type(search, 'goa')
    expect(screen.getByRole('heading', { name: 'No matches for “goa”' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all activity' }))
    expect(search).toHaveValue('')
    expect(chip('All')).toHaveAttribute('aria-pressed', 'true')
    expect(rowTitles()).toHaveLength(4)

    await user.type(search, 'cab')
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')

    await user.type(search, 'cab')
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }))
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
  })
})

describe('ActivityScreen — memory and long lists', () => {
  it('comes back to the same filter and search after opening an expense', async () => {
    seed()
    const first = renderActivity()
    await first.user.click(chip(/^To pay/))
    await first.user.type(screen.getByRole('searchbox'), 'cab')
    first.unmount()

    renderActivity()
    expect(chip(/^To pay/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox')).toHaveValue('cab')
    expect(rowTitles()).toEqual(['Cab to airport'])
  })

  it('loads a long history a page at a time', async () => {
    for (let i = 0; i < ACTIVITY_PAGE + 5; i += 1) {
      saveExpense(draft({ title: `Chai ${i + 1}`, date: '2026-10-01' }))
    }
    const { user } = renderActivity()
    expect(rowTitles()).toHaveLength(ACTIVITY_PAGE)
    await user.click(screen.getByRole('button', { name: 'Show 5 more' }))
    expect(rowTitles()).toHaveLength(ACTIVITY_PAGE + 5)
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).not.toBeInTheDocument()
    expect(rememberedActivityView().limit).toBe(ACTIVITY_PAGE * 2)
  })

  it('starts a new filter from the first page', async () => {
    for (let i = 0; i < ACTIVITY_PAGE + 5; i += 1) saveExpense(draft({ title: `Chai ${i + 1}`, date: '2026-10-01' }))
    const { user } = renderActivity()
    await user.click(screen.getByRole('button', { name: 'Show 5 more' }))
    await user.click(chip('Settled'))
    await user.click(chip('All'))
    expect(rowTitles()).toHaveLength(ACTIVITY_PAGE)
  })
})
