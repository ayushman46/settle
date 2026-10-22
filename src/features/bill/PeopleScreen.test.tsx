import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { getRecentNames, rememberNames } from '../../lib/recent'
import { resetFlowHistory } from '../../state/backStack'
import type { Person, Session, Shares } from '../../types'
import { PeopleScreen } from './PeopleScreen'
import { AISHA, BEN, CHEN, historyIdle, renderScreen, sampleSession } from './screenTestKit'

const names = (people: readonly Person[]) => people.map((p) => p.name)

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
})

describe('PeopleScreen', () => {
  it('starts with a friendly empty state and a disabled Next with a hint', () => {
    renderScreen(<PeopleScreen />, sampleSession('people'))

    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No one yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next: who had what' })).toBeDisabled()
    expect(screen.getByText('Add at least 2 people')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Step 3 of 5' })).toBeInTheDocument()
    // Nothing added yet: the name field is ready to type into.
    expect(screen.getByRole('textbox', { name: 'Add a person' })).toHaveFocus()
  })

  it('adds people with Enter or the + button and keeps the keyboard in the field', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people'))
    const field = screen.getByRole('textbox', { name: 'Add a person' })

    await user.type(field, '  Aisha   {Enter}')
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
    expect(screen.getByText('Add one more person')).toBeInTheDocument()

    await user.type(field, 'Ben')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()

    expect(names(probe.current.people)).toEqual(['Aisha', 'Ben'])
    expect(new Set(probe.current.people.map((p) => p.color)).size).toBe(2)
    expect(screen.getByRole('button', { name: 'Aisha, edit name' })).toBeInTheDocument()
    expect(screen.getByText('2 people')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next: who had what' })).toBeEnabled()
    expect(screen.queryByText('Add one more person')).not.toBeInTheDocument()
  })

  it('refuses duplicate names (any case or accent) with an inline error that clears on typing', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA] }))
    const field = screen.getByRole('textbox', { name: 'Add a person' })

    await user.type(field, 'AÏSHA{Enter}')
    expect(screen.getByText('Aisha is already here')).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(names(probe.current.people)).toEqual(['Aisha'])

    await user.type(field, 'x')
    expect(screen.queryByText('Aisha is already here')).not.toBeInTheDocument()
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('counts a typed-but-not-added name: Next adds it, remembers everyone and moves on', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA] }))
    const next = screen.getByRole('button', { name: 'Next: who had what' })
    expect(next).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Add a person' }), 'Ben')
    expect(next).toBeEnabled()
    await user.click(next)

    expect(names(probe.current.people)).toEqual(['Aisha', 'Ben'])
    expect(probe.current.step).toBe('assign')
    expect(getRecentNames()).toEqual(['Aisha', 'Ben'])
  })

  it('removes a person with an Undo toast that puts them back exactly as they were', async () => {
    const base = sampleSession('people', { people: [AISHA, BEN, CHEN] })
    const [first, second] = base.items
    if (!first || !second) throw new Error('sample items missing')
    const assignments: Record<string, Shares> = { [first.id]: { a: 1, b: 2 }, [second.id]: { b: 1 } }
    const session: Session = { ...base, assignments, payerId: 'b' }
    const { user, probe } = renderScreen(<PeopleScreen />, session)

    await user.click(screen.getByRole('button', { name: 'Remove Ben' }))
    expect(names(probe.current.people)).toEqual(['Aisha', 'Chen'])
    expect(probe.current.assignments).toEqual({ [first.id]: { a: 1 } })
    expect(probe.current.payerId).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ben, edit name' })).not.toBeInTheDocument()

    expect(screen.getByText('Removed Ben')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))

    expect(names(probe.current.people)).toEqual(['Aisha', 'Ben', 'Chen'])
    expect(probe.current.assignments).toEqual({ [first.id]: { a: 1, b: 2 }, [second.id]: { b: 1 } })
    expect(probe.current.payerId).toBe('b')
  })

  it('says why an Undo can’t put someone back, instead of silently doing nothing', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA, BEN] }))

    await user.click(screen.getByRole('button', { name: 'Remove Ben' }))
    await user.type(screen.getByRole('textbox', { name: 'Add a person' }), 'ben{Enter}')
    const after = probe.current
    expect(names(after.people)).toEqual(['Aisha', 'ben'])

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText("Couldn't undo — ben is already at the table")).toBeInTheDocument()
    expect(probe.current).toBe(after)
  })

  it('lists the table right under the field, then the quick picks, and announces each add', async () => {
    rememberNames(['Zoe'])
    const { user } = renderScreen(<PeopleScreen />, sampleSession('people'))
    const field = screen.getByRole('textbox', { name: 'Add a person' })
    await user.type(field, 'Aisha{Enter}')

    const table = screen.getByRole('region', { name: 'At the table' })
    const recent = screen.getByRole('region', { name: 'Recent' })
    expect(field.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(table.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Added Aisha · 1 person')).toHaveAttribute('aria-live', 'polite')

    await user.click(within(recent).getByRole('button', { name: 'Add Zoe' }))
    expect(screen.getByText('Added Zoe · 2 people')).toBeInTheDocument()
  })

  it('undo keeps people added after the removal', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA, BEN] }))

    await user.click(screen.getByRole('button', { name: 'Remove Aisha' }))
    await user.type(screen.getByRole('textbox', { name: 'Add a person' }), 'Dev{Enter}')
    await user.click(screen.getByRole('button', { name: /^Undo/ }))

    expect(names(probe.current.people)).toEqual(['Aisha', 'Ben', 'Dev'])
  })

  it('keeps keyboard focus in the list after removing with the keyboard', async () => {
    const { user } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA, BEN] }))

    screen.getByRole('button', { name: 'Remove Aisha' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Remove Ben' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: 'Add a person' })).toHaveFocus()
  })

  it('offers recent names as one-tap chips, hiding anyone already at the table', async () => {
    rememberNames(['Aisha', 'Zoe', 'Ben'])
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA] }))

    const recent = screen.getByRole('region', { name: 'Recent' })
    expect(within(recent).queryByRole('button', { name: 'Add Aisha' })).not.toBeInTheDocument()
    await user.click(within(recent).getByRole('button', { name: 'Add Zoe' }))

    expect(names(probe.current.people)).toEqual(['Aisha', 'Zoe'])
    expect(within(recent).queryByRole('button', { name: 'Add Zoe' })).not.toBeInTheDocument()
    expect(within(recent).getByRole('button', { name: 'Add Ben' })).toBeInTheDocument()
  })

  it('renames someone from the edit sheet, refusing a name that is taken', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA, BEN] }))

    await user.click(screen.getByRole('button', { name: 'Aisha, edit name' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit name' })
    const field = within(sheet).getByRole('textbox', { name: 'Name' })
    expect(field).toHaveValue('Aisha')

    await user.clear(field)
    await user.type(field, 'ben')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(within(sheet).getByText('Ben is already here')).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, 'Aisha K{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(names(probe.current.people)).toEqual(['Aisha K', 'Ben'])
  })

  it('can remove from the edit sheet too (with undo)', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA, BEN] }))

    await user.click(screen.getByRole('button', { name: 'Ben, edit name' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Edit name' })).getByRole('button', { name: 'Remove' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(names(probe.current.people)).toEqual(['Aisha'])
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(names(probe.current.people)).toEqual(['Aisha', 'Ben'])
  })

  it('stops at 20 people', () => {
    const crowd = Array.from({ length: 20 }, (_, i): Person => ({ id: `p${i}`, name: `Guest ${i + 1}`, color: i % 8 }))
    rememberNames(['Zoe'])
    renderScreen(<PeopleScreen />, sampleSession('people', { people: crowd }))

    expect(screen.getByRole('textbox', { name: 'Add a person' })).toBeDisabled()
    expect(screen.getByText("That's everyone — 20 people max.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Zoe' })).not.toBeInTheDocument()
  })

  it('goes back to the amount step', async () => {
    const { user, probe } = renderScreen(<PeopleScreen />, sampleSession('people', { people: [AISHA] }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(probe.current.step).toBe('paid')
  })
})
