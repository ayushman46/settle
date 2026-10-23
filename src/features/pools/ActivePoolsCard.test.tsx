import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, updateProfile } from '../../data'
import { addContribution, savePool, setPoolClosed, type PoolDraft } from '../../data/pools'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { ActivePoolsCard } from './ActivePoolsCard'

function draft(title: string, extra: Partial<PoolDraft> = {}): PoolDraft {
  return {
    title,
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: [],
    expectedCount: null,
    deadline: null,
    note: null,
    showAmounts: true,
    ...extra,
  }
}

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
})

afterEach(() => {
  resetProScreens()
})

describe('ActivePoolsCard', { timeout: 30_000 }, () => {
  it('renders nothing without open collections', () => {
    const closed = savePool(draft('Old'))
    setPoolClosed(closed.id, true)
    const { container } = renderAt('/app', <ActivePoolsCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows at most two open collections with progress and opens one', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 12))
    const ids = ['Sam', 'Kabir', 'Neha', 'Asha'].map((name) => addFriend({ name }).id)
    savePool(draft('Turf', { occasion: 'sports', emoji: '🏏' }))
    vi.setSystemTime(new Date(2026, 9, 21, 12))
    savePool(draft('Diwali party', { occasion: 'diwali', emoji: '🪔', mode: 'target', perPerson: null, target: null }))
    vi.setSystemTime(new Date(2026, 9, 22, 12))
    const riya = savePool(draft("Riya's farewell", { memberIds: ids }))
    vi.setSystemTime(new Date(2026, 9, 23, 12))
    addContribution(riya.id, { friendId: ids[0] ?? null, name: 'Sam', amount: 50000, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null })
    vi.useRealTimers()
    const { user } = renderAt('/app', <ActivePoolsCard />)
    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'See all collections' })).toHaveAttribute('href', '/app/pools')
    // Newest first: Riya's (just ticked), then the Diwali party; Turf waits on the list.
    expect(screen.getByRole('button', { name: /Riya's farewell ₹500 of ₹2,000 · 3 to go/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Diwali party ₹0 in/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Turf/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Riya's farewell/ }))
    expect(currentUrl()).toBe(`/app/pools/${riya.id}`)
  })
})
