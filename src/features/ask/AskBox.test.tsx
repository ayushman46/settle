import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { AskBox } from './AskBox'

vi.setConfig({ testTimeout: 30_000 })

let sam: string
let dinner: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
})

function someSplits(): void {
  dinner = saveExpense(draft({ title: 'Dinner', total: 90_000, date: '2026-11-10', category: 'food', participants: everyone(ME_ID, sam) })).id
  saveExpense(draft({ title: 'Cab', total: 40_000, date: '2026-11-12', category: 'transport', participants: everyone(ME_ID, sam) }))
}

describe('AskBox', () => {
  it('shows nothing before the first expense', () => {
    const { container } = renderAt('/app', <AskBox />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers three questions from your own data, and answers one at a tap', async () => {
    someSplits()
    const { user } = renderAt('/app', <AskBox />)
    const chips = within(screen.getByRole('group', { name: 'Questions to try' })).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Who owes me?', 'How much does Sam owe me?', 'How much did I spend this month?'])
    await user.click(chips[1]!)
    expect(screen.getByRole('textbox', { name: 'Ask about your money' })).toHaveValue('How much does Sam owe me?')
    const status = screen.getByRole('status', { name: 'Answer' })
    expect(within(status).getByText('Sam owes you ₹650')).toBeInTheDocument()
    expect(within(status).getByText('Read as: Between you and Sam')).toBeInTheDocument()
  })

  it('answers a typed question with rows that go to the expense, and clears', async () => {
    someSplits()
    const { user } = renderAt('/app', <AskBox />)
    await user.type(screen.getByRole('textbox', { name: 'Ask about your money' }), 'how much did I spend on food this month{Enter}')
    const status = screen.getByRole('status', { name: 'Answer' })
    expect(within(status).getByText('Your share came to ₹450, across 1 expense')).toBeInTheDocument()
    expect(within(status).getByText('Read as: Your share of spending · Food & drinks · this month')).toBeInTheDocument()
    expect(within(status).getByText(/Nothing is uploaded/)).toBeInTheDocument()
    await user.click(within(status).getByRole('button', { name: /Dinner/ }))
    expect(currentUrl()).toBe(`/app/expense/${dinner}`)
  })

  it('says when it doesn’t follow, with questions it does', async () => {
    someSplits()
    const { user } = renderAt('/app', <AskBox />)
    await user.type(screen.getByRole('textbox', { name: 'Ask about your money' }), 'will it rain{Enter}')
    const status = screen.getByRole('status', { name: 'Answer' })
    expect(within(status).getByText('I didn’t follow that one. I can answer questions like these:')).toBeInTheDocument()
    const tries = within(within(status).getByRole('group', { name: 'Questions to try' })).getAllByRole('button')
    expect(tries).toHaveLength(4)
    await user.click(tries[0]!)
    expect(within(screen.getByRole('status', { name: 'Answer' })).getByText('₹650 is owed to you by 1 person')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear the answer' }))
    expect(screen.getByRole('status', { name: 'Answer' })).toBeEmptyDOMElement()
    expect(screen.getByRole('textbox', { name: 'Ask about your money' })).toHaveValue('')
  })

  it('does nothing for an empty question', async () => {
    someSplits()
    renderAt('/app', <AskBox />)
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Answer' })).toBeEmptyDOMElement()
  })
})
