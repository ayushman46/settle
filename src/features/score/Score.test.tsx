import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { shareResult } from '../../lib/share'
import type * as ShareModule from '../../lib/share'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { ScoreCard } from './ScoreCard'
import { ScoreScreen } from './ScoreScreen'

vi.mock('../../lib/share', async (original) => ({ ...(await original<typeof ShareModule>()), shareResult: vi.fn(async () => 'copied' as const) }))

vi.setConfig({ testTimeout: 30_000 })

let sam: string
let riya: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  sam = addFriend({ name: 'Sam' }).id
  riya = addFriend({ name: 'Riya' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(shareResult).mockClear()
})

/** Bills I paid for Riya, and one Sam paid that I still owe him ₹400 for. */
function history(): void {
  for (const date of ['2026-10-01', '2026-10-08', '2026-10-15']) saveExpense(draft({ title: 'Groceries', total: 60_000, date, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 80_000, date: '2026-11-01', payerId: sam, participants: everyone(ME_ID, sam) }))
}

describe('ScoreCard', () => {
  it('shows nothing before the first split', () => {
    const { container } = renderAt('/app/you', <ScoreCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says the score is coming after a split or two', () => {
    saveExpense(draft({ title: 'Chai', total: 10_000, date: '2026-11-10', participants: everyone(ME_ID, riya) }))
    renderAt('/app/you', <ScoreCard />)
    expect(screen.getByText('Your Settle Score appears after your first few splits')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the dial with the number and band, and opens the Score screen', async () => {
    history()
    const { user } = renderAt('/app/you', <ScoreCard />)
    const card = screen.getByRole('button', { name: /^Settle Score \d{3}, (Warming up|Getting there|Solid|Gold standard)\. See how it’s worked out$/ })
    expect(screen.getByRole('img', { name: /^Settle Score \d{3} out of 900/ })).toBeInTheDocument()
    await user.click(card)
    expect(currentUrl()).toBe('/app/score')
  })
})

describe('ScoreScreen', () => {
  it('before enough history: says when the score appears, and that it’s not a credit score', () => {
    renderAt('/app/score', <ScoreScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settle Score' })).toBeInTheDocument()
    expect(screen.getByText('Your score appears after your first few splits')).toBeInTheDocument()
    expect(screen.getByText(/not a credit score/)).toBeInTheDocument()
  })

  it('shows the dial, each factor with a bar and a sentence, and the next step that goes to the friend', async () => {
    history()
    const { user } = renderAt('/app/score', <ScoreScreen />)
    expect(screen.getByRole('img', { name: /^Settle Score \d{3} out of 900/ })).toBeInTheDocument()
    expect(screen.getByText(/nothing leaves it/)).toBeInTheDocument()
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(5)
    expect(meters[0]).toHaveAccessibleName(/^How fast you pay back: \d+ out of 100$/)
    expect(screen.getByText('You usually pay back in about 13 days')).toBeInTheDocument()
    expect(screen.getByText('₹400 owed for over a week, the oldest for 13 days')).toBeInTheDocument()
    expect(screen.getByText('You’ve paid 3 bills for other people')).toBeInTheDocument()
    expect(screen.getByText('Pay Sam ₹400')).toBeInTheDocument()
    expect(screen.getByText(/^About \+\d+ to your score$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it’s worked out' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Sam' }))
    expect(currentUrl()).toBe(`/app/friends/${sam}`)
  })

  it('shares the score as text', async () => {
    history()
    const { user } = renderAt('/app/score', <ScoreScreen />)
    await user.click(screen.getByRole('button', { name: 'Share my score' }))
    expect(shareResult).toHaveBeenCalledWith(expect.stringMatching(/^My Settle Score is \d{3} \(/), { title: 'Settle Score' })
    expect(await screen.findByText('Copied. Paste it anywhere.')).toBeInTheDocument()
  })
})
