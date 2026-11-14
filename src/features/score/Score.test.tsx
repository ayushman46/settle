import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, setPaidBack, updateProfile } from '../../data'
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
let neha: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  sam = addFriend({ name: 'Sam' }).id
  riya = addFriend({ name: 'Riya' }).id
  neha = addFriend({ name: 'Neha' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(shareResult).mockClear()
})

/** Bills I paid for Riya, one Sam paid that I still owe him ₹400 for, and two I paid back today. */
function history(): void {
  for (const date of ['2026-10-01', '2026-10-08', '2026-10-15']) saveExpense(draft({ title: 'Groceries', total: 60_000, date, participants: everyone(ME_ID, riya) }))
  saveExpense(draft({ title: 'Cab', total: 80_000, date: '2026-11-01', payerId: sam, participants: everyone(ME_ID, sam) }))
  for (const [date, payer] of [['2026-11-12', riya], ['2026-11-13', neha]] as const) {
    const e = saveExpense(draft({ title: 'Lunch', total: 60_000, date, payerId: payer, participants: everyone(ME_ID, payer) }))
    setPaidBack(e.id, ME_ID, true)
  }
}

/** Three splits I owe on, none paid back, all fresh: not enough to say anything. */
function fresh(): void {
  for (const [date, payer] of [['2026-11-12', riya], ['2026-11-13', sam], ['2026-11-14', neha]] as const) saveExpense(draft({ title: 'Dinner', total: 90_000, date, payerId: payer, participants: everyone(ME_ID, payer) }))
}

describe('ScoreCard', () => {
  it('shows nothing before the first split', () => {
    const { container } = renderAt('/app/you', <ScoreCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says exactly what the score needs, with no number, until there’s enough history', () => {
    saveExpense(draft({ title: 'Chai', total: 10_000, date: '2026-11-10', participants: everyone(ME_ID, riya) }))
    renderAt('/app/you', <ScoreCard />)
    expect(screen.getByText('Settle Score: not enough history yet. It appears after 3 times you’ve owed someone ₹100 or more (0 of 3 so far).')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('three fresh splits with nothing paid show no number (the panel saw “609 / Getting there”)', () => {
    fresh()
    renderAt('/app/you', <ScoreCard />)
    expect(screen.getByText(/not enough history yet/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/Getting there/)).not.toBeInTheDocument()
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
    expect(screen.getByText('Not enough history yet')).toBeInTheDocument()
    expect(screen.getByText('Your score appears after 3 times you’ve owed someone ₹100 or more and paid them back. A debt left unpaid for over 3 days counts too. So far: 0 of 3.')).toBeInTheDocument()
    expect(screen.getByText(/not a credit score/)).toBeInTheDocument()
  })

  it('three fresh splits with nothing paid: no number on the screen either', () => {
    fresh()
    renderAt('/app/score', <ScoreScreen />)
    expect(screen.getByText('Not enough history yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the dial, each factor with a bar and a sentence, and the next step that goes to the friend', async () => {
    history()
    const { user } = renderAt('/app/score', <ScoreScreen />)
    expect(screen.getByRole('img', { name: /^Settle Score \d{3} out of 900/ })).toBeInTheDocument()
    expect(screen.getByText(/nothing leaves it/)).toBeInTheDocument()
    const meters = screen.getAllByRole('meter')
    expect(meters).toHaveLength(5)
    expect(meters[0]).toHaveAccessibleName(/^How fast you pay back: \d+ out of 100$/)
    expect(screen.getByText('Usually about 2 days, counting what you still owe')).toBeInTheDocument()
    expect(screen.getByText('2 of the 3 times you owed someone were paid back within 3 days')).toBeInTheDocument()
    expect(screen.getByText('6 splits of ₹100 or more, with 3 people. The full range needs 12 splits with 3 different people.')).toBeInTheDocument()
    expect(screen.getByText(/Tiny bills hardly count: a bill under ₹100 isn’t counted/)).toBeInTheDocument()
    expect(screen.getByText('₹400 owed for over a week, the oldest for 13 days')).toBeInTheDocument()
    expect(screen.getByText('You’ve paid 3 bills for other people')).toBeInTheDocument()
    expect(screen.getByText('Pay Sam ₹400')).toBeInTheDocument()
    expect(screen.getByText(/^About \+\d+ to your score$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How it’s worked out' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Sam' }))
    expect(currentUrl()).toBe(`/app/friends/${sam}`)
  })

  it('with nothing paid back yet, speed tells the oldest debt’s age, not a pay-back time', () => {
    for (const [date, payer] of [['2026-11-01', sam], ['2026-11-05', riya], ['2026-11-10', neha]] as const) saveExpense(draft({ title: 'Dinner', total: 90_000, date, payerId: payer, participants: everyone(ME_ID, payer) }))
    renderAt('/app/score', <ScoreScreen />)
    expect(screen.getByText('Nothing paid back yet; your oldest is 13 days old')).toBeInTheDocument()
    expect(screen.queryByText(/You usually pay back/)).not.toBeInTheDocument()
  })

  it('shares the score as a game with the app’s name and link, never claiming how fast I pay', async () => {
    history()
    const { user } = renderAt('/app/score', <ScoreScreen />)
    await user.click(screen.getByRole('button', { name: 'Share my score' }))
    expect(shareResult).toHaveBeenCalledWith(
      expect.stringMatching(/^My Settle Score is \d{3} \(.+\)\. It’s a game in Settle for paying friends back on time, not a credit score\. https:\/\/settleupi\.vercel\.app$/),
      { title: 'Settle Score' },
    )
    expect(await screen.findByText('Copied. Paste it anywhere.')).toBeInTheDocument()
  })
})
