import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { resetFlowHistory } from '../../state/backStack'
import type { Session } from '../../types'
import { AssignScreen } from './AssignScreen'
import { AISHA, assignAll, BEN, CHEN, historyIdle, renderScreen, sampleSession } from './screenTestKit'

/** Sample bill, three people, nothing assigned (unless `assigned` says which items are). */
function assignSession(assigned: (index: number) => boolean = () => false): Session {
  const session = sampleSession('assign', { people: [AISHA, BEN, CHEN] })
  return { ...session, assignments: assignAll(session, (i) => (assigned(i) ? { a: 1 } : null)) }
}

const sheet = (name?: string) => screen.getByRole('dialog', name === undefined ? {} : { name })
const toggle = (dialog: HTMLElement, name: string) => within(dialog).getByRole('button', { name: new RegExp(`^${name}\\b`) })

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
})

describe('AssignScreen', () => {
  it('opens the pop-up straight away on the first unassigned item', () => {
    const { probe } = renderScreen(<AssignScreen />, assignSession((i) => i < 2))

    const dialog = sheet('Dal Makhani')
    expect(within(dialog).getByText('Item 3 of 8')).toBeInTheDocument()
    expect(within(dialog).getByRole('progressbar', { name: 'Item 3 of 8' })).toBeInTheDocument()
    expect(dialog).toHaveAccessibleDescription('₹325.00')
    expect(within(dialog).getByText('Tap everyone who had some.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Next/ })).toBeDisabled()
    expect(within(dialog).getByText('Pick who had this')).toBeInTheDocument()
    expect(probe.current.assignCursor).toBe(2)
  })

  it('previews each person’s share live and moves on with Next', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, assignSession())
    const dialog = sheet('Paneer Tikka')

    await user.click(toggle(dialog, 'Aisha'))
    expect(toggle(dialog, 'Aisha')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle(dialog, 'Aisha')).toHaveAccessibleName('Aisha ₹345.00')
    expect(within(dialog).getByText('Aisha had all of it.')).toBeInTheDocument()

    await user.click(toggle(dialog, 'Ben'))
    expect(toggle(dialog, 'Aisha')).toHaveAccessibleName('Aisha ₹172.50')
    expect(toggle(dialog, 'Ben')).toHaveAccessibleName('Ben ₹172.50')
    expect(toggle(dialog, 'Chen')).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Split 2 ways · ₹172.50 each')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Next/ }))
    const next = sheet('Butter Chicken')
    expect(next).toBe(dialog) // the same sheet stays up; only its content moves on
    expect(within(next).getByText('Item 2 of 8')).toBeInTheDocument()
    expect(probe.current.assignCursor).toBe(1)
    expect(probe.current.assignments[probe.current.items[0]?.id ?? '']).toEqual({ a: 1, b: 1 })
  })

  it('"Everyone" selects and clears the whole table', async () => {
    const { user } = renderScreen(<AssignScreen />, assignSession())
    const dialog = sheet('Paneer Tikka')
    const everyone = within(dialog).getByRole('button', { name: 'Everyone' })

    await user.click(everyone)
    expect(everyone).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Aisha', 'Ben', 'Chen']) expect(toggle(dialog, name)).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByText('Shared by everyone · ₹115.00 each')).toBeInTheDocument()

    await user.click(everyone)
    for (const name of ['Aisha', 'Ben', 'Chen']) expect(toggle(dialog, name)).toHaveAttribute('aria-pressed', 'false')
  })

  it('splits unevenly by shares, with the bill quantity as a hint', async () => {
    // Items 0–2 done, so the pop-up opens on Garlic Naan (4 on the bill, ₹300).
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i < 3))
    const dialog = sheet('Garlic Naan')
    expect(dialog).toHaveAccessibleDescription('₹300.00 4 × ₹75.00')

    await user.click(toggle(dialog, 'Aisha'))
    expect(within(dialog).queryByRole('button', { name: 'Split unevenly' })).not.toBeInTheDocument()
    await user.click(toggle(dialog, 'Ben'))
    await user.click(within(dialog).getByRole('button', { name: 'Split unevenly' }))

    expect(within(dialog).getByText('4 on the bill')).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Shares for Aisha' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Increase shares for Aisha' }))
    await user.click(within(dialog).getByRole('button', { name: 'Increase shares for Aisha' }))

    expect(toggle(dialog, 'Aisha')).toHaveAccessibleName('Aisha ₹225.00')
    expect(toggle(dialog, 'Ben')).toHaveAccessibleName('Ben ₹75.00')
    expect(within(dialog).getByText('Split by shares · 4 in all')).toBeInTheDocument()
    const naan = probe.current.items[3]?.id ?? ''
    expect(probe.current.assignments[naan]).toEqual({ a: 3, b: 1 })

    await user.click(within(dialog).getByRole('button', { name: 'Split evenly' }))
    expect(probe.current.assignments[naan]).toEqual({ a: 1, b: 1 })
    expect(toggle(dialog, 'Aisha')).toHaveAccessibleName('Aisha ₹150.00')
    expect(within(dialog).queryByRole('group', { name: 'Shares for Aisha' })).not.toBeInTheDocument()
  })

  it('steps with the arrow keys (forward only once someone is picked) and the Back button', async () => {
    const { user } = renderScreen(<AssignScreen />, assignSession())
    const dialog = sheet('Paneer Tikka')
    expect(within(dialog).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    dialog.focus()
    await user.keyboard('{ArrowRight}')
    expect(sheet()).toHaveAccessibleName('Paneer Tikka')

    await user.click(toggle(dialog, 'Chen'))
    await user.keyboard('{ArrowRight}')
    expect(sheet()).toHaveAccessibleName('Butter Chicken')

    await user.keyboard('{ArrowLeft}')
    expect(sheet()).toHaveAccessibleName('Paneer Tikka')

    await user.click(toggle(dialog, 'Chen')) // still picked from before → unpick, then pick Ben
    await user.click(toggle(dialog, 'Ben'))
    await user.click(within(dialog).getByRole('button', { name: /Next/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(sheet()).toHaveAccessibleName('Paneer Tikka')
  })

  it('keeps keyboard focus in the sheet when Next is pressed and the new item disables it', async () => {
    const { user } = renderScreen(<AssignScreen />, assignSession())
    const dialog = sheet('Paneer Tikka')
    await user.click(toggle(dialog, 'Aisha'))

    within(dialog).getByRole('button', { name: /Next/ }).focus()
    await user.keyboard('{Enter}')
    expect(sheet()).toHaveAccessibleName('Butter Chicken')
    expect(within(dialog).getByRole('button', { name: /Next/ })).toBeDisabled()
    expect(dialog).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(sheet()).toHaveAccessibleName('Paneer Tikka')
  })

  it('Done on the last item goes to the result once everything is assigned', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i < 7))
    const dialog = sheet('Gulab Jamun')
    expect(within(dialog).getByText('Item 8 of 8')).toBeInTheDocument()

    await user.click(toggle(dialog, 'Ben'))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.step).toBe('result')
  })

  it('Next on the last item wraps round to the first one that still needs someone', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i > 0 && i < 7))
    await user.click(within(sheet('Paneer Tikka')).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: /^Gulab Jamun/ }))
    const dialog = sheet('Gulab Jamun')
    await user.click(toggle(dialog, 'Aisha'))
    await user.click(within(dialog).getByRole('button', { name: /Next/ }))

    expect(sheet()).toHaveAccessibleName('Paneer Tikka')
    expect(probe.current.step).toBe('assign')
    await user.click(toggle(dialog, 'Ben'))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(probe.current.step).toBe('result')
  })

  it('back to fix one item: the pop-up opens on it and its button is Done', async () => {
    // Everything assigned except item 3 of 8 (Dal Makhani).
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i !== 2))
    const dialog = sheet('Dal Makhani')
    expect(within(dialog).getByText('Item 3 of 8')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: /Next/ })).not.toBeInTheDocument()

    await user.click(toggle(dialog, 'Chen'))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.step).toBe('result')
  })

  it('Next skips items that already have people', async () => {
    // Items 2 and 5 (Butter Chicken, Jeera Rice) are the only ones left.
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i !== 1 && i !== 4))
    const dialog = sheet('Butter Chicken')
    await user.click(toggle(dialog, 'Aisha'))
    await user.click(within(dialog).getByRole('button', { name: /Next/ }))
    expect(sheet()).toHaveAccessibleName('Jeera Rice')
    expect(within(dialog).getByText('Item 5 of 8')).toBeInTheDocument()
    expect(probe.current.assignCursor).toBe(4)
    // Back still steps one item at a time.
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(sheet()).toHaveAccessibleName('Garlic Naan')
  })

  it('closing the pop-up that opened by itself puts focus on that item’s row', async () => {
    const { user } = renderScreen(<AssignScreen />, assignSession((i) => i < 2))
    const dialog = sheet('Dal Makhani')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    await historyIdle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Dal Makhani/ })).toHaveFocus()
  })

  it('shows a unit price only when the line splits exactly', async () => {
    const base = assignSession((i) => i > 0)
    const [first, ...rest] = base.items
    if (!first) throw new Error('fixture')
    renderScreen(<AssignScreen />, { ...base, items: [{ ...first, name: 'Lassi', quantity: 3, amount: 10000 }, ...rest] })
    const dialog = sheet('Lassi')
    expect(dialog).toHaveAccessibleDescription('₹100.00 × 3')
  })

  it('shows what is left on the list and keeps "See the split" until everything is assigned', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, assignSession((i) => i < 6))
    await user.click(within(sheet()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(screen.getByText('6 of 8 items assigned')).toBeInTheDocument()
    expect(screen.getByText('2 items left')).toBeInTheDocument()
    expect(screen.getAllByText('Tap to assign')).toHaveLength(2)
    const seeSplit = screen.getByRole('button', { name: 'See the split' })
    expect(seeSplit).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^Mango Lassi/ }))
    const dialog = sheet('Mango Lassi')
    await user.click(toggle(dialog, 'Chen'))
    await user.click(within(dialog).getByRole('button', { name: /Next/ }))
    await user.click(toggle(dialog, 'Chen'))
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(screen.getByText('All set — every item has someone.')).toBeInTheDocument()
    expect(seeSplit).toBeEnabled()
    await user.click(seeSplit)
    expect(probe.current.step).toBe('result')
  })

  it('"Everyone shared everything" assigns every open item in one tap, with undo', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, assignSession())
    await user.click(within(sheet()).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Everyone shared everything' }))
    expect(screen.queryByText('Tap to assign')).not.toBeInTheDocument()
    // The button is gone with nothing left to share: focus moves to the list, not the page.
    expect(screen.queryByRole('button', { name: /Everyone shared/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Paneer Tikka/ })).toHaveFocus()
    expect(screen.getAllByRole('img', { name: 'Everyone' })).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'See the split' })).toBeEnabled()
    expect(screen.getByText('Shared 8 items between everyone')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(probe.current.assignments).toEqual({})
    expect(screen.getAllByText('Tap to assign')).toHaveLength(8)
  })

  it('does not pop up when everything is already assigned; tapping an item opens it', async () => {
    const { user } = renderScreen(<AssignScreen />, assignSession(() => true))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Everyone shared/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Dal Makhani/ }))
    const dialog = sheet('Dal Makhani')
    expect(within(dialog).getByText('Item 3 of 8')).toBeInTheDocument()
    expect(toggle(dialog, 'Aisha')).toHaveAttribute('aria-pressed', 'true')
    // Nothing else needs anyone: done straight away.
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled()
  })

  it('points back to the people step when nobody has been added', async () => {
    const { user, probe } = renderScreen(<AssignScreen />, sampleSession('assign'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add people' }))
    expect(probe.current.step).toBe('people')
  })
})
