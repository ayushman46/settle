import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { LICENSE_KEY } from '../../pro/store'
import { paywallState } from '../pro/paywall'
import { currentUrl, installPro, renderAt, resetProScreens, serveBilling, testSigner } from '../pro/testing'
import { InsightsScreen } from './InsightsScreen'

let riya: string
let sam: string

beforeEach(async () => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12))
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  updateProfile({ currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
})

function seedOctober(): void {
  saveExpense(draft({ title: 'Dinner', category: 'food', total: 300000, date: '2026-10-20', with: [riya, sam] }))
  saveExpense(draft({ title: 'Cab', category: 'transport', total: 60000, date: '2026-10-21', payerId: riya, with: [riya] }))
}

function renderInsights() {
  return renderAt('/app/insights', <InsightsScreen />)
}

describe('InsightsScreen — free', () => {
  it('shows a blurred sketch behind an honest unlock card', async () => {
    seedOctober()
    renderInsights()
    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'See where your money goes' })).toBeInTheDocument()
    expect(screen.getByText("You've split 2 expenses so far — see where it all went.")).toBeInTheDocument()
    expect(await screen.findByText(/^Pro from ₹49/)).toBeInTheDocument()
    expect(screen.queryByText(/You spent/)).not.toBeInTheDocument()
    // The sketch is decoration: nothing in it reaches assistive tech.
    expect(screen.queryByRole('img', { name: /Sample/ })).not.toBeInTheDocument()
  })

  it('opens the paywall for Insights', async () => {
    const { user } = renderInsights()
    await user.click(screen.getByRole('button', { name: 'Unlock Insights' }))
    expect(paywallState().request?.feature).toBe('insights')
    expect(await screen.findByRole('dialog', { name: 'See where your money goes' })).toBeInTheDocument()
  })

  it('unlocks in place once Pro is on', async () => {
    seedOctober()
    const token = await (await testSigner()).token()
    renderInsights()
    await act(async () => {
      window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
      window.dispatchEvent(new StorageEvent('storage', { key: LICENSE_KEY }))
    })
    expect(await screen.findByRole('heading', { name: 'You spent this month' })).toBeInTheDocument()
  })
})

describe('InsightsScreen — Pro', () => {
  beforeEach(async () => {
    await installPro()
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  })

  it('shows what I spent (my share), the biggest category and what I fronted', () => {
    seedOctober()
    renderInsights()
    const spent = screen.getByRole('region', { name: 'You spent this month' })
    // Spoken once, exactly (the big animated figure is hidden from screen readers).
    expect(within(spent).getAllByText('₹1,300').filter((el) => !el.closest('[aria-hidden="true"]'))).toHaveLength(1)
    expect(within(spent).getByText('Your share across 2 expenses · 77% on Food & drinks')).toBeInTheDocument()
    expect(within(spent).getByText('You paid up front').nextSibling).toHaveTextContent('₹3,000')
    expect(within(spent).queryByText('About a month')).not.toBeInTheDocument()
  })

  it('breaks spending down by category with a legend', async () => {
    seedOctober()
    const { user } = renderInsights()
    const legend = screen.getByRole('list', { name: 'Spending by category' })
    const food = within(legend).getByRole('button', { name: /Food & drinks/ })
    expect(food).toHaveTextContent('₹1,000')
    expect(food).toHaveTextContent('77%')
    expect(within(legend).getByRole('button', { name: /Transport/ })).toHaveTextContent('₹300')
    await user.click(food)
    expect(food).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists who I split with and opens a person', async () => {
    seedOctober()
    const { user } = renderInsights()
    const people = screen.getByRole('region', { name: 'Who you split with' })
    const rows = within(people).getAllByRole('button')
    expect(rows[0]).toHaveTextContent('Riya')
    expect(rows[0]).toHaveTextContent('2 shared expenses')
    expect(rows[0]).toHaveTextContent('₹1,300')
    expect(rows[1]).toHaveTextContent('Sam')
    await user.click(rows[0]!)
    await waitFor(() => expect(currentUrl()).toBe(`/app/friends/${riya}`))
  })

  it('switches range, adding the month chart and a monthly average', async () => {
    seedOctober()
    saveExpense(draft({ title: 'Rent', category: 'rent', total: 2000000, date: '2026-08-01', with: [riya] }))
    const { user } = renderInsights()
    expect(screen.queryByRole('img', { name: /Spending by month/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'This year' }))
    expect(screen.getByRole('radio', { name: 'This year' })).toBeChecked()
    const spent = screen.getByRole('region', { name: 'You spent this year' })
    expect(within(spent).getAllByText('₹11,300').length).toBeGreaterThan(0)
    expect(within(spent).getByText('About a month')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Spending by month: 10 bars, highest August 2026 at ₹10,000/ })).toBeInTheDocument()
  })

  it('opens on a range that has something in it', () => {
    saveExpense(draft({ title: 'Trip', category: 'travel', total: 100000, date: '2026-08-12', with: [riya] }))
    renderInsights()
    expect(screen.getByRole('radio', { name: '3 months' })).toBeChecked()
    expect(screen.getByRole('heading', { name: 'You spent in the last 3 months' })).toBeInTheDocument()
  })

  it('is kind about an empty range', async () => {
    saveExpense(draft({ title: 'Trip', category: 'travel', total: 100000, date: '2026-08-12', with: [riya] }))
    const { user } = renderInsights()
    await user.click(screen.getByRole('radio', { name: 'This month' }))
    expect(screen.getByRole('heading', { name: 'Nothing this month yet' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3 months' })).toBeInTheDocument()
  })

  it('invites a first split when there is no data at all', async () => {
    const { user } = renderInsights()
    expect(screen.getByRole('heading', { name: 'Your insights start with your first split' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split an expense' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new'))
  })

  it('says how many expenses in other currencies were left out', () => {
    seedOctober()
    saveExpense(draft({ title: 'NYC', category: 'travel', currency: 'USD', total: 5000, date: '2026-10-10', with: [riya] }))
    renderInsights()
    expect(screen.getByText(/^1 expense in another currency isn't counted here/)).toBeInTheDocument()
  })

  it('says the maths happens on the phone', () => {
    renderInsights()
    expect(screen.getByText('Worked out on this phone — nothing is uploaded.')).toBeInTheDocument()
  })
})
