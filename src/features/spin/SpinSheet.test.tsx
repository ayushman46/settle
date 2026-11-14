import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, peekSplitPrefill, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
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
})

describe('SpinSheet', () => {
  it('fair by default: whoever is behind has the bigger chance, explained, adding up to 100%', async () => {
    // You paid ₹900 for three: Riya and Sam are each ₹300 behind.
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    expect(within(sheet).getByRole('radio', { name: 'Fair' })).toHaveAttribute('aria-checked', 'true')
    expect(within(sheet).getByText(/Half the wheel is shared equally/)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'You, 17% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Riya, 42% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Sam, 41% chance. Tap to leave out.' })).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'The wheel: Riya 42%, Sam 41%, You 17%' })).toBeInTheDocument()
  })

  it('pure luck gives equal chances', async () => {
    saveExpense(draft({ total: 90_000, groupId, participants: everyone(ME_ID, riya, sam) }))
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    await user.click(within(sheet).getByRole('radio', { name: 'Pure luck' }))
    expect(within(sheet).getByRole('img', { name: 'The wheel: Riya 34%, Sam 33%, You 33%' })).toBeInTheDocument()
  })

  it('spins, announces who pays, and opens the new bill with them paying', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2) // the first third of the wheel: Riya's slice (ordered by name)
    const onClose = vi.fn()
    const { user } = renderAt('/app/groups/x', <SpinSheet group={group()} open onClose={onClose} />)
    const sheet = await screen.findByRole('dialog', { name: 'Who pays?' })
    expect(within(sheet).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Nobody here is behind in Flat, so everyone has the same chance.')).toBeInTheDocument()
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
    await user.click(within(sheet).getByRole('button', { name: 'You, 33% chance. Tap to leave out.' }))
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

  it('is nothing for a group of one', () => {
    const solo = createGroup({ name: 'Me', emoji: '🙂', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    const { container } = renderAt('/app/groups/x', <SpinSheet group={solo} open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
