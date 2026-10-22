import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { addFriend, createGroup, friendsStore, resetDataForTests } from '../../data'
import { ME_ID } from '../../domain/types'
import { resetFlowHistory } from '../../state/backStack'
import type { Person, Session, Shares } from '../../types'
import { personById, personFor } from './billPeople'
import { PeopleScreen } from './PeopleScreen'
import { historyIdle, renderScreen, sampleSession } from './screenTestKit'

const ids = (people: readonly Person[]) => people.map((p) => p.id)
const names = (people: readonly Person[]) => people.map((p) => p.name)

/** Adds `name` to your people and returns them as a bill person. */
const friend = (name: string): Person => personFor(addFriend({ name }))

beforeEach(() => {
  resetDataForTests()
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
  resetDataForTests()
})

describe('PeopleScreen', () => {
  it('puts you at the table by default and asks for one more person', () => {
    const { probe } = renderScreen(<PeopleScreen />, sampleSession('people'))

    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
    expect(probe.current.people).toEqual([{ id: ME_ID, name: 'You', color: expect.any(Number) as number }])
    expect(screen.getByRole('button', { name: 'Remove You' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next: who had what' })).toBeDisabled()
    expect(screen.getByText('Pick one more person')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Step 3 of 5' })).toBeInTheDocument()
  })

  it('does not put you back once the bill already has people', () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const { probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [riya, sam] }))
    expect(ids(probe.current.people)).toEqual([riya.id, sam.id])
    expect(screen.getByRole('button', { name: 'Next: who had what' })).toBeEnabled()
  })

  it('picks people from your people list', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people'))

    await user.click(screen.getByRole('checkbox', { name: 'Riya' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sam' }))
    expect(probe.current.people).toEqual([expect.objectContaining({ id: ME_ID }), riya, sam])
    expect(screen.getByRole('button', { name: 'Next: who had what' })).toBeEnabled()
  })

  it('adds someone new by name: they join your people and the table in one go', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people'))

    await user.type(screen.getByRole('textbox', { name: 'Search or add people at the table' }), 'Neha{Enter}')
    const neha = friendsStore.get().find((f) => f.name === 'Neha')
    expect(neha).toBeDefined()
    expect(names(probe.current.people)).toEqual(['You', 'Neha'])
    expect(probe.current.people[1]).toEqual({ id: neha?.id, name: 'Neha', color: neha?.color })
  })

  it('moves on to who had what', async () => {
    const riya = friend('Riya')
    const me = personById(ME_ID)
    if (!me) throw new Error('you are always one of your people')
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [me, riya] }))
    await user.click(screen.getByRole('button', { name: 'Next: who had what' }))
    expect(probe.current.step).toBe('assign')
  })

  it('unticks someone who had items with an Undo that puts them back exactly as they were', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const base = sampleSession('people', { people: [riya, sam] })
    const [first, second] = base.items
    if (!first || !second) throw new Error('sample items missing')
    const assignments: Record<string, Shares> = { [first.id]: { [riya.id]: 1, [sam.id]: 2 }, [second.id]: { [sam.id]: 1 } }
    const session: Session = { ...base, assignments, payerId: sam.id }
    const { user, probe } = renderScreen(<PeopleScreen />, session)

    await user.click(screen.getByRole('checkbox', { name: 'Sam' }))
    expect(ids(probe.current.people)).toEqual([riya.id])
    expect(probe.current.assignments).toEqual({ [first.id]: { [riya.id]: 1 } })
    expect(probe.current.payerId).toBeNull()

    expect(screen.getByText('Removed Sam')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(ids(probe.current.people)).toEqual([riya.id, sam.id])
    expect(probe.current.assignments).toEqual(assignments)
    expect(probe.current.payerId).toBe(sam.id)
  })

  it('removing someone from their chip works the same way', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const base = sampleSession('people', { people: [riya, sam] })
    const item = base.items[0]
    if (!item) throw new Error('sample items missing')
    const { user, probe } = renderScreen(<PeopleScreen />, { ...base, assignments: { [item.id]: { [riya.id]: 1 } } })

    await user.click(screen.getByRole('button', { name: 'Remove Riya' }))
    expect(ids(probe.current.people)).toEqual([sam.id])
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(ids(probe.current.people)).toEqual([riya.id, sam.id])
  })

  it('stays quiet when someone with nothing on the bill yet is unticked', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [riya, sam] }))
    await user.click(screen.getByRole('checkbox', { name: 'Riya' }))
    expect(ids(probe.current.people)).toEqual([sam.id])
    expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument()
  })

  it('says why an Undo can’t put someone back, instead of silently doing nothing', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    const base = sampleSession('people', { people: [riya, sam] })
    const item = base.items[0]
    if (!item) throw new Error('sample items missing')
    const { user, probe } = renderScreen(<PeopleScreen />, { ...base, assignments: { [item.id]: { [sam.id]: 1 } } })

    await user.click(screen.getByRole('checkbox', { name: 'Sam' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sam' }))
    const after = probe.current
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText('Sam is already back')).toBeInTheDocument()
    expect(probe.current).toBe(after)
  })

  it('a bill filed under a group offers its members in one tap', async () => {
    const riya = friend('Riya')
    const sam = friend('Sam')
    friend('Neha')
    const trip = createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id, sam.id] })
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { groupId: trip.id }))

    expect(screen.getByRole('region', { name: 'In this group' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(ids(probe.current.people)).toEqual([ME_ID, riya.id, sam.id])
  })

  it('stops at 20 people', async () => {
    const crowd = Array.from({ length: 20 }, (_, i) => friend(`Guest ${i + 1}`))
    const extra = friend('Zoe')
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: crowd }))

    await user.click(screen.getByRole('checkbox', { name: 'Zoe' }))
    expect(probe.current.people).toHaveLength(20)
    expect(ids(probe.current.people)).not.toContain(extra.id)
    expect(screen.getByText('You can split between up to 20 people.')).toBeInTheDocument()
  })

  it('goes back to the amount step', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people'))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(probe.current.step).toBe('paid')
  })
})
