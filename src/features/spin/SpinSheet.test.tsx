import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, peekSplitPrefill, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { STORAGE_KEYS } from '../../data/stores'
import { setUsualSplit, usualStore } from '../usual/store'
import { SpinSheet } from './SpinSheet'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let groupId: string

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem(STORAGE_KEYS.usual)
  usualStore.reload()
})

describe('SpinSheet', () => {
  it('fair by default: whoever is behind has the bigger chance, explained; equals show equal chances', async () => {
    // You paid ₹900 for three: Riya and Sam are each ₹300 behind.
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    expect(within(sheet).getByRole('radio', { name: 'Fair' })).toHaveAttribute('aria-checked', 'true')
    expect(within(sheet).getByText(/Half the wheel is shared equally/)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'You, 16.7% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Riya, 41.7% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Sam, 41.7% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'The wheel: Riya 41.7%, Sam 41.7%, You 16.7%' })).toBeInTheDocument()
  })

  it('pure luck gives equal chances', async () => {
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('radio', { name: 'Pure luck' }))
    expect(within(sheet).getByRole('img', { name: 'The wheel: Riya 33.3%, Sam 33.3%, You 33.3%' })).toBeInTheDocument()
  })

  it('spins, announces who pays, and opens the new bill with them paying', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // the first third of the wheel: Riya's slice (ordered by name)
    const onClose = vi.fn()
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={onClose} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    expect(within(sheet).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Nobody in this spin is behind in Flat, so everyone has the same chance.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Spin' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent('Riya’s got this one')
    expect(within(sheet).getByRole('button', { name: 'Spin again' })).toBeEnabled()
    await user.click(within(sheet).getByRole('button', { name: 'Add the bill with Riya paying' }))
    expect(onClose).toHaveBeenCalled()
    expect(currentUrl()).toBe(`/app/split/new?from=spin&group=${groupId}`)
    expect(peekSplitPrefill()).toMatchObject({ groupId, payerId: riya, mode: 'equal', banner: { title: 'The wheel picked Riya' } })
  })

  it('leaving someone out takes them off the wheel; one person left can’t spin', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('button', { name: 'You, 33.3% chance. Tap to leave out.' }))
    expect(within(sheet).getByRole('img', { name: 'The wheel: Riya 50%, Sam 50%' })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Spin' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent('Riya’s got this one')
    await user.click(within(sheet).getByRole('button', { name: 'Sam, 50% chance. Tap to leave out.' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent('')
    expect(within(sheet).getByText('Leave at least two people in to spin.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Spin' })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: 'You, left out of this spin. Tap to bring back.' }))
    expect(within(sheet).getByRole('button', { name: 'Spin' })).toBeEnabled()
  })

  it('“You’ve got this one” when it lands on you', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('button', { name: 'Spin' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent('You’ve got this one')
    expect(within(sheet).getByRole('button', { name: 'Add the bill with you paying' })).toBeInTheDocument()
  })

  it('says why someone who is ahead gets a smaller chance', async () => {
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    expect(within(sheet).getByText('Anyone who has paid their share or more keeps only the equal part.')).toBeInTheDocument()
  })

  it('with everyone left out, only says two are needed (no claim about who is behind)', async () => {
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('button', { name: /^You, / }))
    expect(within(sheet).getByText('Anyone left out still shares the bill. They just can’t be picked.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /^Riya, / }))
    expect(within(sheet).getByRole('button', { name: 'Spin' })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: /^Sam, / }))
    expect(within(sheet).getByText('Leave at least two people in to spin.')).toBeInTheDocument()
    expect(within(sheet).queryByText(/Nobody/)).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/Half the wheel/)).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Spin' })).toBeDisabled()
  })

  it('writes short names on the wheel and lists everyone in full under it', async () => {
    const long = addFriend({ name: 'Priyanka Raghunathan' }).id
    const g = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam, long] })
    renderAt('/app/groups/x', <SpinSheet group={g} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    const labels = within(sheet).getAllByTestId('spin-label').map((el) => el.textContent)
    expect(labels).toEqual(['Priyanka', 'Riya', 'Sam', 'You'])
    expect(within(sheet).getByText('Priyanka Raghunathan')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Priyanka Raghunathan, 25% chance. Tap to leave out.' })).toBeInTheDocument()
  })

  it('opens the new bill split the group’s usual way when it has one', async () => {
    setUsualSplit(groupId, { mode: 'percent', inputs: { [ME_ID]: 5000, [riya]: 3000, [sam]: 2000 }, set: '2026-11-14' })
    vi.spyOn(Math, 'random').mockReturnValue(0.2)
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('button', { name: 'Spin' }))
    await user.click(within(sheet).getByRole('button', { name: 'Add the bill with Riya paying' }))
    expect(peekSplitPrefill()).toMatchObject({
      payerId: riya,
      mode: 'percent',
      participants: [
        { friendId: ME_ID, input: 5000 },
        { friendId: riya, input: 3000 },
        { friendId: sam, input: 2000 },
      ],
      banner: { body: 'Enter the amount and save: it’s split the group’s usual way (50 / 30 / 20), unless you change it.' },
    })
  })

  it('is nothing for a group of one', () => {
    const solo = createGroup({ name: 'Me', emoji: '🙂', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    const { container } = renderAt('/app/groups/x', <SpinSheet group={solo} open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
