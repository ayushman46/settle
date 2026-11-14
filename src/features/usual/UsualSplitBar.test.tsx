import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expensesStore, groupsStore } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { ME_ID } from '../../domain/types'
import { renderApp, resetSplitScreens, seedExpense, seedGroup, seedPeople } from '../split/testing'
import { getUsualSplit, setUsualSplit, usualStore } from './store'

vi.mock('../trip/enabled', () => ({ TRIP_ENABLED: true }))

const SCREEN = { timeout: 30_000 }
const DAY = '2026-10-22'

function resetUsual(): void {
  localStorage.removeItem(STORAGE_KEYS.usual)
  usualStore.reload()
}

beforeEach(() => {
  resetSplitScreens()
  resetUsual()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12))
  seedPeople()
  seedGroup({ id: 'home', name: 'Home', kind: 'home', memberIds: [ME_ID, 'riya'] })
})

afterEach(() => {
  vi.useRealTimers()
  resetSplitScreens()
  resetUsual()
})

const percentFor = (who: string) => screen.getByRole('textbox', { name: `Percentage for ${who}` })
const offer = () => screen.queryByRole('switch', { name: 'Use this for every new expense in Home' })

describe('A group’s usual split', SCREEN, () => {
  it('offers to keep a 60 / 40 split, and the next expense opens with it', async () => {
    const { user, unmount } = renderApp('/app/split/new?group=home')
    expect(offer()).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    await user.type(percentFor('you'), '60')
    expect(offer()).not.toBeInTheDocument() // doesn't add up yet
    await user.type(percentFor('Riya'), '40')
    await user.click(offer()!)
    expect(offer()).toHaveAttribute('aria-checked', 'true')
    expect(getUsualSplit('home')).toEqual({ mode: 'percent', inputs: { [ME_ID]: 6000, riya: 4000 }, set: DAY })

    // Changed its mind on this screen: off again, nothing kept.
    await user.click(offer()!)
    expect(getUsualSplit('home')).toBeNull()
    await user.click(offer()!)
    unmount()

    const next = renderApp('/app/split/new?group=home')
    expect(screen.getByRole('radio', { name: 'Percentages' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Usual split: 60 / 40')).toBeInTheDocument()
    expect(screen.getByText('You 60% · Riya 40%')).toBeInTheDocument()
    await next.user.type(screen.getByLabelText('Amount'), '1000')
    await next.user.click(screen.getByRole('button', { name: 'Save split' }))
    expect(expensesStore.get()[0]).toMatchObject({ mode: 'percent', groupId: 'home', shares: { [ME_ID]: 60_000, riya: 40_000 } })
  })

  it('Change splits just this one equally; the usual one is a tap away', async () => {
    setUsualSplit('home', { mode: 'shares', inputs: { [ME_ID]: 2, riya: 1 }, set: DAY })
    const { user } = renderApp('/app/split/new?group=home')
    expect(screen.getByText('Usual split: 2 : 1')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Split this one equally' }))
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')
    expect(getUsualSplit('home')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Use the usual split: 2 : 1' }))
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Usual split: 2 : 1')).toBeInTheDocument()
  })

  it('Stop using it forgets it, with undo', async () => {
    setUsualSplit('home', { mode: 'percent', inputs: { [ME_ID]: 6000, riya: 4000 }, set: DAY })
    const { user } = renderApp('/app/split/new?group=home')
    await user.click(screen.getByRole('button', { name: 'Stop using it' }))
    expect(getUsualSplit('home')).toBeNull()
    expect(await screen.findByText('Home’s usual split is gone. New expenses start equal.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(getUsualSplit('home')?.inputs).toEqual({ [ME_ID]: 6000, riya: 4000 })
  })

  it('after Stop using it, says this expense is still split that way and new ones start equal', async () => {
    setUsualSplit('home', { mode: 'percent', inputs: { [ME_ID]: 6000, riya: 4000 }, set: DAY })
    const { user } = renderApp('/app/split/new?group=home')
    await user.click(screen.getByRole('button', { name: 'Stop using it' }))
    expect(screen.getByText('This expense is still split 60 / 40. New ones will start equal.')).toBeInTheDocument()
    expect(screen.queryByText('New expenses here will start split this way. You can change any one of them.')).not.toBeInTheDocument()
    // Changed by hand: no longer true, so no longer said.
    await user.clear(percentFor('you'))
    await user.type(percentFor('you'), '70')
    await user.clear(percentFor('Riya'))
    await user.type(percentFor('Riya'), '30')
    expect(screen.queryByText(/This expense is still split/)).not.toBeInTheDocument()
  })

  it('says so when the group has changed since, and sets it again for everyone now', async () => {
    setUsualSplit('home', { mode: 'percent', inputs: { [ME_ID]: 6000, riya: 4000 }, set: DAY })
    groupsStore.set(groupsStore.get().map((g) => (g.id === 'home' ? { ...g, memberIds: [ME_ID, 'riya', 'sam'] } : g)))
    const { user } = renderApp('/app/split/new?group=home')
    expect(screen.getByText('The usual split was for different people')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Set it again' }))
    expect(screen.getByRole('radio', { name: 'Percentages' })).toHaveAttribute('aria-checked', 'true')
    expect(percentFor('you')).toHaveValue('60')
    expect(percentFor('Sam')).toHaveValue('')
    expect(screen.getByText('Sam is new: at 0% until you set a part.')).toBeInTheDocument()
    await user.clear(percentFor('you'))
    await user.type(percentFor('you'), '40')
    await user.clear(percentFor('Riya'))
    await user.type(percentFor('Riya'), '30')
    await user.type(percentFor('Sam'), '30')
    expect(screen.queryByText(/is new: at 0%/)).not.toBeInTheDocument()
    await user.click(offer()!)
    expect(getUsualSplit('home')?.inputs).toEqual({ [ME_ID]: 4000, riya: 3000, sam: 3000 })
  })

  it('is never applied or offered when editing an expense', async () => {
    setUsualSplit('home', { mode: 'percent', inputs: { [ME_ID]: 6000, riya: 4000 }, set: DAY })
    const expense = seedExpense({ groupId: 'home', participants: [{ friendId: ME_ID, input: null }, { friendId: 'riya', input: null }] })
    renderApp(`/app/split/${expense.id}/edit`)
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/Usual split/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use the usual split/ })).not.toBeInTheDocument()
  })

  it('shows nothing outside a group', async () => {
    const { user } = renderApp('/app/split/new?friend=riya')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    await user.type(percentFor('you'), '60')
    await user.type(percentFor('Riya'), '40')
    expect(screen.queryByRole('switch', { name: /every new expense/ })).not.toBeInTheDocument()
  })
})
