import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, saveExpense, setPaidBack, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Friend } from '../../domain/types'
import { navigate } from '../../app/router'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { ActivityScreen } from './ActivityScreen'
import { forgetRowHeights } from './rowWindow'
import { FIRST_SCREEN_ROWS, forgetActivityView } from './viewMemory'

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
  vi.restoreAllMocks()
  resetProScreens()
  forgetActivityView()
  forgetRowHeights()
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

  it('moves "Today" on to "Yesterday" at midnight', async () => {
    saveExpense(draft({ title: 'Chai', date: '2026-10-22' }))
    saveExpense(draft({ title: 'Coffee', date: '2026-10-21' }))
    const { user } = renderActivity()
    expect(screen.getByRole('button', { name: /^Chai, / })).toHaveTextContent(/^Chai\s*Today/)
    vi.setSystemTime(new Date(2026, 9, 23, 0, 5))
    // Any re-render of the screen (here: a filter) picks up the new day.
    await user.click(chip('Settled'))
    await user.click(chip('All'))
    expect(screen.getByRole('button', { name: /^Chai, / })).toHaveTextContent(/^Chai\s*Yesterday/)
    expect(screen.getByRole('button', { name: /^Coffee, / })).not.toHaveTextContent(/Yesterday/)
  })

})

/**
 * A pretend phone screen for the windowed list: 800px tall, rows 72px, each month's list 100px
 * below the one before it, the first 200px down the page. `scrollTo(y)` scrolls the page.
 */
const rect = (top: number) => ({ x: 0, y: top, top, bottom: top, left: 0, right: 360, width: 360, height: 0, toJSON: () => ({}) }) as DOMRect

function fakeLayout() {
  let scrollY = 0
  vi.stubGlobal('innerHeight', 800)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'LI' ? 72 : 0
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    let y = 200 - scrollY
    for (const ul of document.querySelectorAll('section[aria-labelledby^="activity-2"] ul')) {
      if (ul === this) return rect(y)
      for (const li of ul.children) y += li.hasAttribute('data-gap') ? Number.parseFloat((li as HTMLElement).style.height) : 72
      y += 100
    }
    return rect(0)
  })
  return {
    scrollTo(y: number) {
      scrollY = y
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
    },
  }
}

/** `count` chai expenses on one day: "Chai 1" (the oldest, last in the list) to "Chai <count>". */
function chais(count: number, date = '2026-10-01') {
  const saved = Array.from({ length: count }, (_, i) => {
    // A second apart, so same-day entries list newest first.
    vi.setSystemTime(OCT_22.getTime() + i * 1000)
    return saveExpense(draft({ title: `Chai ${i + 1}`, date }))
  })
  vi.setSystemTime(OCT_22)
  return saved
}

const chaiRows = () => screen.queryAllByRole('button', { name: /^Chai \d+, / })
const gaps = () => [...document.querySelectorAll<HTMLElement>('li[data-gap]')]

describe('ActivityScreen — a long history, windowed', () => {
  it('renders the first screen of a long history, with blank space of the right height for the rest', () => {
    fakeLayout()
    chais(45)
    renderActivity()
    expect(chaiRows()).toHaveLength(FIRST_SCREEN_ROWS)
    expect(rowTitles()[0]).toBe('Chai 45')
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).not.toBeInTheDocument()
    // The 25 rows not rendered are blank space, hidden from assistive tech and not counted as items.
    expect(gaps()).toHaveLength(1)
    expect(gaps()[0]).toHaveStyle({ height: `${25 * 72}px` })
    expect(gaps()[0]).toHaveAttribute('aria-hidden', 'true')
    expect(within(screen.getByRole('region', { name: 'October' })).getAllByRole('listitem')).toHaveLength(FIRST_SCREEN_ROWS)
    expect(results()).toHaveTextContent('45 expenses')
  })

  it('renders the rows you scroll to, oldest included, and lets go of the ones far behind', async () => {
    const page = fakeLayout()
    chais(45)
    renderActivity()
    expect(screen.queryByRole('button', { name: /^Chai 1, / })).not.toBeInTheDocument()
    page.scrollTo(2000)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
    // Rows 10–44 (Chai 35 … Chai 1) are near the screen; the first ten are blank space now.
    expect(rowTitles()).toEqual(Array.from({ length: 35 }, (_, i) => `Chai ${35 - i}`))
    expect(gaps()).toHaveLength(1)
    expect(gaps()[0]).toHaveStyle({ height: `${10 * 72}px` })
    // Back to the top: the first rows come back.
    page.scrollTo(0)
    await waitFor(() => expect(rowTitles()[0]).toBe('Chai 45'))
  })

  it('keeps rows that stay on screen as the window moves, and updates the one that changed', async () => {
    const page = fakeLayout()
    const saved = chais(45)
    renderActivity()
    const before = new Map(chaiRows().map((row) => [row.getAttribute('aria-label')?.split(',')[0], row]))
    page.scrollTo(2000)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
    // Chai 35 … Chai 26 were on screen before and after: the very same elements.
    for (let n = 35; n >= 26; n -= 1) expect(screen.getByRole('button', { name: new RegExp(`^Chai ${n}, `) })).toBe(before.get(`Chai ${n}`))
    // A change to one expense still reaches its (memoised) row.
    const target = saved[29]
    act(() => {
      saveExpense({ ...draft({ title: 'Masala chai', date: '2026-10-01' }), id: target?.id })
    })
    expect(screen.getByRole('button', { name: /^Masala chai, / })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Chai 30, / })).not.toBeInTheDocument()
  })

  it('keeps every month heading, and lays out months far down without their rows', () => {
    fakeLayout()
    chais(45)
    saveExpense(draft({ title: 'Diwali sweets', date: '2026-09-28' }))
    renderActivity()
    const september = screen.getByRole('region', { name: 'September' })
    expect(within(september).getByRole('heading', { name: 'September' })).toBeInTheDocument()
    expect(within(september).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Diwali sweets, / })).not.toBeInTheDocument()
  })

  it('keeps a focused row in the list when it scrolls far away', async () => {
    const page = fakeLayout()
    chais(45)
    renderActivity()
    const first = screen.getByRole('button', { name: /^Chai 45, / })
    act(() => first.focus())
    page.scrollTo(2000)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
    expect(first).toBeInTheDocument()
    expect(first).toHaveFocus()
    // It sits in its own place, with blank space for the rows between it and the window.
    expect(rowTitles().slice(0, 2)).toEqual(['Chai 45', 'Chai 35'])
    expect(gaps()[0]).toHaveStyle({ height: `${9 * 72}px` })
    // Once focus leaves, it goes with the next scroll.
    act(() => first.blur())
    page.scrollTo(2001)
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Chai 45, / })).not.toBeInTheDocument())
  })

  it('shows the rows where the page is after a filter brings the list back', async () => {
    const page = fakeLayout()
    chais(45)
    const { user } = renderActivity()
    page.scrollTo(2000)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
    await user.click(chip('Settled'))
    expect(chaiRows()).toHaveLength(0)
    await user.click(chip('All'))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
  })

  it('remembers row heights, so coming back lays the list out exactly as it was', async () => {
    const page = fakeLayout()
    chais(45)
    const first = renderActivity()
    page.scrollTo(2000)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Chai 1, / })).toBeInTheDocument())
    first.unmount()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'LI' ? 90 : 0
    })
    renderActivity()
    // Rows 20–44 were measured at 72px last time: the blank space for them still adds up to that.
    expect(gaps()[0]).toHaveStyle({ height: `${25 * 72}px` })
  })
})
