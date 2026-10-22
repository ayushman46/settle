import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGroup, resetDataForTests, setGroupArchived } from '../../data'
import { ME_ID } from '../../domain/types'
import { resetFlowHistory } from '../../state/backStack'
import { GroupPicker } from './GroupPicker'
import { historyIdle } from './screenTestKit'

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial)
  return (
    <>
      <GroupPicker value={value} onChange={setValue} />
      <output aria-label="Picked">{value ?? 'none'}</output>
    </>
  )
}

const trip = () => createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID] })
const flat = () => createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID] })

beforeEach(() => {
  resetDataForTests()
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
  resetDataForTests()
})

describe('GroupPicker', () => {
  it('stays out of the way when you have no groups', () => {
    render(<Harness />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('files under a group and back to none', async () => {
    const user = userEvent.setup()
    const goa = trip()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Group None' }))
    const sheet = screen.getByRole('dialog', { name: 'Add to a group?' })
    expect(within(sheet).getByRole('radio', { name: /No group/ })).toBeChecked()
    expect(within(sheet).getByRole('radio', { name: /Goa trip/ })).toHaveAccessibleName('Goa trip 1 member')
    await user.click(within(sheet).getByRole('radio', { name: /Goa trip/ }))
    expect(screen.getByRole('status', { name: 'Picked' })).toHaveTextContent(goa.id)

    await user.click(screen.getByRole('button', { name: 'Group Goa trip' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /No group/ }))
    expect(screen.getByRole('status', { name: 'Picked' })).toHaveTextContent('none')
  })

  it('moves between choices with the arrow keys, from the one picked', async () => {
    const user = userEvent.setup()
    trip()
    const home = flat()
    render(<Harness initial={home.id} />)

    await user.click(screen.getByRole('button', { name: 'Group Flat 4B' }))
    const radios = within(screen.getByRole('dialog')).getAllByRole('radio')
    const at = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true')
    expect(radios[at]).toHaveAccessibleName(/Flat 4B/)
    // Only the picked one is in the tab order.
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([radios[at]])
    radios[at]?.focus()
    await user.keyboard('{ArrowDown}')
    expect(radios[(at + 1) % radios.length]).toHaveFocus()
    await user.keyboard('{End}')
    expect(radios[radios.length - 1]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(radios[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radios[radios.length - 1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(radios[0]).toHaveFocus()
  })

  it('keeps an archived group the bill is already in, so it can be seen and changed', async () => {
    const user = userEvent.setup()
    const goa = trip()
    setGroupArchived(goa.id, true)
    render(<Harness initial={goa.id} />)
    await user.click(screen.getByRole('button', { name: 'Group Goa trip' }))
    expect(within(screen.getByRole('dialog')).getByRole('radio', { name: /Goa trip/ })).toBeChecked()
  })
})
