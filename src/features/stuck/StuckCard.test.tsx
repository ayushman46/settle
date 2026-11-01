import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { StuckCard } from './StuckCard'
import { seedStuck, stuckPayment } from './testKit'

beforeEach(() => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StuckCard (Home)', { timeout: 30_000 }, () => {
  it('stays away while nothing is owed', () => {
    const { container } = renderAt('/app', <StuckCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays away once everything is back, compensation and all', () => {
    seedStuck(stuckPayment({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }), stuckPayment({ id: 's2', dismissedAt: 1 }))
    const { container } = renderAt('/app', <StuckCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says what’s stuck and what needs you, and opens the list', async () => {
    seedStuck(stuckPayment(), stuckPayment({ id: 's2', kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', amount: 420_000, date: '2026-10-31' }))
    const { user } = renderAt('/app', <StuckCard />)
    expect(screen.getByRole('region', { name: 'Stuck money' })).toBeInTheDocument()
    const row = screen.getByRole('button', { name: '₹4,700 stuck with banks and shops 1 needs you · + ₹300 for the wait' })
    await user.click(row)
    expect(currentUrl()).toBe('/app/stuck')
  })

  it('still shows while only compensation is owed', () => {
    seedStuck(stuckPayment({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))
    renderAt('/app', <StuckCard />)
    expect(screen.getByRole('button', { name: /^Your bank owes you ₹200 for the wait 1 needs you/ })).toBeInTheDocument()
  })
})
